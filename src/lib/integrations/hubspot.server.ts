// Helpers, tipos, schemas e chamadas HTTP do HubSpot.
// Separado de hubspot.functions.ts porque módulos que declaram createServerFn
// precisam ser wrappers finos: o transform tss-serverfn-split remove os
// declarações irmãs e elas viram ReferenceError em runtime.
import { z } from "zod";

export const GATEWAY_URL = "https://connector-gateway.lovable.dev/hubspot";

// ─────────────────────────── HTTP helpers ─────────────────────────────────────
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

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function parseHsDate(v: string | null | undefined): string | null {
  if (!v) return null;
  if (/^\d+$/.test(v)) {
    const n = Number(v);
    return Number.isFinite(n) ? new Date(n).toISOString() : null;
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function originalCreatedAt(
  p: Record<string, string | null | undefined>,
  createdAt?: string,
): Record<string, string> {
  const value = parseHsDate(p.createdate ?? p.hs_createdate ?? createdAt);
  return value ? { created_at: value, hs_createdate: value } : {};
}

// ─────────────────────────── Cache em memória (TTL) ──────────────────────────
// Persiste entre chamadas do server function dentro do mesmo Worker, reduzindo
// drasticamente o nº de requests ao HubSpot quando o wizard conta os objetos
// um a um. TTL curto para refletir mudanças recentes na conta.
export const CACHE_TTL_MS = 5 * 60 * 1000;

export type CacheEntry<T> = { value: T; expires: number };

export const memCache = new Map<string, CacheEntry<unknown>>();

export function cacheGet<T>(key: string): T | undefined {
  const e = memCache.get(key);
  if (!e) return undefined;
  if (e.expires < Date.now()) {
    memCache.delete(key);
    return undefined;
  }
  return e.value as T;
}

export function cacheSet<T>(key: string, value: T) {
  memCache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
}

export async function searchTotal(obj: string, body: object = {}): Promise<number> {
  const key = `searchTotal:${obj}:${JSON.stringify(body)}`;
  const hit = cacheGet<number>(key);
  if (hit !== undefined) return hit;
  try {
    const r = (await hsPost(`/crm/v3/objects/${obj}/search`, { limit: 1, ...body })) as {
      total?: number;
    };
    const total = r.total ?? 0;
    cacheSet(key, total);
    return total;
  } catch {
    return 0;
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

// Lê associações em lote via v4 (até 1000 inputs por request). Reduz N
// chamadas (uma por ID) para ceil(N/1000) — peça-chave para evitar rate-limit.
export async function assocBatchRead(
  fromObj: string,
  fromIds: string[],
  toObj: string,
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  const unique = Array.from(new Set(fromIds));
  for (let i = 0; i < unique.length; i += 1000) {
    const chunk = unique.slice(i, i + 1000);
    try {
      const r = (await hsPost(`/crm/v4/associations/${fromObj}/${toObj}/batch/read`, {
        inputs: chunk.map((id) => ({ id })),
      })) as {
        results?: { from?: { id?: string | number }; to?: { toObjectId?: string | number }[] }[];
      };
      for (const row of r.results ?? []) {
        const fid = String(row.from?.id ?? "");
        if (!fid) continue;
        const ids = (row.to ?? []).map((t) => String(t.toObjectId ?? "")).filter(Boolean);
        const prev = out.get(fid) ?? [];
        out.set(fid, prev.concat(ids));
      }
    } catch {
      // Fallback: per-ID v3 só para o chunk que falhou.
      for (const id of chunk) out.set(id, await getAssoc(fromObj, id, toObj));
    }
    await sleep(100);
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
    await sleep(150);
  }
  return out;
}

// Lista TODOS os registros de um objeto, paginando até esgotar.
// Quando `associations` é informado, cada registro retornado inclui
// `associations: { <toObj>: { results: [{ id }] } }` (best-effort).
export type HSAssocList = { results?: { id?: string | number; toObjectId?: string | number }[] };

export type HSRecWithAssoc = HSRec & { associations?: Record<string, HSAssocList> };

export async function listAll(
  obj: string,
  properties: string[],
  associations: string[] = [],
): Promise<HSRecWithAssoc[]> {
  const out: HSRecWithAssoc[] = [];
  let after: string | undefined;
  // safety cap to avoid runaway loops on broken pagination
  for (let page = 0; page < 2000; page++) {
    const params: Record<string, string> = {
      limit: "100",
      properties: properties.join(","),
    };
    if (associations.length) params.associations = associations.join(",");
    if (after) params.after = after;
    const r = (await hsFetch(`/crm/v3/objects/${obj}`, params)) as {
      results: HSRecWithAssoc[];
      paging?: { next?: { after: string } };
    };
    if (r.results?.length) out.push(...r.results);
    after = r.paging?.next?.after;
    if (!after) break;
    await sleep(120);
  }
  return out;
}

export function firstAssocId(rec: HSRecWithAssoc, toObj: string): string | null {
  const list = rec.associations?.[toObj]?.results ?? [];
  const first = list[0];
  if (!first) return null;
  const id = first.id ?? first.toObjectId;
  return id ? String(id) : null;
}

export function allAssocIds(rec: HSRecWithAssoc, toObj: string): string[] {
  const list = rec.associations?.[toObj]?.results ?? [];
  return list.map((x) => String(x.id ?? x.toObjectId)).filter(Boolean);
}

// ─────────────────────────── Pipelines (estrutura) ───────────────────────────
export type HSStage = {
  id: string;
  label: string;
  displayOrder?: number;
  metadata?: { probability?: string; isClosed?: string };
};

export type HSPipeline = {
  id: string;
  label: string;
  displayOrder?: number;
  stages: HSStage[];
};

export type LocalStage = {
  id: string; // local stable id (= hubspot stage id)
  hubspot_id: string;
  label: string;
  order: number;
  probability: number | null;
  is_closed: boolean;
};

export type PipelineMaps = {
  // hubspotPipelineId → { localPipelineId, defaultStageId }
  pipelines: Map<string, { localId: string; defaultStageId: string | null }>;
  // hubspotStageId → { localPipelineId, stageId, label, probability }
  stages: Map<
    string,
    { localPipelineId: string; stageId: string; label: string; probability: number | null }
  >;
};

// Heurística: mapeia label/probabilidade do estágio HubSpot para o enum local deal_stage.
export function mapDealStageEnum(
  label: string | undefined,
  probability: number | null,
  isClosed: boolean,
): string {
  const l = (label ?? "").toLowerCase();
  if (isClosed) {
    if (probability !== null && probability >= 1) return "won";
    if (l.includes("won") || l.includes("ganho")) return "won";
    return "lost";
  }
  if (l.includes("propos")) return "proposal";
  if (l.includes("negocia") || l.includes("negotia")) return "negotiation";
  if (l.includes("qualif")) return "qualified";
  if (probability !== null) {
    if (probability >= 0.75) return "negotiation";
    if (probability >= 0.5) return "proposal";
    if (probability >= 0.25) return "qualified";
  }
  return "new";
}

export function mapLeadStatusEnum(
  category: string | undefined,
  label?: string | undefined,
): string {
  const c = (category ?? "").toUpperCase();
  if (c === "UNQUALIFIED") return "disqualified";
  if (c === "QUALIFIED") return "qualified";
  if (c === "CONNECTED" || c === "ATTEMPTING" || c === "IN_PROGRESS") return "contacted";
  if (c === "NEW") return "new";
  // fallback por label (unqual ANTES de qualif para evitar match parcial)
  const l = (label ?? "").toLowerCase();
  if (l.includes("unqual") || l.includes("descart") || l.includes("perdid") || l.includes("lost"))
    return "disqualified";
  if (l.includes("qualif")) return "qualified";
  if (l.includes("contat") || l.includes("contact")) return "contacted";
  return "new";
}

export async function syncDealPipelines(
  supabase: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  workspaceId: string,
  userId: string,
): Promise<PipelineMaps> {
  const res = (await hsFetch("/crm/v3/pipelines/deals")) as { results: HSPipeline[] };
  const maps: PipelineMaps = { pipelines: new Map(), stages: new Map() };
  for (const p of res.results ?? []) {
    const stages: LocalStage[] = (p.stages ?? [])
      .slice()
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
      .map((s) => ({
        id: s.id,
        hubspot_id: s.id,
        label: s.label,
        order: s.displayOrder ?? 0,
        probability: s.metadata?.probability ? Number(s.metadata.probability) : null,
        is_closed: s.metadata?.isClosed === "true",
      }));

    // Procura pipeline local pelo hubspot_id em config
    const { data: existing } = await supabase
      .from("pipelines")
      .select("id, config, stages")
      .eq("workspace_id", workspaceId)
      .eq("entity", "deal")
      .eq("config->>hubspot_id", p.id)
      .maybeSingle();

    let localId: string;
    if (existing?.id) {
      localId = existing.id as string;
      await supabase
        .from("pipelines")
        .update({
          name: p.label,
          stages: stages as never,
          config: { hubspot_id: p.id, hubspot_display_order: p.displayOrder ?? 0 } as never,
        })
        .eq("id", localId);
    } else {
      const { data: ins } = await supabase
        .from("pipelines")
        .insert({
          owner_id: userId,
          workspace_id: workspaceId,
          entity: "deal",
          name: p.label,
          stages: stages as never,
          is_default: p.id === "default",
          config: { hubspot_id: p.id, hubspot_display_order: p.displayOrder ?? 0 } as never,
        })
        .select("id")
        .single();
      localId = ins!.id as string;
    }

    maps.pipelines.set(p.id, { localId, defaultStageId: stages[0]?.id ?? null });
    for (const s of stages) {
      maps.stages.set(s.id, {
        localPipelineId: localId,
        stageId: s.id,
        label: s.label,
        probability: s.probability,
      });
    }
  }
  return maps;
}

export async function syncLeadPipeline(
  supabase: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  workspaceId: string,
  userId: string,
): Promise<{
  localPipelineId: string;
  stageByValue: Map<string, { stageId: string; label: string }>;
}> {
  // HubSpot não tem pipeline de leads — usa as opções da propriedade hs_lead_status
  type Opt = { label: string; value: string; displayOrder?: number };
  let options: Opt[] = [];
  try {
    const r = (await hsFetch("/crm/v3/properties/contacts/hs_lead_status")) as { options?: Opt[] };
    options = (r.options ?? [])
      .slice()
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  } catch {
    /* ignore */
  }
  if (!options.length) {
    options = [
      { label: "Novo", value: "NEW" },
      { label: "Tentativa de contato", value: "ATTEMPTED" },
      { label: "Em contato", value: "CONNECTED" },
      { label: "Boa oportunidade", value: "OPEN_DEAL" },
      { label: "Sem qualificação", value: "UNQUALIFIED" },
    ];
  }
  const stages: LocalStage[] = options.map((o, i) => ({
    id: o.value,
    hubspot_id: o.value,
    label: o.label,
    order: o.displayOrder ?? i,
    probability: null,
    is_closed: o.value.toUpperCase().includes("UNQUAL") || o.value.toUpperCase().includes("LOST"),
  }));

  const { data: existing } = await supabase
    .from("pipelines")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("entity", "lead")
    .eq("config->>hubspot_source", "hs_lead_status")
    .maybeSingle();

  let localId: string;
  if (existing?.id) {
    localId = existing.id as string;
    await supabase
      .from("pipelines")
      .update({ stages: stages as never, name: "HubSpot Leads" })
      .eq("id", localId);
  } else {
    const { data: ins } = await supabase
      .from("pipelines")
      .insert({
        owner_id: userId,
        workspace_id: workspaceId,
        entity: "lead",
        name: "HubSpot Leads",
        stages: stages as never,
        is_default: true,
        config: { hubspot_source: "hs_lead_status" } as never,
      })
      .select("id")
      .single();
    localId = ins!.id as string;
  }
  const stageByValue = new Map<string, { stageId: string; label: string }>();
  for (const s of stages) stageByValue.set(s.id, { stageId: s.id, label: s.label });
  return { localPipelineId: localId, stageByValue };
}

// ─────────────────────────── Counts (preview) ─────────────────────────────────
export const ObjectKey = z.enum([
  "companies",
  "contacts",
  "deals",
  "leads",
  "tickets",
  "activities",
]);

export type ObjectKey = z.infer<typeof ObjectKey>;

export const LOCAL_TABLE: Record<
  ObjectKey,
  "companies" | "contacts" | "deals" | "leads" | "tickets" | "activities"
> = {
  companies: "companies",
  contacts: "contacts",
  deals: "deals",
  leads: "leads",
  tickets: "tickets",
  activities: "activities",
};

// Busca os primeiros N IDs de empresas no HubSpot (mesma ordem usada na importação).
// Resultado cacheado por `limit` — chamadas subsequentes do wizard reaproveitam.
export async function fetchCompanyIdsCount(limit: number): Promise<string[]> {
  const cacheKey = `companyIds:${limit}`;
  const hit = cacheGet<string[]>(cacheKey);
  if (hit) return hit;

  const ids: string[] = [];
  let after: string | undefined;
  while (ids.length < limit) {
    const remaining = limit - ids.length;
    const body: Record<string, unknown> = {
      limit: Math.min(100, remaining),
      properties: ["hs_object_id"],
      sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }],
    };
    if (after) body.after = after;
    try {
      const r = (await hsPost("/crm/v3/objects/companies/search", body)) as {
        results?: { id: string }[];
        paging?: { next?: { after: string } };
      };
      for (const x of r.results ?? []) ids.push(x.id);
      after = r.paging?.next?.after;
      if (!after) break;
    } catch {
      break;
    }
  }
  const result = ids.slice(0, limit);
  cacheSet(cacheKey, result);
  return result;
}

// Assinatura estável do escopo de origem (independente da ordem) — usada como
// chave de cache da união de associações.
export function scopeSig(ids: string[]): string {
  if (ids.length === 0) return "∅";
  if (ids.length <= 50) return [...ids].sort().join(",");
  // Para escopos maiores, hash simples (FNV-1a 32-bit) sobre IDs ordenados.
  let h = 0x811c9dc5;
  for (const id of [...ids].sort()) {
    for (let i = 0; i < id.length; i++) {
      h ^= id.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    h ^= 44;
  }
  return `${ids.length}:${h.toString(16)}`;
}

// União de IDs associados a uma lista de origens.
// Otimizações:
//  • Cache por (fromObj→toObj, escopo) — evita recomputar entre chamadas do wizard.
//  • Lote v4 (até 1000 inputs por request) — 100× menos chamadas vs. per-ID.
export async function unionAssocIds(
  fromObj: string,
  fromIds: string[],
  toObj: string,
): Promise<Set<string>> {
  if (fromIds.length === 0) return new Set();
  const cacheKey = `union:${fromObj}→${toObj}:${scopeSig(fromIds)}`;
  const hit = cacheGet<string[]>(cacheKey);
  if (hit) return new Set(hit);

  const batched = await assocBatchRead(fromObj, fromIds, toObj);
  const out = new Set<string>();
  for (const arr of batched.values()) for (const x of arr) out.add(x);
  cacheSet(cacheKey, [...out]);
  return out;
}

// ─────────────────────────── Import orchestrator ──────────────────────────────
export const ScopeSchema = z
  .object({
    mode: z.enum(["linked", "full"]).default("linked"),
    companies: z.boolean().default(true),
    contacts: z.boolean().default(true),
    deals: z.boolean().default(true),
    leads: z.boolean().default(false),
    tickets: z.boolean().default(false),
    activities: z.boolean().default(false),
    maxCompanies: z.number().int().min(1).max(2000).optional(),
    maxPerObject: z.number().int().min(1).max(2000).optional(),
  })
  .transform((v) => ({
    ...v,
    maxCompanies: v.maxCompanies ?? v.maxPerObject ?? 200,
  }));

export type Scope = z.infer<typeof ScopeSchema>;

export type LogEntry = {
  ts: string;
  level: "info" | "warn" | "error";
  step: string;
  message: string;
  count?: number;
};

export const STEP_ORDER = [
  "companies",
  "contacts",
  "deals",
  "leads",
  "tickets",
  "activities",
] as const;

export type StepName = (typeof STEP_ORDER)[number];

export const STEP_DEPS: Record<StepName, StepName[]> = {
  companies: [],
  contacts: ["companies"],
  deals: ["companies", "contacts"],
  leads: [],
  tickets: [],
  activities: ["contacts", "companies", "deals"],
};

export function planSteps(scope: Scope): StepName[] {
  const wanted = new Set<StepName>();
  if (scope.companies) wanted.add("companies");
  if (scope.contacts) {
    wanted.add("companies");
    wanted.add("contacts");
  }
  if (scope.deals) {
    wanted.add("companies");
    wanted.add("contacts");
    wanted.add("deals");
  }
  if (scope.leads) {
    wanted.add("leads");
  }
  if (scope.tickets) {
    wanted.add("tickets");
  }
  if (scope.activities) {
    wanted.add("companies");
    wanted.add("contacts");
    wanted.add("activities");
  }
  return STEP_ORDER.filter((s) => wanted.has(s));
}
