// Engine de enriquecimento (Apollo / Lusha) — provê:
// - Provedores normalizados (apolloMatch, lushaMatch) → EnrichedPerson
// - runEnrichmentBatch(): aplica em massa com modes (fill_empty | overwrite),
//   suporte a dry-run e cascade de múltiplos provedores.
// É importado por server fns; não roda em código de cliente.
import type { SupabaseClient } from "@supabase/supabase-js";
import { apolloPhoneWebhookUrl } from "./apollo-enrich.server";

export type EnrichProvider = "apollo" | "lusha";
export type EnrichEntity = "lead" | "contact";
export type EnrichMode = "fill_empty" | "overwrite";

export type EnrichedPerson = {
  email?: string | null;
  phone?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  job_title?: string | null;
  company_name?: string | null;
  linkedin_url?: string | null;
};

const APOLLO_BASE = "https://api.apollo.io";
const LUSHA_BASE = "https://api.lusha.com";

type ApolloPerson = {
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  title?: string | null;
  linkedin_url?: string | null;
  phone_numbers?: { sanitized_number?: string; raw_number?: string }[];
  organization?: { name?: string | null; primary_domain?: string | null } | null;
};

export async function apolloMatch(input: {
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  linkedin_url?: string | null;
}): Promise<EnrichedPerson | null> {
  const key = process.env.APOLLO_API_KEY;
  if (!key) throw new Error("Apollo não conectado: configure APOLLO_API_KEY em Integrações.");

  const params: Record<string, unknown> = {
    reveal_personal_emails: true,
  };
  // `reveal_phone_number` exige `webhook_url` na Apollo; sem webhook válido o
  // match segue sem revelação de telefone em vez de falhar com erro 400.
  const phoneWebhook = apolloPhoneWebhookUrl();
  if (phoneWebhook) {
    params.reveal_phone_number = true;
    params.webhook_url = phoneWebhook;
  }

  if (input.linkedin_url) params.linkedin_url = input.linkedin_url;
  else if (input.email) params.email = input.email;
  else if (input.first_name && input.company_name) {
    params.first_name = input.first_name;
    if (input.last_name) params.last_name = input.last_name;
    params.organization_name = input.company_name;
  } else {
    return null;
  }

  const res = await fetch(`${APOLLO_BASE}/api/v1/people/match`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": key, accept: "application/json" },
    body: JSON.stringify(params),
  });
  const body = (await res.json().catch(() => ({}))) as { person?: ApolloPerson };
  if (!res.ok)
    throw new Error(`Apollo erro [${res.status}]: ${JSON.stringify(body).slice(0, 300)}`);
  const p = body.person;
  if (!p) return null;
  return {
    email: p.email ?? null,
    phone: p.phone_numbers?.[0]?.sanitized_number ?? p.phone_numbers?.[0]?.raw_number ?? null,
    first_name: p.first_name ?? null,
    last_name: p.last_name ?? null,
    job_title: p.title ?? null,
    company_name: p.organization?.name ?? null,
    linkedin_url: p.linkedin_url ?? null,
  };
}

type LushaResp = {
  data?: {
    contact?: {
      emailAddresses?: { email?: string }[];
      phoneNumbers?: { number?: string }[];
      jobTitle?: string;
      firstName?: string;
      lastName?: string;
      linkedinUrl?: string;
    };
    company?: { name?: string };
  };
};

export async function lushaMatch(input: {
  email?: string | null;
  linkedin_url?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
}): Promise<EnrichedPerson | null> {
  const key = process.env.LUSHA_API_KEY;
  if (!key) throw new Error("Lusha não conectado: configure LUSHA_API_KEY em Integrações.");

  const url = new URL(`${LUSHA_BASE}/v2/person`);
  if (input.linkedin_url) url.searchParams.set("linkedinUrl", input.linkedin_url);
  else if (input.email) url.searchParams.set("email", input.email);
  else if (input.first_name && input.company_name) {
    url.searchParams.set("firstName", input.first_name);
    if (input.last_name) url.searchParams.set("lastName", input.last_name);
    url.searchParams.set("companyName", input.company_name);
  } else {
    return null;
  }
  const res = await fetch(url, { headers: { api_key: key, accept: "application/json" } });
  const body = (await res.json().catch(() => ({}))) as LushaResp;
  if (!res.ok) throw new Error(`Lusha erro [${res.status}]: ${JSON.stringify(body).slice(0, 300)}`);
  const c = body.data?.contact;
  if (!c) return null;
  return {
    email: c.emailAddresses?.[0]?.email ?? null,
    phone: c.phoneNumbers?.[0]?.number ?? null,
    first_name: c.firstName ?? null,
    last_name: c.lastName ?? null,
    job_title: c.jobTitle ?? null,
    company_name: body.data?.company?.name ?? null,
    linkedin_url: c.linkedinUrl ?? null,
  };
}

const PROVIDER_FN: Record<EnrichProvider, typeof apolloMatch> = {
  apollo: apolloMatch,
  lusha: lushaMatch,
};

// Campos atualizáveis por entidade.
const UPDATABLE_FIELDS: Record<EnrichEntity, (keyof EnrichedPerson)[]> = {
  lead: ["email", "phone", "first_name", "last_name", "company_name"],
  contact: ["email", "phone", "first_name", "last_name", "job_title", "linkedin_url"],
};

function computeUpdate(
  before: Record<string, unknown>,
  enriched: EnrichedPerson,
  entity: EnrichEntity,
  mode: EnrichMode,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of UPDATABLE_FIELDS[entity]) {
    const newVal = enriched[f];
    if (newVal == null || newVal === "") continue;
    const oldVal = before[f as string];
    if (mode === "fill_empty" && oldVal) continue;
    if (oldVal === newVal) continue;
    out[f as string] = newVal;
  }
  return out;
}

