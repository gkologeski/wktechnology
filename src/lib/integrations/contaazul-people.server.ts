// Conciliação de clientes/fornecedores do Conta Azul com Empresas/Contatos.
// Só grava na tabela de vínculos; nunca cria, renomeia ou mescla empresas.
import type { SupabaseClient } from "@supabase/supabase-js";

import { caFetchAll, getValidAccessToken } from "./contaazul-api.server";
import {
  buildNameIndex,
  matchPeople,
  suggestByName,
  type CaPerson,
  type LocalCompany,
  type LocalContact,
} from "./contaazul-reconcile";

export type PeopleAction = "confirm" | "choose" | "new" | "ignore" | "reopen";

export async function assertPeopleAccess(
  userClient: SupabaseClient,
  workspaceId: string,
  userId: string,
  action: "view" | "manage",
): Promise<void> {
  const { data, error } = await userClient.rpc("contaazul_people_access", {
    p_ws: workspaceId,
    p_user: userId,
    p_action: action,
  });
  if (error || data !== true)
    throw new Error("Sem permissão para conciliar clientes e fornecedores do Conta Azul.");
}

async function loadAll<T>(
  admin: SupabaseClient,
  table: "companies" | "contacts",
  columns: string,
  workspaceId: string,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from(table)
      .select(columns)
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** Lê pessoas da API e recalcula sugestões, preservando decisões humanas. */
export async function refreshPeopleLinks(
  admin: SupabaseClient,
  workspaceId: string,
): Promise<Record<string, number>> {
  const token = await getValidAccessToken(admin, workspaceId);
  const raw = await caFetchAll({ accessToken: token, path: "/v1/pessoas", pageSize: 500 });
  const people: Array<CaPerson & { profile: string | null }> = raw
    .filter((p) => p["id"] && p["nome"])
    .map((p) => ({
      id: String(p["id"]),
      name: String(p["nome"]),
      kind: p["tipo_pessoa"] === "Física" ? "person" : "company",
      document: (p["documento"] as string | null) ?? null,
      email: (p["email"] as string | null) ?? null,
      profile: Array.isArray(p["perfis"]) ? String(p["perfis"][0] ?? "") || null : null,
    }));

  const companies = (
    await loadAll<{ id: string; name: string | null; cnpj: string | null }>(
      admin,
      "companies",
      "id, name, cnpj",
      workspaceId,
    )
  ).map((c): LocalCompany => ({ id: c.id, name: c.name ?? "", cnpj: c.cnpj }));
  const contacts = (
    await loadAll<{
      id: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
    }>(admin, "contacts", "id, first_name, last_name, email", workspaceId)
  ).map(
    (c): LocalContact => ({
      id: c.id,
      fullName: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
      email: c.email,
    }),
  );

  const { data: existing, error: exErr } = await admin
    .from("contaazul_person_links")
    .select("contaazul_id, status")
    .eq("workspace_id", workspaceId);
  if (exErr) throw new Error(exErr.message);
  const decided = new Set(
    (existing ?? [])
      .filter((r) => r.status === "confirmed" || r.status === "ignored")
      .map((r) => r.contaazul_id),
  );

  const matches = matchPeople(people, companies, contacts);
  const companyIndex = buildNameIndex(companies);
  const contactIndex = buildNameIndex(contacts.map((c) => ({ id: c.id, name: c.fullName })));
  const companyById = new Map(companies.map((c) => [c.id, c]));
  const contactById = new Map(contacts.map((c) => [c.id, c]));
  const label = (kind: string, id: string) =>
    kind === "company" ? (companyById.get(id)?.name ?? "") : (contactById.get(id)?.fullName ?? "");

  const counts: Record<string, number> = {};
  const rows = people.flatMap((p, i) => {
    if (decided.has(p.id)) {
      counts["preserved"] = (counts["preserved"] ?? 0) + 1;
      return [];
    }
    const m = matches[i]!;
    let status: string = m.outcome;
    let localId: string | null = null;
    let matchBy: string | null = null;
    let score: number | null = null;
    let candidates: Array<{ id: string; name: string; score: number | null }> = [];
    if (m.outcome === "linked") {
      localId = m.localId;
      matchBy = m.by;
      score = 1;
      candidates = [{ id: m.localId, name: label(p.kind, m.localId), score: 1 }];
    } else if (m.outcome === "review") {
      matchBy = "name";
      candidates = m.localIds.slice(0, 5).map((id) => ({ id, name: label(p.kind, id), score: 1 }));
    } else {
      const s = suggestByName(p.name, p.kind === "company" ? companyIndex : contactIndex);
      status = s.outcome;
      score = s.score;
      candidates = s.candidates;
      if (s.outcome !== "new") matchBy = "similar_name";
    }
    counts[status] = (counts[status] ?? 0) + 1;
    return [
      {
        workspace_id: workspaceId,
        contaazul_id: p.id,
        name: p.name.slice(0, 300),
        person_kind: p.kind,
        profile: p.profile,
        document: p.document,
        email: p.email,
        local_company_id: p.kind === "company" ? localId : null,
        local_contact_id: p.kind === "person" ? localId : null,
        status,
        match_by: matchBy,
        score,
        candidates,
        updated_at: new Date().toISOString(),
      },
    ];
  });

  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await admin
      .from("contaazul_person_links")
      .upsert(rows.slice(i, i + 200), { onConflict: "workspace_id,contaazul_id" });
    if (error) throw new Error(error.message);
  }
  counts["total"] = people.length;
  return counts;
}

