// Two-way HubSpot sync — engine de PUSH (local → HubSpot) com detecção
// de conflitos por updated_at vs hs_lastmodifieddate.
//
// Conceito:
//  - Cada registro local tem (opcionalmente) uma linha em hubspot_sync_state
//    com `local_updated_at` (snapshot do updated_at local na última sync) e
//    `remote_updated_at` (snapshot do hs_lastmodifieddate na última sync).
//  - Para cada candidato a push:
//      • Se ainda não houver mapping → POST create no HubSpot e grava state.
//      • Se houver mapping:
//          local mudou?   = local.updated_at > state.local_updated_at
//          remote mudou?  = remote.hs_lastmodifieddate > state.remote_updated_at
//          - both → conflito (não envia, marca conflict_status='conflict')
//          - só local → PATCH update no HubSpot, atualiza state
//          - só remote ou nenhum → nada a fazer (o pull cuida do remote)
//
// Para chamada manual (botão na UI) ou cron leve (a cada 5 min).

import type { SupabaseClient } from "@supabase/supabase-js";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/hubspot";

export type SyncEntity = "contact" | "company" | "deal";

const HS_OBJECT_BY_ENTITY: Record<SyncEntity, string> = {
  contact: "contacts",
  company: "companies",
  deal: "deals",
};

const LOCAL_TABLE_BY_ENTITY: Record<SyncEntity, string> = {
  contact: "contacts",
  company: "companies",
  deal: "deals",
};

/** Propriedades HubSpot que precisamos pedir no GET pra avaliar mudança remota. */
const HS_PROPS_BY_ENTITY: Record<SyncEntity, string[]> = {
  contact: ["firstname", "lastname", "email", "phone", "company", "hs_lastmodifieddate"],
  company: ["name", "domain", "industry", "phone", "city", "state", "hs_lastmodifieddate"],
  deal: ["dealname", "amount", "dealstage", "pipeline", "closedate", "hs_lastmodifieddate"],
};

function hsHeaders(): Record<string, string> {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");
  if (!HUBSPOT_API_KEY) throw new Error("Conecte o HubSpot para continuar");
  return {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": HUBSPOT_API_KEY,
    "Content-Type": "application/json",
  };
}

async function hsRequest(path: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers: { ...hsHeaders(), ...((init.headers as Record<string, string>) ?? {}) },
  });
  const txt = await res.text();
  let body: unknown = null;
  try { body = txt ? JSON.parse(txt) : null; } catch { body = txt; }
  if (res.status === 404) throw Object.assign(new Error("hubspot_not_found"), { status: 404 });
  if (!res.ok) {
    throw new Error(`HubSpot [${res.status}] ${typeof body === "string" ? body : JSON.stringify(body)}`);
  }
  return (body ?? {}) as Record<string, unknown>;
}

/** Mapeia row local → properties do HubSpot. */
function toHubspotProps(entity: SyncEntity, row: Record<string, unknown>): Record<string, string> {
  const s = (v: unknown) => (v == null ? "" : String(v));
  if (entity === "contact") {
    return {
      firstname: s(row.first_name),
      lastname: s(row.last_name),
      email: s(row.email),
      phone: s(row.phone),
      company: s(row.company_name),
    };
  }
  if (entity === "company") {
    return {
      name: s(row.name),
      domain: s(row.domain ?? row.website),
      industry: s(row.industry),
      phone: s(row.phone),
      city: s(row.city),
      state: s(row.state),
    };
  }
  // deal
  return {
    dealname: s(row.name ?? row.title),
    amount: s(row.value),
    closedate: row.close_date ? new Date(row.close_date as string).toISOString() : "",
  };
}

const SELECT_BY_ENTITY: Record<SyncEntity, string> = {
  contact: "id, first_name, last_name, email, phone, company_name, updated_at",
  company: "id, name, domain, website, industry, phone, city, state, updated_at",
  deal:    "id, name, value, close_date, updated_at",
};

export type PushResult = {
  entity: SyncEntity;
  scanned: number;
  created: number;
  updated: number;
  conflicts: number;
  failed: number;
  errors: { local_id: string; message: string }[];
};