export interface RunBatchOpts {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>;
  ownerId: string;
  providers: EnrichProvider[]; // ordem do cascade
  entity: EnrichEntity;
  ids: string[];
  mode: EnrichMode;
  dryRun: boolean;
}

export interface RunBatchResult {
  jobIds: string[];
  succeeded: number;
  failed: number;
  unchanged: number;
  creditsUsed: number;
  dryRun: boolean;
  preview?: Array<{
    entity_id: string;
    provider: EnrichProvider | null;
    update: Record<string, string | number | boolean | null>;
  }>;
}

export async function runEnrichmentBatch(opts: RunBatchOpts): Promise<RunBatchResult> {
  const { supabase, ownerId, providers, entity, ids, mode, dryRun } = opts;
  const table = entity === "lead" ? "leads" : "contacts";

  const cols =
    entity === "lead"
      ? "id, first_name, last_name, email, phone, company_name"
      : "id, first_name, last_name, email, phone, job_title, linkedin_url, company_name";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows, error } = await (supabase as any).from(table).select(cols).in("id", ids);
  if (error) throw new Error(error.message);
  const rowList = (rows ?? []) as Array<Record<string, unknown> & { id: string }>;

  // 1 job por provider (mantém histórico segmentado)
  const jobIds: string[] = [];
  const jobByProvider: Record<string, string> = {};
  if (!dryRun) {
    for (const p of providers) {
      const { data: job } = await supabase
        .from("enrichment_jobs")
        .insert({
          owner_id: ownerId,
          provider: p,
          kind: "enrich",
          entity,
          status: "running",
          total: rowList.length,
          started_at: new Date().toISOString(),
          scope: { ids, mode } as never,
        })
        .select("id")
        .single();
      if (job) {
        jobIds.push(job.id);
        jobByProvider[p] = job.id;
      }
    }
  }

  let succeeded = 0,
    failed = 0,
    unchanged = 0,
    credits = 0;
  const perJobCounts: Record<string, { ok: number; ko: number; cr: number }> = {};
  const preview: RunBatchResult["preview"] = [];

  for (const row of rowList) {
    let matchedProvider: EnrichProvider | null = null;
    let finalUpdate: Record<string, unknown> = {};
    let lastError: string | null = null;
    let currentBefore: Record<string, unknown> = { ...row };

    for (const provider of providers) {
      try {
        const fn = PROVIDER_FN[provider];
        const enriched = await fn({
          email: currentBefore.email as string | null,
          first_name: currentBefore.first_name as string | null,
          last_name: currentBefore.last_name as string | null,
          company_name: currentBefore.company_name as string | null,
          linkedin_url: currentBefore.linkedin_url as string | null,
        });
        if (!enriched) {
          perJobCounts[jobByProvider[provider]] ??= { ok: 0, ko: 0, cr: 0 };
          perJobCounts[jobByProvider[provider]].ko++;
          continue;
        }
        const update = computeUpdate(currentBefore, enriched, entity, mode);
        const j = jobByProvider[provider];
        perJobCounts[j] ??= { ok: 0, ko: 0, cr: 0 };
        if (Object.keys(update).length === 0) {
          perJobCounts[j].ok++;
          perJobCounts[j].cr++;
          credits++;
          continue;
        }
        // merge para cascade: campos novos disponíveis para o próximo provider
        finalUpdate = { ...finalUpdate, ...update };
        currentBefore = { ...currentBefore, ...update };
        matchedProvider = provider;
        perJobCounts[j].ok++;
        perJobCounts[j].cr++;
        credits++;
        if (!dryRun) {
          await supabase.from("enrichment_job_items").insert({
            job_id: j,
            entity_id: row.id,
            status: "ok",
            before: row as never,
            after: { ...row, ...update } as never,
          });
        }
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        const j = jobByProvider[provider];
        if (j && !dryRun) {
          await supabase.from("enrichment_job_items").insert({
            job_id: j,
            entity_id: row.id,
            status: "error",
            error: lastError,
          });
        }
        perJobCounts[j] ??= { ok: 0, ko: 0, cr: 0 };
        perJobCounts[j].ko++;
      }
    }

    if (Object.keys(finalUpdate).length > 0) {
      if (!dryRun) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from(table).update(finalUpdate).eq("id", row.id);
      }
      succeeded++;
    } else if (matchedProvider) {
      unchanged++;
    } else if (lastError) {
      failed++;
    } else {
      failed++;
    }
    preview.push({
      entity_id: row.id,
      provider: matchedProvider,
      update: finalUpdate as Record<string, string | number | boolean | null>,
    });
  }

  if (!dryRun) {
    for (const [provider, jobId] of Object.entries(jobByProvider)) {
      const c = perJobCounts[jobId] ?? { ok: 0, ko: 0, cr: 0 };
      await supabase
        .from("enrichment_jobs")
        .update({
          status: c.ko === 0 ? "done" : c.ok === 0 ? "failed" : "partial",
          processed: c.ok + c.ko,
          succeeded: c.ok,
          failed: c.ko,
          credits_used: c.cr,
          finished_at: new Date().toISOString(),
        })
        .eq("id", jobId);
      if (c.cr > 0) {
        await supabase.from("credit_ledger").insert({
          owner_id: ownerId,
          provider,
          job_id: jobId,
          delta: c.cr,
          reason: `Enriquecimento ${provider} (${c.ok} sucessos)`,
        });
      }
    }
  }

  return {
    jobIds,
    succeeded,
    failed,
    unchanged,
    creditsUsed: credits,
    dryRun,
    preview: dryRun ? preview : undefined,
  };
}
