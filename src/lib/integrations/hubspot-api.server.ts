// Cliente HTTP do HubSpot (via gateway), descoberta de propriedades e mapeadores
// de payload HubSpot -> tabelas locais. Extraído de hubspot-steps.server.ts.
import type { SupabaseClient } from "@supabase/supabase-js";

export const GATEWAY_URL = "https://connector-gateway.lovable.dev/hubspot";

export function hsHeaders() {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");
  const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
  if (!HUBSPOT_API_KEY) throw new Error("Conecte o HubSpot para continuar");
  return {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": HUBSPOT_API_KEY,
    "Content-Type": "application/json",
  } as Record<string, string>;
}

export async function hsFetch(path: string, params?: Record<string, string>) {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  const res = await fetch(`${GATEWAY_URL}${path}${qs}`, { headers: hsHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(`HubSpot [${res.status}]: ${JSON.stringify(data).slice(0, 300)}`);
  return data;
}

export async function hsPost(path: string, body: object) {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    method: "POST",
    headers: hsHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok)
    throw new Error(`HubSpot POST [${res.status}] ${path}: ${JSON.stringify(data).slice(0, 300)}`);
  return data;
}

export async function discoverTotal(objectType: string): Promise<number | null> {
  try {
    const r = (await hsPost(`/crm/v3/objects/${objectType}/search`, {
      limit: 1,
      properties: ["hs_object_id"],
      filterGroups: [],
    })) as { total?: number };
    return typeof r.total === "number" ? r.total : null;
  } catch {
    return null;
  }
}

export async function getAssoc(fromObj: string, fromId: string, toObj: string): Promise<string[]> {
  try {
    const r = (await hsFetch(`/crm/v3/objects/${fromObj}/${fromId}/associations/${toObj}`)) as {
      results?: { id?: string | number; toObjectId?: string | number }[];
    };
    return (r.results ?? []).map((x) => String(x.id ?? x.toObjectId)).filter(Boolean);
  } catch {
    return [];
  }
}

// Busca associações em lote usando o endpoint v4 (até 1000 IDs por request).
// Reduz milhares de chamadas individuais para dezenas de batches.
// Se o batch v4 falhar, faz fallback para getAssoc individual em paralelo.
export async function getAssocMany(
  fromObj: string,
  fromIds: string[],
  toObj: string,
  _concurrency = 20,
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  const BATCH = 1000;
  for (let i = 0; i < fromIds.length; i += BATCH) {
    const chunk = fromIds.slice(i, i + BATCH);
    try {
      const r = (await hsPost(`/crm/v4/associations/${fromObj}/${toObj}/batch/read`, {
        inputs: chunk.map((id) => ({ id })),
      })) as {
        results?: {
          from?: { id?: string | number };
          to?: { toObjectId?: string | number; id?: string | number }[];
        }[];
      };
      for (const row of r.results ?? []) {
        const fromId = String(row.from?.id ?? "");
        if (!fromId) continue;
        const tos = (row.to ?? []).map((t) => String(t.toObjectId ?? t.id ?? "")).filter(Boolean);
        out.set(fromId, tos);
      }
      for (const id of chunk) if (!out.has(id)) out.set(id, []);
    } catch {
      // Fallback: chamadas individuais em paralelo (20 por vez)
      for (let j = 0; j < chunk.length; j += 20) {
        const sub = chunk.slice(j, j + 20);
        const results = await Promise.all(sub.map((id) => getAssoc(fromObj, id, toObj)));
        sub.forEach((id, idx) => out.set(id, results[idx]));
      }
    }
  }
  return out;
}

export type HSRec = {
  id: string;
  properties: Record<string, string | null | undefined>;
  createdAt?: string;
  updatedAt?: string;
};

export async function batchRead(
  obj: string,
  ids: string[],
  properties: string[],
): Promise<HSRec[]> {
  const out: HSRec[] = [];
  const unique = Array.from(new Set(ids));
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    try {
      const r = (await hsPost(`/crm/v3/objects/${obj}/batch/read`, {
        properties,
        inputs: chunk.map((id) => ({ id })),
      })) as { results?: HSRec[] };
      out.push(...(r.results ?? []));
    } catch {
      // skip chunk
    }
  }
  return out;
}

// ─── Property discovery + value parsing helpers ──────────────────────────────

// In-request cache (each tick runs one step in one HTTP request, so this is enough).
export const propertyCache = new Map<string, string[]>();

export async function loadHsProperties(objectType: string): Promise<string[]> {
  const cached = propertyCache.get(objectType);
  if (cached) return cached;
  try {
    const r = (await hsFetch(`/crm/v3/properties/${objectType}`)) as {
      results?: { name: string; hidden?: boolean; calculated?: boolean }[];
    };
    const names = (r.results ?? [])
      .filter((p) => !p.hidden && !p.calculated)
      .map((p) => p.name)
      .filter(Boolean);
    // Cap to avoid HubSpot payload limits (~600 properties is the documented max).
    const capped = names.slice(0, 400);
    propertyCache.set(objectType, capped);
    return capped;
  } catch {
    propertyCache.set(objectType, []);
    return [];
  }
}