/** Aplica a decisão humana. Valida que o registro escolhido é do mesmo workspace. */
export async function decidePeopleLinks(
  admin: SupabaseClient,
  opts: {
    workspaceId: string;
    userId: string;
    ids: string[];
    action: PeopleAction;
    localId?: string | null;
  },
): Promise<number> {
  const { data: links, error } = await admin
    .from("contaazul_person_links")
    .select("id, person_kind, status, local_company_id, local_contact_id, candidates")
    .eq("workspace_id", opts.workspaceId)
    .in("id", opts.ids);
  if (error) throw new Error(error.message);
  let changed = 0;
  for (const link of links ?? []) {
    const base = {
      decided_by: opts.userId,
      decided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    let patch: Record<string, unknown>;
    if (opts.action === "ignore") patch = { ...base, status: "ignored" };
    else if (opts.action === "new")
      patch = {
        ...base,
        status: "confirmed",
        match_by: "new_finance",
        local_company_id: null,
        local_contact_id: null,
      };
    else if (opts.action === "reopen")
      patch = { ...base, status: "review", decided_by: null, decided_at: null };
    else {
      const cands = (link.candidates ?? []) as Array<{ id: string }>;
      const target =
        opts.action === "choose"
          ? opts.localId
          : (link.local_company_id ??
            link.local_contact_id ??
            (cands.length === 1 ? cands[0]!.id : cands[0]?.id));
      if (!target) continue;
      const table = link.person_kind === "company" ? "companies" : "contacts";
      const { data: found } = await admin
        .from(table)
        .select("id")
        .eq("id", target)
        .eq("workspace_id", opts.workspaceId)
        .is("deleted_at", null)
        .maybeSingle();
      if (!found) throw new Error("O cadastro escolhido não pertence a este workspace.");
      patch = {
        ...base,
        status: "confirmed",
        match_by: opts.action === "choose" ? "manual" : "confirmed_suggestion",
        local_company_id: link.person_kind === "company" ? target : null,
        local_contact_id: link.person_kind === "person" ? target : null,
      };
    }
    const { error: upErr } = await admin
      .from("contaazul_person_links")
      .update(patch)
      .eq("id", link.id)
      .eq("workspace_id", opts.workspaceId);
    if (upErr) throw new Error(upErr.message);
    changed++;
  }
  return changed;
}
