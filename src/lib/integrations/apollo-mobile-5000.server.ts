import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { assertSalesArea, assertSalesRecord } from "@/lib/access-control/sales-core.server";
import { PermissionDeniedError } from "@/lib/access-control/enforce.server";
import {
  confirmedMobile,
  isITManager,
  matchesApolloIdentity,
  matchIdentity,
  MOBILE_ATTEMPT_LIMIT,
  MOBILE_CREDIT_PER_REQUEST,
  staffFloor,
  type Identity,
} from "./apollo-mobile-5000";

const TABLE = "apollo_mobile_5000_attempts";
const CONTACTS = "id,job_title,company_id,linkedin_url,email,mobile_phone,updated_at";
const COMPANIES = "id,size,domain,website";
const PAGE = 500;
const APOLLO = "https://api.apollo.io/api/v1";
type Status = "reserved" | "pending" | "updated" | "skipped" | "uncertain";
type Attempt = {
  contact_id: string;
  status: Status;
  request_id: string | null;
  person_id: string | null;
};
type Contact = {
  id: string;
  job_title: string | null;
  company_id: string | null;
  linkedin_url: string | null;
  email: string | null;
  mobile_phone: string | null;
  updated_at: string;
};
type Company = { id: string; size: string | null; domain: string | null; website: string | null };
type Actor = { supabase: SupabaseClient; userId: string };
type Person = {
  id?: string;
  linkedin_url?: string;
  email?: string;
  phone_numbers?: Parameters<typeof confirmedMobile>[0];
};
type ApolloResult = {
  error_code?: string;
  retry_after_seconds?: number;
  request_id?: string;
  request_id_str?: string;
  request_type?: string;
  match_confidence?: string;
  phone_enrichment?: { status?: string };
  person?: Person;
  webhook_result?: { people?: Person[] };
};

export async function assertMobileCampaignAccess(
  actor: Actor,
  deps = { resolveActiveWorkspace, assertSalesArea, env: process.env },
) {
  const w = await deps.resolveActiveWorkspace(actor.userId);
  if (!w || w !== deps.env.APOLLO_MOBILE_5000_WORKSPACE_ID)
    throw new PermissionDeniedError(["Operação indisponível neste workspace."]);
  await deps.assertSalesArea(actor.supabase, "techsales.prospecting_enrichment", "manage");
  const { data: readonly, error } = await actor.supabase.rpc("is_read_only_view");
  if (error || readonly !== false)
    throw new PermissionDeniedError(["A operação exige uma sessão normal, com edição."]);
  return w;
}

function verifiedKey() {
  const key = process.env.APOLLO_MOBILE_5000_DIRECT_KEY;
  if (
    !key ||
    process.env.APOLLO_MOBILE_5000_VERIFIED_UNIT_MAX !== String(MOBILE_CREDIT_PER_REQUEST)
  )
    throw new Error(
      "Valide o plano padrão Apollo e a chave direta antes de liberar consultas pagas.",
    );
  return key;
}

const ledger = () => supabaseAdmin as unknown as SupabaseClient;
const check = (error: unknown) => {
  if (error) throw new Error("Não foi possível consultar ou gravar a operação de celulares.");
};
const digest = (id: Identity) => createHash("sha256").update(JSON.stringify(id)).digest("hex");

function contacts(db: SupabaseClient, w: string) {
  return db
    .from("contacts")
    .select(CONTACTS)
    .eq("workspace_id", w)
    .eq("audience", "sales")
    .is("deleted_at", null)
    .is("mobile_phone", null);
}
function companies(db: SupabaseClient, w: string) {
  return db.from("companies").select(COMPANIES).eq("workspace_id", w).is("deleted_at", null);
}
function eligible(c: Contact, org: Company | undefined) {
  return org && isITManager(c.job_title) && (staffFloor(org.size) ?? 0) >= 100
    ? matchIdentity(c, org)
    : null;
}