export function parseHsDate(v: string | null | undefined): string | null {
  if (!v) return null;
  // HubSpot returns either ISO 8601 or epoch milliseconds as string.
  if (/^\d+$/.test(v)) {
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return new Date(n).toISOString();
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function parseHsNum(v: string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export type HsProps = Record<string, string | null | undefined>;

export function mapCompany(p: HsProps) {
  return {
    annualrevenue: parseHsNum(p.annualrevenue),
    lifecyclestage: p.lifecyclestage ?? null,
    hs_lead_status: p.hs_lead_status ?? null,
    description: p.description ?? null,
    country: p.country ?? null,
    timezone: p.timezone ?? null,
    hubspot_owner_id: p.hubspot_owner_id ?? null,
    hs_object_id: p.hs_object_id ?? null,
    hs_createdate: parseHsDate(p.createdate ?? p.hs_createdate),
    hs_lastmodifieddate: parseHsDate(p.hs_lastmodifieddate ?? p.lastmodifieddate),
    type: p.type ?? null,
    linkedin_company_page: p.linkedin_company_page ?? null,
    twitterhandle: p.twitterhandle ?? null,
    facebook_company_page: p.facebook_company_page ?? null,
  };
}

export function mapContact(p: HsProps) {
  return {
    mobile_phone: p.mobilephone ?? null,
    country: p.country ?? null,
    address: p.address ?? null,
    cep: p.zip ?? null,
    city: p.city ?? null,
    state: p.state ?? null,
    website: p.website ?? null,
    company_name: p.company ?? null,
    lifecyclestage: p.lifecyclestage ?? null,
    hs_lead_status: p.hs_lead_status ?? null,
    hubspot_owner_id: p.hubspot_owner_id ?? null,
    hs_object_id: p.hs_object_id ?? null,
    hs_createdate: parseHsDate(p.createdate ?? p.hs_createdate),
    hs_lastmodifieddate: parseHsDate(p.lastmodifieddate ?? p.hs_lastmodifieddate),
    linkedin_url: p.linkedin_url ?? p.linkedinbio ?? null,
    twitter_handle: p.twitterhandle ?? null,
  };
}

export function mapDeal(p: HsProps) {
  return {
    description: p.description ?? null,
    dealtype: p.dealtype ?? null,
    hs_priority: p.hs_priority ?? null,
    hs_deal_stage_probability: parseHsNum(p.hs_deal_stage_probability),
    hubspot_owner_id: p.hubspot_owner_id ?? null,
    hs_object_id: p.hs_object_id ?? null,
    hs_createdate: parseHsDate(p.createdate ?? p.hs_createdate),
    hs_lastmodifieddate: parseHsDate(p.hs_lastmodifieddate),
    closed_lost_reason: p.closed_lost_reason ?? null,
    closed_won_reason: p.closed_won_reason ?? null,
    num_associated_contacts:
      parseHsNum(p.num_associated_contacts) !== null
        ? Math.trunc(parseHsNum(p.num_associated_contacts) as number)
        : null,
  };
}

export function mapLead(p: HsProps) {
  return {
    hubspot_owner_id: p.hubspot_owner_id ?? null,
    hs_object_id: p.hs_object_id ?? null,
    hs_createdate: parseHsDate(p.createdate ?? p.hs_createdate),
    hs_lastmodifieddate: parseHsDate(p.lastmodifieddate ?? p.hs_lastmodifieddate),
    hs_lead_source_detail: p.hs_analytics_source_data_1 ?? p.hs_analytics_source ?? null,
  };
}

export function mapActivity(kind: string, p: HsProps) {
  const ms = parseHsNum(p.hs_call_duration) ?? parseHsNum(p.hs_meeting_duration) ?? null;
  return {
    duration_ms: ms !== null ? Math.trunc(ms) : null,
    disposition: p.hs_call_disposition ?? null,
    recording_url: p.hs_call_recording_url ?? null,
    meeting_outcome: p.hs_meeting_outcome ?? null,
    meeting_location: p.hs_meeting_location ?? null,
    task_status: p.hs_task_status ?? null,
    task_priority: p.hs_task_priority ?? null,
    email_direction: p.hs_email_direction ?? null,
    email_status: p.hs_email_status ?? null,
    hubspot_owner_id: p.hubspot_owner_id ?? p.hubspot_owner_id_owner ?? null,
    hs_object_id: p.hs_object_id ?? null,
    hs_createdate: parseHsDate(p.hs_createdate ?? p.createdate),
    hs_lastmodifieddate: parseHsDate(p.hs_lastmodifieddate ?? p.lastmodifieddate),
  };
}

export function mapTicket(p: HsProps) {
  return {
    hubspot_owner_id: p.hubspot_owner_id ?? null,
    hs_object_id: p.hs_object_id ?? null,
    hs_createdate: parseHsDate(p.createdate ?? p.hs_createdate),
    hs_lastmodifieddate: parseHsDate(p.hs_lastmodifieddate ?? p.lastmodifieddate),
  };
}

export function mapHsTicketPriority(
  v: string | null | undefined,
): "low" | "medium" | "high" | "urgent" {
  const s = (v ?? "").toLowerCase();
  if (s === "low") return "low";
  if (s === "high") return "high";
  if (s === "urgent") return "urgent";
  return "medium";
}

export function rawOf(rec: {
  id: string;
  properties: HsProps;
  createdAt?: string;
  updatedAt?: string;
}) {
  return {
    id: rec.id,
    properties: rec.properties,
    createdAt: rec.createdAt ?? null,
    updatedAt: rec.updatedAt ?? null,
  } as never;
}