export async function pushEntity(
  supabase: SupabaseClient,
  ownerId: string,
  entity: SyncEntity,
  limit = 50,
): Promise<PushResult> {
  const out: PushResult = { entity, scanned: 0, created: 0, updated: 0, conflicts: 0, failed: 0, errors: [] };
  const table = LOCAL_TABLE_BY_ENTITY[entity];
  const hsObj = HS_OBJECT_BY_ENTITY[entity];
  const props = HS_PROPS_BY_ENTITY[entity].join(",");

  // 1) pega rows locais mais recentemente atualizadas
  const { data: rows, error } = await supabase
    .from(table)
    .select(SELECT_BY_ENTITY[entity])
    .eq("owner_id", ownerId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Falha ao ler ${table}: ${error.message}`);
  if (!rows || rows.length === 0) return out;
  out.scanned = rows.length;

  // 2) pega state existente
  const localIds = rows.map((r) => (r as { id: string }).id);
  const { data: stateRows } = await supabase
    .from("hubspot_sync_state")
    .select("id, local_id, hubspot_id, local_updated_at, remote_updated_at")
    .eq("owner_id", ownerId)
    .eq("entity", entity)
    .in("local_id", localIds);
  const stateByLocal = new Map<string, { id: string; hubspot_id: string; local_updated_at: string | null; remote_updated_at: string | null }>();
  for (const s of stateRows ?? []) {
    stateByLocal.set(s.local_id as string, {
      id: s.id as string,
      hubspot_id: s.hubspot_id as string,
      local_updated_at: s.local_updated_at as string | null,
      remote_updated_at: s.remote_updated_at as string | null,
    });
  }

  for (const r of rows as Array<Record<string, unknown>>) {
    const localId = r.id as string;
    const localUpdated = (r.updated_at as string) ?? new Date().toISOString();
    const state = stateByLocal.get(localId);
    try {
      const propsPayload = toHubspotProps(entity, r);

      // (a) sem mapping → cria no HubSpot
      if (!state) {
        const created = await hsRequest(`/crm/v3/objects/${hsObj}`, {
          method: "POST",
          body: JSON.stringify({ properties: propsPayload }),
        });
        const hsId = String((created as { id?: unknown }).id ?? "");
        const remoteUpdated = ((created as { properties?: { hs_lastmodifieddate?: string } }).properties?.hs_lastmodifieddate)
          ?? (created as { updatedAt?: string }).updatedAt
          ?? new Date().toISOString();
        await supabase.from("hubspot_sync_state").insert({
          owner_id: ownerId, entity, local_id: localId, hubspot_id: hsId,
          direction: "both",
          local_updated_at: localUpdated,
          remote_updated_at: remoteUpdated,
          last_pushed_at: new Date().toISOString(),
          last_synced_at: new Date().toISOString(),
          conflict_status: "ok",
          conflict_reason: null,
        } as never);
        out.created++;
        continue;
      }

      // (b) com mapping → busca remoto e compara
      let remote: Record<string, unknown> | null = null;
      try {
        remote = await hsRequest(`/crm/v3/objects/${hsObj}/${state.hubspot_id}?properties=${props}`);
      } catch (e) {
        const err = e as { status?: number; message?: string };
        if (err.status === 404) {
          // perdeu no HubSpot — recria
          const created = await hsRequest(`/crm/v3/objects/${hsObj}`, {
            method: "POST",
            body: JSON.stringify({ properties: propsPayload }),
          });
          const newHsId = String((created as { id?: unknown }).id ?? "");
          await supabase.from("hubspot_sync_state").update({
            hubspot_id: newHsId,
            local_updated_at: localUpdated,
            remote_updated_at: new Date().toISOString(),
            last_pushed_at: new Date().toISOString(),
            last_synced_at: new Date().toISOString(),
            conflict_status: "ok", conflict_reason: null,
          } as never).eq("id", state.id);
          out.created++;
          continue;
        }
        throw e;
      }

      const remoteLastMod = ((remote as { properties?: { hs_lastmodifieddate?: string } }).properties?.hs_lastmodifieddate)
        ?? (remote as { updatedAt?: string }).updatedAt
        ?? null;

      const localChanged = !state.local_updated_at || new Date(localUpdated) > new Date(state.local_updated_at);
      const remoteChanged = !!remoteLastMod && (!state.remote_updated_at || new Date(remoteLastMod) > new Date(state.remote_updated_at));

      if (!localChanged) {
        // nada a empurrar; sincroniza watermark remoto se mudou
        if (remoteChanged && remoteLastMod) {
          await supabase.from("hubspot_sync_state").update({
            remote_updated_at: remoteLastMod,
            last_synced_at: new Date().toISOString(),
          } as never).eq("id", state.id);
        }
        continue;
      }

      if (localChanged && remoteChanged) {
        // CONFLITO
        await supabase.from("hubspot_sync_state").update({
          conflict_status: "conflict",
          conflict_reason: `Local e HubSpot foram alterados desde a última sincronização (local: ${localUpdated}; hubspot: ${remoteLastMod}).`,
        } as never).eq("id", state.id);
        out.conflicts++;
        continue;
      }

      // Só local mudou → PATCH
      await hsRequest(`/crm/v3/objects/${hsObj}/${state.hubspot_id}`, {
        method: "PATCH",
        body: JSON.stringify({ properties: propsPayload }),
      });
      await supabase.from("hubspot_sync_state").update({
        local_updated_at: localUpdated,
        remote_updated_at: remoteLastMod ?? state.remote_updated_at ?? new Date().toISOString(),
        last_pushed_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
        conflict_status: "ok", conflict_reason: null,
      } as never).eq("id", state.id);
      out.updated++;
    } catch (e) {
      out.failed++;
      out.errors.push({ local_id: localId, message: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}

/** Empurra as 3 entidades para um workspace. */
export async function pushAllForOwner(supabase: SupabaseClient, ownerId: string, perEntityLimit = 50) {
  const results: PushResult[] = [];
  for (const e of ["contact", "company", "deal"] as SyncEntity[]) {
    try {
      results.push(await pushEntity(supabase, ownerId, e, perEntityLimit));
    } catch (err) {
      results.push({
        entity: e, scanned: 0, created: 0, updated: 0, conflicts: 0, failed: 1,
        errors: [{ local_id: "-", message: err instanceof Error ? err.message : String(err) }],
      });
    }
  }
  return results;
}

/** Resolve um conflito forçando o lado escolhido. */
export async function resolveConflictRow(
  supabase: SupabaseClient,
  ownerId: string,
  stateId: string,
  strategy: "local_wins" | "remote_wins",
): Promise<{ ok: true }> {
  const { data: state } = await supabase
    .from("hubspot_sync_state")
    .select("id, entity, local_id, hubspot_id")
    .eq("id", stateId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (!state) throw new Error("Mapeamento não encontrado");
  const entity = state.entity as SyncEntity;
  const hsObj = HS_OBJECT_BY_ENTITY[entity];
  const table = LOCAL_TABLE_BY_ENTITY[entity];

  if (strategy === "local_wins") {
    const { data: row } = await supabase
      .from(table)
      .select(SELECT_BY_ENTITY[entity])
      .eq("id", state.local_id as string)
      .maybeSingle();
    if (!row) throw new Error("Registro local não existe mais");
    await hsRequest(`/crm/v3/objects/${hsObj}/${state.hubspot_id}`, {
      method: "PATCH",
      body: JSON.stringify({ properties: toHubspotProps(entity, row as Record<string, unknown>) }),
    });
    await supabase.from("hubspot_sync_state").update({
      conflict_status: "ok", conflict_reason: null,
      local_updated_at: (row as { updated_at?: string }).updated_at ?? new Date().toISOString(),
      remote_updated_at: new Date().toISOString(),
      last_pushed_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    } as never).eq("id", state.id as string);
    return { ok: true };
  }

  // remote_wins → marca como resolvido; o tick de pull cuida do pull
  await supabase.from("hubspot_sync_state").update({
    conflict_status: "ok", conflict_reason: null,
    remote_updated_at: new Date().toISOString(),
    last_synced_at: new Date().toISOString(),
  } as never).eq("id", state.id as string);
  return { ok: true };
}