async function eligibleRecord(actor: Actor, w: string, id: string) {
  try {
    await assertSalesRecord(actor.supabase, "contacts", id, "update");
  } catch (error) {
    if (error instanceof PermissionDeniedError) return null;
    throw error;
  }
  const fields = await actor.supabase.rpc("shared_field_context");
  check(fields.error);
  if (fields.data?.workspace_id !== w) return null;
  const mode = fields.data?.rules?.["techsales.contacts"]?.mobile_phone;
  if (["readonly", "hidden", "masked"].includes(mode)) return null;
  const { data: contact, error } = await contacts(actor.supabase, w)
    .eq("id", id)
    .maybeSingle<Contact>();
  check(error);
  if (!contact?.company_id) return null;
  const cmp = await companies(actor.supabase, w)
    .eq("id", contact.company_id)
    .maybeSingle<Company>();
  check(cmp.error);
  const identity = eligible(contact, cmp.data ?? undefined);
  return identity ? { identity, updatedAt: contact.updated_at } : null;
}

export async function mobileCampaignPreview(actor: Actor) {
  const w = await assertMobileCampaignAccess(actor);
  const history = await ledger()
    .from(TABLE)
    .select("contact_id,status,identity_hash")
    .eq("workspace_id", w)
    .eq("actor_id", actor.userId);
  check(history.error);
  const all = await ledger().from(TABLE).select("slot", { count: "exact", head: true });
  check(all.error);
  const attempts = all.count;
  if (attempts === null) throw new Error("Não foi possível determinar o saldo da operação.");
  const remaining = MOBILE_ATTEMPT_LIMIT - attempts;
  const past = new Set((history.data ?? []).map((r) => r.contact_id));
  const identities = new Set((history.data ?? []).map((r) => r.identity_hash));
  const candidateIds: string[] = [];
  let eligibleCount = 0;
  let cursor: string | undefined;
  for (;;) {
    let q = contacts(actor.supabase, w).not("company_id", "is", null).order("id").limit(PAGE);
    if (cursor) q = q.gt("id", cursor);
    const page = await q.returns<Contact[]>();
    check(page.error);
    const rows = page.data ?? [];
    if (!rows.length) break;
    const managers = rows.filter((r) => isITManager(r.job_title) && !past.has(r.id));
    if (managers.length) {
      const companyRows = await companies(actor.supabase, w)
        .in("id", [...new Set(managers.map((r) => r.company_id))])
        .returns<Company[]>();
      check(companyRows.error);
      const byId = new Map((companyRows.data ?? []).map((c) => [c.id, c]));
      for (const row of managers) {
        const identity = eligible(row, byId.get(row.company_id ?? ""));
        if (!identity) continue;
        const hash = digest(identity);
        if (identities.has(hash)) continue;
        identities.add(hash);
        eligibleCount++;
        if (candidateIds.length < remaining) candidateIds.push(row.id);
      }
    }
    cursor = rows.at(-1)?.id;
    if (rows.length < PAGE) break;
  }
  return {
    eligibleCount,
    candidateIds,
    reservedCredits: attempts * MOBILE_CREDIT_PER_REQUEST,
    pendingIds: (history.data ?? [])
      .filter((a) => a.status === "pending")
      .map((a) => a.contact_id as string),
    updated: (history.data ?? []).filter((a) => a.status === "updated").length,
    uncertain: (history.data ?? []).filter(
      (a) => a.status === "uncertain" || a.status === "reserved",
    ).length,
    enabled:
      Boolean(process.env.APOLLO_MOBILE_5000_DIRECT_KEY) &&
      process.env.APOLLO_MOBILE_5000_VERIFIED_UNIT_MAX === String(MOBILE_CREDIT_PER_REQUEST),
  };
}

async function apollo(key: string, url: string, body?: unknown) {
  const res = await fetch(APOLLO + url, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", Accept: "application/json", "X-Api-Key": key },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "error",
    signal: AbortSignal.timeout(12_000),
  });
  const json = (await res.json()) as ApolloResult;
  return { ok: res.ok, status: res.status, json };
}

export async function dispatchMobileCampaign(actor: Actor, contactId: string) {
  const w = await assertMobileCampaignAccess(actor);
  const key = verifiedKey();
  const record = await eligibleRecord(actor, w, contactId);
  if (!record) return "skipped" as const;
  const id = record.identity;
  const reserved = await ledger().rpc("reserve_apollo_mobile_5000", {
    w,
    c: contactId,
    u: actor.userId,
    identity: digest(id),
  });
  check(reserved.error);
  if (typeof reserved.data !== "number") return "skipped" as const;
  const save = (status: Status, fields = {}) =>
    ledger()
      .from(TABLE)
      .update({ status, ...fields })
      .eq("slot", reserved.data)
      .eq("status", "reserved");
  try {
    const r = await apollo(key, "/people/match", {
      ...id,
      reveal_phone_number: true,
      poll_only: true,
      reveal_personal_emails: false,
      run_waterfall_email: false,
      run_waterfall_phone: false,
    });
    if (!r.ok) throw new Error("Consulta não confirmada.");
    if (
      r.json.phone_enrichment?.status !== "pending" ||
      !r.json.person?.id ||
      r.json.match_confidence !== "high" ||
      !matchesApolloIdentity(id, r.json.person)
    ) {
      check((await save("skipped")).error);
      return "skipped" as const;
    }
    if (!/^-?\d{1,19}$/.test(r.json.request_id_str ?? "")) throw new Error("Protocolo incompleto.");
    check(
      (await save("pending", { request_id: r.json.request_id_str, person_id: r.json.person.id }))
        .error,
    );
    return "pending" as const;
  } catch {
    check((await save("uncertain")).error);
    throw new Error(
      "O Apollo não confirmou uma consulta. O crédito ficou reservado e não será repetido. Lote pausado.",
    );
  }
}

export async function reconcileMobileCampaign(actor: Actor, contactId: string) {
  const w = await assertMobileCampaignAccess(actor);
  const key = verifiedKey();
  const state = await ledger()
    .from(TABLE)
    .select("contact_id,status,request_id,person_id")
    .eq("workspace_id", w)
    .eq("contact_id", contactId)
    .eq("actor_id", actor.userId)
    .maybeSingle<Attempt>();
  check(state.error);
  const attempt = state.data;
  if (attempt?.status !== "pending" || !attempt.request_id || !attempt.person_id)
    return "skipped" as const;
  const save = async (status: Status) => {
    check(
      (
        await ledger()
          .from(TABLE)
          .update({ status })
          .eq("workspace_id", w)
          .eq("contact_id", contactId)
          .eq("actor_id", actor.userId)
          .eq("status", "pending")
      ).error,
    );
  };
  const record = await eligibleRecord(actor, w, contactId);
  const original = await ledger()
    .from(TABLE)
    .select("identity_hash")
    .eq("workspace_id", w)
    .eq("contact_id", contactId)
    .eq("actor_id", actor.userId)
    .single<{ identity_hash: string }>();
  check(original.error);
  if (!record || original.data?.identity_hash !== digest(record.identity)) {
    await save("skipped");
    return "skipped" as const;
  }
  const reply = await apollo(key, "/webhook_result/" + encodeURIComponent(attempt.request_id));
  if (!reply.ok) {
    if (reply.status === 404 && reply.json.error_code === "result_pending")
      return "pending" as const;
    if (
      ["request_id_unknown", "request_id_expired", "invalid_request_id"].includes(
        reply.json.error_code ?? "",
      )
    ) {
      await save("uncertain");
      return "uncertain" as const;
    }
    throw new Error(
      "Ainda não foi possível recuperar a resposta. Nenhuma nova consulta paga foi aberta.",
    );
  }
  if (reply.json.request_type !== "phone" || reply.json.request_id !== attempt.request_id)
    throw new Error("Resposta da Apollo não corresponde à consulta.");
  const matches = (reply.json.webhook_result?.people ?? []).filter(
    (p) => p.id === attempt.person_id,
  );
  const phone = matches.length === 1 ? confirmedMobile(matches[0].phone_numbers) : null;
  if (!phone) {
    await save("skipped");
    return "skipped" as const;
  }
  const patch = await actor.supabase.rpc("apply_apollo_mobile_5000", {
    w,
    c: contactId,
    seen_at: record.updatedAt,
    mobile: phone,
    expected_request: attempt.request_id,
  });
  check(patch.error);
  return patch.data === true ? ("updated" as const) : ("skipped" as const);
}
