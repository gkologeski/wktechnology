// HubSpot import via Lovable Connector Gateway
// Cascata: Empresas (limitadas pelo usuário) → Contatos vinculados → Negócios vinculados
//          → Leads (contatos com lifecyclestage=lead) → Atividades vinculadas
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computePlannedCapped, type CountDeps } from "./hubspot-count";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/hubspot";

// ─────────────────────────── HTTP helpers ─────────────────────────────────────
function hsHeaders() {
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

async function hsFetch(path: string, params?: Record<string, string>) {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  const res = await fetch(`${GATEWAY_URL}${path}${qs}`, { headers: hsHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(`HubSpot [${res.status}]: ${JSON.stringify(data).slice(0, 300)}`);
  return data;
}

async function hsPost(path: string, body: object) {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    method: "POST",
    headers: hsHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`HubSpot POST [${res.status}] ${path}: ${JSON.stringify(data).slice(0, 300)}`);
  return data;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function parseHsDate(v: string | null | undefined): string | null {
  if (!v) return null;
  if (/^\d+$/.test(v)) {
    const n = Number(v);
    return Number.isFinite(n) ? new Date(n).toISOString() : null;
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function originalCreatedAt(p: Record<string, string | null | undefined>, createdAt?: string): Record<string, string> {
  const value = parseHsDate(p.createdate ?? p.hs_createdate ?? createdAt);
  return value ? { created_at: value, hs_createdate: value } : {};
}

// ─────────────────────────── Cache em memória (TTL) ──────────────────────────
// Persiste entre chamadas do server function dentro do mesmo Worker, reduzindo
// drasticamente o nº de requests ao HubSpot quando o wizard conta os objetos
// um a um. TTL curto para refletir mudanças recentes na conta.
const CACHE_TTL_MS = 5 * 60 * 1000;
type CacheEntry<T> = { value: T; expires: number };
const memCache = new Map<string, CacheEntry<unknown>>();
function cacheGet<T>(key: string): T | undefined {
  const e = memCache.get(key);
  if (!e) return undefined;
  if (e.expires < Date.now()) {
    memCache.delete(key);
    return undefined;
  }
  return e.value as T;
}
function cacheSet<T>(key: string, value: T) {
  memCache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
}

async function searchTotal(obj: string, body: object = {}): Promise<number> {
  const key = `searchTotal:${obj}:${JSON.stringify(body)}`;
  const hit = cacheGet<number>(key);
  if (hit !== undefined) return hit;
  try {
    const r = (await hsPost(`/crm/v3/objects/${obj}/search`, { limit: 1, ...body })) as { total?: number };
    const total = r.total ?? 0;
    cacheSet(key, total);
    return total;
  } catch {
    return 0;
  }
}

async function getAssoc(fromObj: string, fromId: string, toObj: string): Promise<string[]> {
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
async function assocBatchRead(
  fromObj: string,
  fromIds: string[],
  toObj: string
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

type HSRec = { id: string; properties: Record<string, string | null | undefined>; createdAt?: string; updatedAt?: string };

async function batchRead(obj: string, ids: string[], properties: string[]): Promise<HSRec[]> {
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
type HSAssocList = { results?: { id?: string | number; toObjectId?: string | number }[] };
type HSRecWithAssoc = HSRec & { associations?: Record<string, HSAssocList> };
async function listAll(
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

function firstAssocId(rec: HSRecWithAssoc, toObj: string): string | null {
  const list = rec.associations?.[toObj]?.results ?? [];
  const first = list[0];
  if (!first) return null;
  const id = first.id ?? first.toObjectId;
  return id ? String(id) : null;
}

function allAssocIds(rec: HSRecWithAssoc, toObj: string): string[] {
  const list = rec.associations?.[toObj]?.results ?? [];
  return list.map((x) => String(x.id ?? x.toObjectId)).filter(Boolean);
}

// ─────────────────────────── Pipelines (estrutura) ───────────────────────────
type HSStage = {
  id: string;
  label: string;
  displayOrder?: number;
  metadata?: { probability?: string; isClosed?: string };
};
type HSPipeline = {
  id: string;
  label: string;
  displayOrder?: number;
  stages: HSStage[];
};

type LocalStage = {
  id: string; // local stable id (= hubspot stage id)
  hubspot_id: string;
  label: string;
  order: number;
  probability: number | null;
  is_closed: boolean;
};

type PipelineMaps = {
  // hubspotPipelineId → { localPipelineId, defaultStageId }
  pipelines: Map<string, { localId: string; defaultStageId: string | null }>;
  // hubspotStageId → { localPipelineId, stageId, label, probability }
  stages: Map<string, { localPipelineId: string; stageId: string; label: string; probability: number | null }>;
};

// Heurística: mapeia label/probabilidade do estágio HubSpot para o enum local deal_stage.
function mapDealStageEnum(label: string | undefined, probability: number | null, isClosed: boolean): string {
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

function mapLeadStatusEnum(category: string | undefined, label?: string | undefined): string {
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

async function syncDealPipelines(
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

async function syncLeadPipeline(
  supabase: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  workspaceId: string,
  userId: string,
): Promise<{ localPipelineId: string; stageByValue: Map<string, { stageId: string; label: string }> }> {
  // HubSpot não tem pipeline de leads — usa as opções da propriedade hs_lead_status
  type Opt = { label: string; value: string; displayOrder?: number };
  let options: Opt[] = [];
  try {
    const r = (await hsFetch("/crm/v3/properties/contacts/hs_lead_status")) as { options?: Opt[] };
    options = (r.options ?? []).slice().sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
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
const ObjectKey = z.enum(["companies", "contacts", "deals", "leads", "tickets", "activities"]);
type ObjectKey = z.infer<typeof ObjectKey>;

const LOCAL_TABLE: Record<ObjectKey, "companies" | "contacts" | "deals" | "leads" | "tickets" | "activities"> = {
  companies: "companies",
  contacts: "contacts",
  deals: "deals",
  leads: "leads",
  tickets: "tickets",
  activities: "activities",
};

// Busca os primeiros N IDs de empresas no HubSpot (mesma ordem usada na importação).
// Resultado cacheado por `limit` — chamadas subsequentes do wizard reaproveitam.
async function fetchCompanyIdsCount(limit: number): Promise<string[]> {
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
function scopeSig(ids: string[]): string {
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
async function unionAssocIds(fromObj: string, fromIds: string[], toObj: string): Promise<Set<string>> {
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

export const countHubspotObjects = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        objects: z.array(ObjectKey).min(1),
        mode: z.enum(["linked", "full"]).default("linked"),
        maxCompanies: z.number().min(1).max(2000).default(200),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    async function localCount(key: ObjectKey): Promise<number> {
      const table = key === "activities" ? "activities" : key;
      const { count } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });
      return count ?? 0;
    }

    async function remoteCount(key: ObjectKey): Promise<number> {
      if (key === "companies") return searchTotal("companies");
      if (key === "contacts") return searchTotal("contacts");
      if (key === "deals") return searchTotal("deals");
      if (key === "leads") return searchTotal("leads");
      if (key === "tickets") return searchTotal("tickets");
      const parts = await Promise.all([
        searchTotal("notes"),
        searchTotal("calls"),
        searchTotal("meetings"),
        searchTotal("tasks"),
        searchTotal("emails"),
      ]);
      return parts.reduce((a, b) => a + b, 0);
    }

    const out: Record<string, { planned: number; remote: number; local: number }> = {};

    // Modo "full": planned = remote para todos os objetos (sem cap, sem filtro de vínculo).
    if (data.mode === "full") {
      for (const k of data.objects) {
        const [remote, local] = await Promise.all([remoteCount(k), localCount(k)]);
        out[k] = { planned: remote, remote, local };
      }
      return out as Record<ObjectKey, { planned: number; remote: number; local: number }>;
    }

    // Modo "linked": filhos respeitam vínculo com as empresas dentro de maxCompanies.
    let companyIdsPromise: Promise<string[]> | null = null;
    const getCompanyIds = () => {
      if (!companyIdsPromise) companyIdsPromise = fetchCompanyIdsCount(data.maxCompanies);
      return companyIdsPromise;
    };

    const deps: CountDeps = {
      remoteCount,
      getCompanyIds,
      unionAssocIds,
      readContactProps: (ids, props) => batchRead("contacts", ids, props),
    };

    for (const k of data.objects) {
      const [remote, local] = await Promise.all([remoteCount(k), localCount(k)]);
      const planned = await computePlannedCapped(k, remote, data.maxCompanies, deps);
      out[k] = { planned, remote, local };
    }
    return out as Record<ObjectKey, { planned: number; remote: number; local: number }>;
  });

// Mantido para compat
export const previewHubspotCounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const [companies, contacts, deals] = await Promise.all([
      searchTotal("companies"),
      searchTotal("contacts"),
      searchTotal("deals"),
    ]);
    return { companies, contacts, deals };
  });

// ─────────────────────────── Import orchestrator ──────────────────────────────
const ScopeSchema = z
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
type Scope = z.infer<typeof ScopeSchema>;

type LogEntry = { ts: string; level: "info" | "warn" | "error"; step: string; message: string; count?: number };

const STEP_ORDER = ["companies", "contacts", "deals", "leads", "tickets", "activities"] as const;
type StepName = (typeof STEP_ORDER)[number];

const STEP_DEPS: Record<StepName, StepName[]> = {
  companies: [],
  contacts: ["companies"],
  deals: ["companies", "contacts"],
  leads: [],
  tickets: [],
  activities: ["contacts", "companies", "deals"],
};

function planSteps(scope: Scope): StepName[] {
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

// ─── Enqueue-only: cria job + items e retorna. A execução roda em ticks
// (UI/cron chamam tickHubspotImportJob), evitando o timeout de ~30s do Worker.
export const startHubspotImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ScopeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { planStepsFromScope, ensureJobItems } = await import("./hubspot-tick.server");
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const scope = data;
    // Em modo "full" usamos um teto alto pra companies; demais steps são best-effort.
    const effectiveScope = {
      ...scope,
      maxCompanies: scope.mode === "full" ? 100000 : scope.maxCompanies,
    };
    const steps = planStepsFromScope(effectiveScope as never);

    const { data: job, error: jobErr } = await supabase
      .from("enrichment_jobs")
      .insert({
        owner_id: userId,
          workspace_id: workspaceId,
        provider: "hubspot",
        kind: "import",
        entity: "lead",
        status: "queued",
        total: steps.length,
        scope: effectiveScope as never,
        step_logs: [
          {
            ts: new Date().toISOString(),
            level: "info",
            step: "queued",
            message: `Job criado com ${steps.length} etapas. Aguardando execução…`,
          },
        ],
      })
      .select("id")
      .single();
    if (jobErr || !job) throw new Error(`Erro ao criar job: ${jobErr?.message}`);
    const jobId = job.id;

    await ensureJobItems(supabase, jobId, steps as never);
    return { jobId, steps };
  });

// Limpa tabelas locais (apenas registros do usuário) antes de importar.
export const clearHubspotLocalTables = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        companies: z.boolean().optional(),
        contacts: z.boolean().optional(),
        deals: z.boolean().optional(),
        leads: z.boolean().optional(),
        tickets: z.boolean().optional(),
        activities: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
      const workspaceId = await resolveActiveWorkspace(userId);
    const tables: ("companies" | "contacts" | "deals" | "leads" | "tickets" | "activities")[] = [];
    if (data.companies) tables.push("companies");
    if (data.contacts) tables.push("contacts");
    if (data.deals) tables.push("deals");
    if (data.leads) tables.push("leads");
    if (data.tickets) tables.push("tickets");
    if (data.activities) tables.push("activities");

    const result: Record<string, number> = {};
    for (const t of tables) {
      const { count, error } = await supabase
        .from(t)
        .delete({ count: "exact" })
        .eq("workspace_id", workspaceId);
      if (error) throw new Error(`Falha ao limpar ${t}: ${error.message}`);
      result[t] = count ?? 0;
    }
    return { cleared: result };
  });

// Executa UM step do job HubSpot. Chamado pela UI (polling) e pelo cron.
export const tickHubspotImportJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ jobId: z.string().uuid().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const { tickOnce } = await import("./hubspot-tick.server");
    const { supabase, userId } = context;
    const result = await tickOnce(supabase, data.jobId, userId);
    return result;
  });

export const resumeHubspotImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ jobId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
      const workspaceId = await resolveActiveWorkspace(userId);
    const { data: job, error: jobErr } = await supabase
      .from("enrichment_jobs")
      .select("id, status")
      .eq("id", data.jobId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (jobErr) throw new Error(jobErr.message);
    if (!job) throw new Error("Importação não encontrada");

    const { data: items, error: itemsErr } = await supabase
      .from("enrichment_job_items")
      .select("id, status, before, after")
      .eq("job_id", data.jobId);
    if (itemsErr) throw new Error(itemsErr.message);

    const stepByItem = new Map<string, string>();
    const depsByStep = new Map<string, string[]>();
    for (const item of items ?? []) {
      const before = ((item.before as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
      const step = typeof before.step === "string" ? before.step : undefined;
      if (!step) continue;
      stepByItem.set(item.id, step);
      depsByStep.set(step, Array.isArray(before.depends_on) ? (before.depends_on as string[]) : []);
    }
    const resumeSteps = new Set(
      (items ?? [])
        .filter((item) => {
          if (item.status === "failed" || item.status === "running") return true;
          const before = ((item.before as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
          const after = ((item.after as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
          const deps = Array.isArray(before.depends_on) ? (before.depends_on as string[]) : [];
          const zeroResult =
            item.status === "done" &&
            (Number(after.succeeded ?? 0) === 0) &&
            (Number(after.failed ?? 0) === 0) &&
            (!Array.isArray(after.imported_hs_ids) || after.imported_hs_ids.length === 0);
          return zeroResult && deps.length > 0;
        })
        .map((item) => stepByItem.get(item.id))
        .filter(Boolean) as string[],
    );
    let expanded = true;
    while (expanded) {
      expanded = false;
      for (const [step, deps] of depsByStep.entries()) {
        if (!resumeSteps.has(step) && deps.some((dep) => resumeSteps.has(dep))) {
          resumeSteps.add(step);
          expanded = true;
        }
      }
    }

    let resumedItems = 0;
    for (const item of items ?? []) {
      const step = stepByItem.get(item.id);
      if (!step || !resumeSteps.has(step)) continue;
      const before = ((item.before as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
      const after = ((item.after as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
      const keepProgress = item.status === "failed" || item.status === "running";
      const mergedBefore = {
        ...before,
        cursor: keepProgress ? before.cursor : undefined,
        read_index: keepProgress ? before.read_index : 0,
        running_succeeded: keepProgress ? before.running_succeeded ?? after.succeeded ?? 0 : 0,
        running_failed: keepProgress ? before.running_failed ?? after.failed ?? 0 : 0,
        imported_hs_ids: keepProgress ? before.imported_hs_ids ?? after.imported_hs_ids ?? [] : [],
      };
      const { error } = await supabase
        .from("enrichment_job_items")
        .update({ status: "pending", before: mergedBefore as never, after: null, error: null })
        .eq("id", item.id);
      if (error) throw new Error(error.message);
      resumedItems++;
    }

    if (resumedItems === 0) throw new Error("Não há etapas para continuar nesta importação");
    const doneCount = (items ?? []).filter((it) => it.status === "done").length;
    await supabase
      .from("enrichment_jobs")
      .update({
        status: "queued",
        processed: doneCount,
        error: null,
        finished_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.jobId);
    return { ok: true, resumedItems };
  });

export const cancelHubspotImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ jobId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
      const workspaceId = await resolveActiveWorkspace(userId);
    const { data: job, error: jobErr } = await supabase
      .from("enrichment_jobs")
      .select("id, status, step_logs")
      .eq("id", data.jobId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (jobErr) throw new Error(jobErr.message);
    if (!job) throw new Error("Importação não encontrada");
    if (job.status === "done" || job.status === "failed") {
      return { ok: true, alreadyFinished: true };
    }
    const logs = Array.isArray(job.step_logs) ? (job.step_logs as Array<Record<string, unknown>>) : [];
    const next = [
      ...logs,
      {
        ts: new Date().toISOString(),
        level: "warn",
        step: "cancel",
        message: "Importação cancelada pelo usuário",
      },
    ].slice(-300);
    await supabase
      .from("enrichment_jobs")
      .update({
        status: "failed",
        error: "Cancelado pelo usuário",
        finished_at: new Date().toISOString(),
        step_logs: next as never,
      })
      .eq("id", data.jobId);
    // Marca itens pendentes/em execução como failed para o tick parar de tentar
    await supabase
      .from("enrichment_job_items")
      .update({ status: "failed", error: "Cancelado pelo usuário" } as never)
      .eq("job_id", data.jobId)
      .in("status", ["pending", "running"]);
    return { ok: true };
  });

// Stub do antigo handler — mantido apenas para satisfazer referências; o
// código abaixo está inativo agora que a execução é tick-based.
const _legacyStartHubspotImport_unused = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ScopeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
      const workspaceId = await resolveActiveWorkspace(userId);
    const scope = data;
    const steps = planSteps(scope);

    const { data: job, error: jobErr } = await supabase
      .from("enrichment_jobs")
      .insert({
        owner_id: userId,
          workspace_id: workspaceId,
        provider: "hubspot",
        kind: "import",
        entity: "lead",
        status: "running",
        total: steps.length,
        started_at: new Date().toISOString(),
        scope: scope as never,
        step_logs: [],
      })
      .select("id")
      .single();
    if (jobErr || !job) throw new Error(`Erro ao criar job: ${jobErr?.message}`);
    const jobId = job.id;

    for (let i = 0; i < steps.length; i++) {
      await supabase.from("enrichment_job_items").insert({
        job_id: jobId,
        status: "pending",
        before: { step: steps[i], order: i, depends_on: STEP_DEPS[steps[i]] } as never,
      });
    }

    const appendLog = async (entry: Omit<LogEntry, "ts">) => {
      const full: LogEntry = { ...entry, ts: new Date().toISOString() };
      const { data: cur } = await supabase
        .from("enrichment_jobs")
        .select("step_logs")
        .eq("id", jobId)
        .single();
      const arr = Array.isArray(cur?.step_logs) ? (cur!.step_logs as LogEntry[]) : [];
      const next = [...arr, full].slice(-300);
      await supabase.from("enrichment_jobs").update({ step_logs: next as never }).eq("id", jobId);
    };

    // Throttled progress writer — updates `before.running_succeeded/_failed/_discovered`
    // so the UI can animate counters in real time without thrashing the DB.
    const lastProgressAt: Record<string, number> = {};
    const bumpProgress = async (
      step: StepName,
      running_succeeded: number,
      running_failed: number,
      discovered?: number,
      force = false,
    ) => {
      const now = Date.now();
      if (!force && now - (lastProgressAt[step] ?? 0) < 600) return;
      lastProgressAt[step] = now;
      await updateItem(step, {
        before: { running_succeeded, running_failed, ...(discovered !== undefined ? { discovered } : {}) },
      });
    };

    const updateItem = async (
      step: StepName,
      patch: { status?: string; before?: Record<string, unknown>; after?: Record<string, unknown> }
    ) => {
      const { data: items } = await supabase
        .from("enrichment_job_items")
        .select("id, before")
        .eq("job_id", jobId);
      const target = (items ?? []).find((it) => (it.before as { step?: string } | null)?.step === step);
      if (!target) return;
      const merged: Record<string, unknown> = {};
      if (patch.status) merged.status = patch.status;
      if (patch.before) merged.before = { ...(target.before as object), ...patch.before };
      if (patch.after) merged.after = patch.after;
      await supabase.from("enrichment_job_items").update(merged as never).eq("id", target.id);
    };

    // Maps hubspotId → localId
    const companyMap = new Map<string, string>();
    const contactMap = new Map<string, string>();
    const dealMap = new Map<string, string>();

    // ── Dedup helpers ────────────────────────────────────────────────────────
    // Procura registro existente do owner por external_ids->>hubspot e, em
    // fallback, por chaves naturais. Retorna o id local se encontrado.
    async function findExistingId(
      table: "companies" | "contacts" | "deals" | "leads" | "activities",
      hsId: string,
      fallback?: { column: string; value: string | null | undefined }[],
    ): Promise<string | null> {
      // 1) external_ids->>hubspot
      const { data: byExt } = await supabase
        .from(table)
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("external_ids->>hubspot", hsId)
        .limit(1)
        .maybeSingle();
      if (byExt?.id) return byExt.id as string;
      // 2) chaves naturais
      for (const f of fallback ?? []) {
        const v = (f.value ?? "").toString().trim();
        if (!v) continue;
        const { data: byNat } = await supabase
          .from(table)
          .select("id, external_ids")
          .eq("workspace_id", workspaceId)
          .ilike(f.column, v)
          .limit(1)
          .maybeSingle();
        if (byNat?.id) return byNat.id as string;
      }
      return null;
    }

    // Faz merge do hubspot id no external_ids preservando dados existentes.
    async function mergeExternalIds(
      table: "companies" | "contacts" | "deals" | "leads" | "activities",
      id: string,
      patch: Record<string, unknown>,
    ) {
      const { data: cur } = await supabase
        .from(table)
        .select("external_ids")
        .eq("id", id)
        .maybeSingle();
      const next = { ...(cur?.external_ids as object | null ?? {}), ...patch };
      return next;
    }

    // Lifecycle by contact for leads step
    const contactLifecycle = new Map<string, string | null | undefined>();
    // Pipelines/estágios espelhados do HubSpot
    let dealPipelines: PipelineMaps = { pipelines: new Map(), stages: new Map() };
    let leadPipeline: { localPipelineId: string; stageByValue: Map<string, { stageId: string; label: string }> } | null = null;

    let totalSucceeded = 0;
    let totalFailed = 0;

    const finishOk = async () => {
      await supabase
        .from("enrichment_jobs")
        .update({
          status: "done",
          processed: steps.length,
          succeeded: totalSucceeded,
          failed: totalFailed,
          finished_at: new Date().toISOString(),
        })
        .eq("id", jobId);
    };
    const finishErr = async (msg: string) => {
      await supabase
        .from("enrichment_jobs")
        .update({
          status: "failed",
          error: msg,
          succeeded: totalSucceeded,
          failed: totalFailed,
          finished_at: new Date().toISOString(),
        })
        .eq("id", jobId);
    };

    try {
      // 0) Espelhar pipelines/estágios do HubSpot ANTES de qualquer importação,
      // para que deals/leads referenciem o pipeline e estágio corretos.
      if (steps.includes("deals")) {
        await appendLog({ level: "info", step: "pipelines", message: "Sincronizando pipelines de deals do HubSpot" });
        try {
          dealPipelines = await syncDealPipelines(supabase, workspaceId, userId);
          await appendLog({
            level: "info",
            step: "pipelines",
            message: `Pipelines de deals sincronizados: ${dealPipelines.pipelines.size} pipeline(s), ${dealPipelines.stages.size} estágio(s)`,
            count: dealPipelines.pipelines.size,
          });
        } catch (e) {
          await appendLog({
            level: "warn",
            step: "pipelines",
            message: `Falha ao sincronizar pipelines de deals: ${e instanceof Error ? e.message : String(e)}`,
          });
        }
      }
      if (steps.includes("leads")) {
        try {
          leadPipeline = await syncLeadPipeline(supabase, workspaceId, userId);
          await appendLog({
            level: "info",
            step: "pipelines",
            message: `Pipeline de leads sincronizado: ${leadPipeline.stageByValue.size} estágio(s)`,
            count: leadPipeline.stageByValue.size,
          });
        } catch (e) {
          await appendLog({
            level: "warn",
            step: "pipelines",
            message: `Falha ao sincronizar pipeline de leads: ${e instanceof Error ? e.message : String(e)}`,
          });
        }
      }

      for (const step of steps) {
        await updateItem(step, { status: "running", before: { started_at: new Date().toISOString() } });
        await appendLog({ level: "info", step, message: `Iniciando etapa ${step}` });

        let stepOk = 0;
        let stepFail = 0;

        if (step === "companies") {
          let after: string | undefined;
          let page = 1;
          const companyCap = scope.mode === "full" ? Number.POSITIVE_INFINITY : scope.maxCompanies;
          while (stepOk + stepFail < companyCap) {
            const remaining = companyCap - (stepOk + stepFail);
            const limit = Math.min(100, Number.isFinite(remaining) ? remaining : 100);
            const params: Record<string, string> = {
              limit: String(limit),
              properties: "name,domain,industry,numberofemployees,phone,city,state,zip,address,website",
            };
            if (after) params.after = after;
            const res = (await hsFetch("/crm/v3/objects/companies", params)) as {
              results: HSRec[];
              paging?: { next?: { after: string } };
            };
            if (!res.results.length) break;
            await appendLog({
              level: "info",
              step,
              message: `Página ${page}: ${res.results.length} empresas`,
              count: res.results.length,
            });
            for (const c of res.results) {
              const p = c.properties;
              if (!p.name) {
                stepFail++;
                continue;
              }
              const companyData = {
                name: p.name,
                domain: p.domain ?? null,
                industry: p.industry ?? null,
                size: p.numberofemployees ?? null,
                phone: p.phone ?? null,
                city: p.city ?? null,
                state: p.state ?? null,
                cep: p.zip ?? null,
                address: p.address ?? null,
                website: p.website ?? null,
              };
              const existingId = await findExistingId("companies", c.id, [
                { column: "domain", value: p.domain },
                { column: "name", value: p.name },
              ]);
              if (existingId) {
                const ext = await mergeExternalIds("companies", existingId, { hubspot: c.id });
                const { error } = await supabase
                  .from("companies")
                  .update({ ...companyData, external_ids: ext as never })
                  .eq("id", existingId);
                if (error) {
                  stepFail++;
                  await appendLog({ level: "warn", step, message: `Falha empresa (update) ${p.name}: ${error.message}` });
                } else {
                  companyMap.set(c.id, existingId);
                  stepOk++;
                }
              } else {
                const { data: row, error } = await supabase
                  .from("companies")
                  .insert({
                    owner_id: userId,
          workspace_id: workspaceId,
                    ...companyData,
                    external_ids: { hubspot: c.id } as never,
                  })
                  .select("id")
                  .single();
                if (error || !row) {
                  stepFail++;
                  await appendLog({ level: "warn", step, message: `Falha empresa ${p.name}: ${error?.message}` });
                } else {
                  companyMap.set(c.id, row.id);
                  stepOk++;
                }
              }

            }
            await bumpProgress(step, stepOk, stepFail, Number.isFinite(companyCap) ? companyCap : undefined);
            after = res.paging?.next?.after;
            page++;
            if (!after) break;
            await sleep(150);
          }
        } else if (step === "contacts" && scope.mode === "full") {
          // Modo total: lista TODOS os contatos, vínculo com empresa best-effort.
          await appendLog({ level: "info", step, message: "Listando todos os contatos do HubSpot" });
          const recs = await listAll(
            "contacts",
            ["firstname", "lastname", "email", "phone", "jobtitle", "lifecyclestage"],
            ["companies"],
          );
          await bumpProgress(step, 0, 0, recs.length, true);
          await appendLog({ level: "info", step, message: `Lendo ${recs.length} contatos`, count: recs.length });
          for (const c of recs) {
            const p = c.properties;
            contactLifecycle.set(c.id, p.lifecyclestage);
            if (!p.firstname && !p.email) {
              stepFail++;
              continue;
            }
            const hsCo = firstAssocId(c, "companies");
            const localCompanyId = hsCo ? companyMap.get(hsCo) ?? null : null;
            const contactData = {
              first_name: (p.firstname ?? p.email ?? "Sem nome") as string,
              last_name: p.lastname ?? null,
              email: p.email ?? null,
              phone: p.phone ?? null,
              job_title: p.jobtitle ?? null,
              company_id: localCompanyId,
            };
            const existingId = await findExistingId("contacts", c.id, [{ column: "email", value: p.email }]);
            if (existingId) {
              const ext = await mergeExternalIds("contacts", existingId, { hubspot: c.id });
              const { error } = await supabase
                .from("contacts")
                .update({ ...contactData, external_ids: ext as never })
                .eq("id", existingId);
              if (error) stepFail++;
              else {
                contactMap.set(c.id, existingId);
                stepOk++;
              }
            } else {
              const { data: row, error } = await supabase
                .from("contacts")
                .insert({ owner_id: userId,
          workspace_id: workspaceId, ...contactData, external_ids: { hubspot: c.id } as never })
                .select("id")
                .single();
              if (error || !row) stepFail++;
              else {
                contactMap.set(c.id, row.id);
                stepOk++;
              }
            }
            await bumpProgress(step, stepOk, stepFail, recs.length);
          }
        } else if (step === "contacts") {
          // Cascata: contatos vinculados às empresas importadas
          await appendLog({
            level: "info",
            step,
            message: `Buscando contatos vinculados a ${companyMap.size} empresas`,
          });
          const contactToCompany = new Map<string, string>();
          let assocCount = 0;
          for (const hsCompanyId of companyMap.keys()) {
            const ids = await getAssoc("companies", hsCompanyId, "contacts");
            for (const id of ids) if (!contactToCompany.has(id)) contactToCompany.set(id, hsCompanyId);
            assocCount++;
            if (assocCount % 25 === 0) {
              await appendLog({
                level: "info",
                step,
                message: `Associações lidas: ${assocCount}/${companyMap.size} empresas, ${contactToCompany.size} contatos únicos`,
              });
            }
            await sleep(80);
          }
          await bumpProgress(step, 0, 0, contactToCompany.size, true);
          await appendLog({
            level: "info",
            step,
            message: `Lendo ${contactToCompany.size} contatos em lotes de 100`,
            count: contactToCompany.size,
          });
          const contactRecs = await batchRead("contacts", [...contactToCompany.keys()], [
            "firstname",
            "lastname",
            "email",
            "phone",
            "jobtitle",
            "lifecyclestage",
          ]);
          for (const c of contactRecs) {
            const p = c.properties;
            contactLifecycle.set(c.id, p.lifecyclestage);
            if (!p.firstname && !p.email) {
              stepFail++;
              continue;
            }
            const localCompanyId = companyMap.get(contactToCompany.get(c.id) ?? "") ?? null;
            const contactData = {
              first_name: (p.firstname ?? p.email ?? "Sem nome") as string,
              last_name: p.lastname ?? null,
              email: p.email ?? null,
              phone: p.phone ?? null,
              job_title: p.jobtitle ?? null,
              company_id: localCompanyId,
            };
            const existingId = await findExistingId("contacts", c.id, [
              { column: "email", value: p.email },
            ]);
            if (existingId) {
              const ext = await mergeExternalIds("contacts", existingId, { hubspot: c.id });
              const { error } = await supabase
                .from("contacts")
                .update({ ...contactData, external_ids: ext as never })
                .eq("id", existingId);
              if (error) {
                stepFail++;
                await appendLog({ level: "warn", step, message: `Falha contato (update): ${error.message}` });
              } else {
                contactMap.set(c.id, existingId);
                stepOk++;
              }
            } else {
              const { data: row, error } = await supabase
                .from("contacts")
                .insert({
                  owner_id: userId,
          workspace_id: workspaceId,
                  ...contactData,
                  external_ids: { hubspot: c.id } as never,
                })
                .select("id")
                .single();
              if (error || !row) {
                stepFail++;
                await appendLog({ level: "warn", step, message: `Falha contato: ${error?.message}` });
              } else {
                contactMap.set(c.id, row.id);
                stepOk++;
              }
            }

            await bumpProgress(step, stepOk, stepFail, contactToCompany.size);
          }
        } else if (step === "deals" && scope.mode === "full") {
          // Modo total: lista TODOS os deals; vínculo best-effort para company/contacts.
          await appendLog({ level: "info", step, message: "Listando todos os negócios do HubSpot" });
          const recs = await listAll(
            "deals",
            ["dealname", "amount", "dealstage", "closedate", "pipeline"],
            ["companies", "contacts"],
          );
          await bumpProgress(step, 0, 0, recs.length, true);
          await appendLog({ level: "info", step, message: `Lendo ${recs.length} negócios`, count: recs.length });
          for (const d of recs) {
            const p = d.properties;
            const hsCo = firstAssocId(d, "companies");
            const localCompanyId = hsCo ? companyMap.get(hsCo) ?? null : null;
            const pipelineEntry = p.pipeline ? dealPipelines.pipelines.get(p.pipeline) : undefined;
            const stageEntry = p.dealstage ? dealPipelines.stages.get(p.dealstage) : undefined;
            const localPipelineId = pipelineEntry?.localId ?? stageEntry?.localPipelineId ?? null;
            const localStageId = stageEntry?.stageId ?? pipelineEntry?.defaultStageId ?? null;
            const stageEnum = mapDealStageEnum(
              stageEntry?.label,
              stageEntry?.probability ?? null,
              stageEntry
                ? (stageEntry.probability !== null && stageEntry.probability >= 1) ||
                  /lost|perdid|won|ganho|closed/i.test(stageEntry.label)
                : false,
            );
            const dealData = {
              name: p.dealname ?? "Sem nome",
              value: p.amount ? Number(p.amount) : 0,
              currency: "BRL",
              stage: stageEnum as never,
              stage_id: localStageId,
              pipeline_id: localPipelineId,
              company_id: localCompanyId,
              expected_close_date: p.closedate ? p.closedate.slice(0, 10) : null,
            };
            let existingId = await findExistingId("deals", d.id);
            if (!existingId && p.dealname && localCompanyId) {
              const { data: byNat } = await supabase
                .from("deals")
                .select("id")
                .eq("workspace_id", workspaceId)
                .eq("company_id", localCompanyId)
                .ilike("name", p.dealname)
                .limit(1)
                .maybeSingle();
              existingId = byNat?.id ?? null;
            }
            let localDealId: string | null = null;
            if (existingId) {
              const ext = await mergeExternalIds("deals", existingId, {
                hubspot: d.id,
                hs_stage: p.dealstage,
                hs_pipeline: p.pipeline,
              });
              const { error } = await supabase
                .from("deals")
                .update({ ...dealData, external_ids: ext as never })
                .eq("id", existingId);
              if (error) stepFail++;
              else {
                localDealId = existingId;
                dealMap.set(d.id, existingId);
                stepOk++;
              }
            } else {
              const { data: row, error } = await supabase
                .from("deals")
                .insert({
                  owner_id: userId,
          workspace_id: workspaceId,
                  ...dealData,
                  external_ids: { hubspot: d.id, hs_stage: p.dealstage, hs_pipeline: p.pipeline } as never,
                })
                .select("id")
                .single();
              if (error || !row) stepFail++;
              else {
                localDealId = row.id;
                dealMap.set(d.id, row.id);
                stepOk++;
              }
            }
            if (localDealId) {
              const contactIds = allAssocIds(d, "contacts");
              for (const cid of contactIds) {
                const lc = contactMap.get(cid);
                if (!lc) continue;
                const { data: existsLink } = await supabase
                  .from("deal_contacts")
                  .select("deal_id")
                  .eq("deal_id", localDealId)
                  .eq("contact_id", lc)
                  .maybeSingle();
                if (!existsLink) {
                  await supabase.from("deal_contacts").insert({ deal_id: localDealId, contact_id: lc });
                }
              }
            }
            await bumpProgress(step, stepOk, stepFail, recs.length);
          }
        } else if (step === "deals") {
          await appendLog({
            level: "info",
            step,
            message: `Buscando negócios vinculados a ${companyMap.size} empresas`,
          });
          const dealToCompany = new Map<string, string>();
          for (const hsCompanyId of companyMap.keys()) {
            const ids = await getAssoc("companies", hsCompanyId, "deals");
            for (const id of ids) if (!dealToCompany.has(id)) dealToCompany.set(id, hsCompanyId);
            await sleep(80);
          }
          await bumpProgress(step, 0, 0, dealToCompany.size, true);
          await appendLog({
            level: "info",
            step,
            message: `Lendo ${dealToCompany.size} negócios em lotes de 100`,
            count: dealToCompany.size,
          });
          const dealRecs = await batchRead("deals", [...dealToCompany.keys()], [
            "dealname",
            "amount",
            "dealstage",
            "closedate",
            "pipeline",
          ]);
          for (const d of dealRecs) {
            const p = d.properties;
            const localCompanyId = companyMap.get(dealToCompany.get(d.id) ?? "") ?? null;
            // Resolver pipeline e estágio espelhados do HubSpot
            const pipelineEntry = p.pipeline ? dealPipelines.pipelines.get(p.pipeline) : undefined;
            const stageEntry = p.dealstage ? dealPipelines.stages.get(p.dealstage) : undefined;
            const localPipelineId = pipelineEntry?.localId ?? stageEntry?.localPipelineId ?? null;
            const localStageId = stageEntry?.stageId ?? pipelineEntry?.defaultStageId ?? null;
            const stageEnum = mapDealStageEnum(
              stageEntry?.label,
              stageEntry?.probability ?? null,
              stageEntry ? (stageEntry.probability !== null && stageEntry.probability >= 1) || /lost|perdid|won|ganho|closed/i.test(stageEntry.label) : false,
            );
            const dealData = {
              name: p.dealname ?? "Sem nome",
              value: p.amount ? Number(p.amount) : 0,
              currency: "BRL",
              stage: stageEnum as never,
              stage_id: localStageId,
              pipeline_id: localPipelineId,
              company_id: localCompanyId,
              expected_close_date: p.closedate ? p.closedate.slice(0, 10) : null,
            };
            // Dedup: por external_ids->>hubspot. Fallback por (name + company_id).
            let existingId = await findExistingId("deals", d.id);
            if (!existingId && p.dealname && localCompanyId) {
              const { data: byNat } = await supabase
                .from("deals")
                .select("id")
                .eq("workspace_id", workspaceId)
                .eq("company_id", localCompanyId)
                .ilike("name", p.dealname)
                .limit(1)
                .maybeSingle();
              existingId = byNat?.id ?? null;
            }
            let localDealId: string | null = null;
            if (existingId) {
              const ext = await mergeExternalIds("deals", existingId, {
                hubspot: d.id,
                hs_stage: p.dealstage,
                hs_pipeline: p.pipeline,
              });
              const { error } = await supabase
                .from("deals")
                .update({ ...dealData, external_ids: ext as never })
                .eq("id", existingId);
              if (error) {
                stepFail++;
                await appendLog({ level: "warn", step, message: `Falha negócio (update): ${error.message}` });
              } else {
                localDealId = existingId;
                dealMap.set(d.id, existingId);
                stepOk++;
              }
            } else {
              const { data: row, error } = await supabase
                .from("deals")
                .insert({
                  owner_id: userId,
          workspace_id: workspaceId,
                  ...dealData,
                  external_ids: { hubspot: d.id, hs_stage: p.dealstage, hs_pipeline: p.pipeline } as never,
                })
                .select("id")
                .single();
              if (error || !row) {
                stepFail++;
                await appendLog({ level: "warn", step, message: `Falha negócio: ${error?.message}` });
              } else {
                localDealId = row.id;
                dealMap.set(d.id, row.id);
                stepOk++;
              }
            }
            if (localDealId) {
              // associações deal↔contact (evita duplicar par)
              const contactIds = await getAssoc("deals", d.id, "contacts");
              for (const cid of contactIds) {
                const lc = contactMap.get(cid);
                if (!lc) continue;
                const { data: existsLink } = await supabase
                  .from("deal_contacts")
                  .select("deal_id")
                  .eq("deal_id", localDealId)
                  .eq("contact_id", lc)
                  .maybeSingle();
                if (!existsLink) {
                  await supabase.from("deal_contacts").insert({ deal_id: localDealId, contact_id: lc });
                }
              }
              await sleep(60);
            }
            await bumpProgress(step, stepOk, stepFail, dealToCompany.size);

          }
        } else if (step === "leads") {
          // Importa do objeto nativo "leads" do HubSpot (independente de contatos).
          const LEAD_PROPS = [
            "hs_lead_name",
            "hs_lead_name_calculated",
            "hs_associated_contact_firstname",
            "hs_associated_contact_lastname",
            "hs_associated_contact_email",
            "hs_associated_company_name",
            "hs_lead_source",
            "hs_pipeline_stage",
            "hs_pipeline_stage_category",
            "hs_primary_contact_id",
            "hubspot_owner_id",
          ];
          await appendLog({
            level: "info",
            step,
            message: `Listando leads do HubSpot (objeto nativo /crm/v3/objects/leads)`,
          });
          const all = await listAll("leads", LEAD_PROPS);
          await appendLog({
            level: "info",
            step,
            message: `Encontrados ${all.length} leads no HubSpot`,
            count: all.length,
          });
          for (const c of all) {
            const p = c.properties;
            let first = (p.hs_associated_contact_firstname ?? "").toString();
            let last: string | null = p.hs_associated_contact_lastname ?? null;
            if (!first) {
              const full = (p.hs_lead_name_calculated ?? p.hs_lead_name ?? "").toString().trim();
              if (full) {
                const parts = full.split(/\s+/);
                first = parts[0];
                last = parts.slice(1).join(" ") || null;
              }
            }
            // Busca dados do contato primário associado (e-mail/telefone só vivem no contato)
            const primaryContactId = p.hs_primary_contact_id ?? null;
            let email: string | null = p.hs_associated_contact_email ?? null;
            let phone: string | null = null;
            if (primaryContactId) {
              const { data: pc } = await supabase
                .from("contacts")
                .select("email, phone")
                .eq("workspace_id", workspaceId)
                .eq("hs_object_id", String(primaryContactId))
                .maybeSingle();
              if (pc) {
                email = email || pc.email || null;
                phone = pc.phone || null;
              }
            }
            const hsStatus = p.hs_pipeline_stage ?? "";
            const stageEntry = hsStatus ? leadPipeline?.stageByValue.get(hsStatus) : undefined;
            const leadData = {
              first_name: first || email || "Sem nome",
              last_name: last,
              email,
              phone,
              company_name: p.hs_associated_company_name ?? null,
              source: p.hs_lead_source ?? "hubspot",
              status: mapLeadStatusEnum(p.hs_pipeline_stage_category ?? undefined, stageEntry?.label ?? hsStatus) as never,
              stage_id: stageEntry?.stageId ?? hsStatus ?? null,
              pipeline_id: leadPipeline?.localPipelineId ?? null,
            };
            const existingId = await findExistingId("leads", c.id, [
              { column: "email", value: email },
            ]);
            if (existingId) {
              const ext = await mergeExternalIds("leads", existingId, {
                hubspot_lead: c.id,
                hs_pipeline_stage: hsStatus || null,
              });
              const { error } = await supabase
                .from("leads")
                .update({ ...leadData, external_ids: ext as never })
                .eq("id", existingId);
              if (error) stepFail++;
              else stepOk++;
            } else {
              const { error } = await supabase.from("leads").insert({
                owner_id: userId,
          workspace_id: workspaceId,
                ...leadData,
                external_ids: { hubspot_lead: c.id, hs_pipeline_stage: hsStatus || null } as never,
              });
              if (error) stepFail++;
              else stepOk++;
            }
            await bumpProgress(step, stepOk, stepFail, all.length);
          }


        } else if (step === "activities") {
          const types: { obj: string; type: "note" | "call" | "meeting" | "task" | "email"; props: string[] }[] = [
            { obj: "notes", type: "note", props: ["hs_note_body", "hs_timestamp"] },
            { obj: "calls", type: "call", props: ["hs_call_title", "hs_call_body", "hs_timestamp", "hs_call_disposition"] },
            { obj: "meetings", type: "meeting", props: ["hs_meeting_title", "hs_meeting_body", "hs_timestamp"] },
            { obj: "tasks", type: "task", props: ["hs_task_subject", "hs_task_body", "hs_timestamp", "hs_task_status"] },
            { obj: "emails", type: "email", props: ["hs_email_subject", "hs_email_text", "hs_timestamp"] },
          ];
          // Para cada entidade conhecida, pegar associações de cada tipo
          const entities: { fromObj: string; ids: string[]; localMap: Map<string, string> }[] = [
            { fromObj: "companies", ids: [...companyMap.keys()], localMap: companyMap },
            { fromObj: "contacts", ids: [...contactMap.keys()], localMap: contactMap },
            { fromObj: "deals", ids: [...dealMap.keys()], localMap: dealMap },
          ];
          for (const t of types) {
            const seen = new Set<string>();
            const engagementToParents = new Map<
              string,
              { contactId?: string; companyId?: string; dealId?: string }
            >();
            if (scope.mode === "full") {
              // Modo total: lista TODOS os engagements desse tipo, com parents best-effort.
              const recsAll = await listAll(t.obj, t.props, ["companies", "contacts", "deals"]);
              for (const a of recsAll) {
                seen.add(a.id);
                engagementToParents.set(a.id, {
                  companyId: firstAssocId(a, "companies") ?? undefined,
                  contactId: firstAssocId(a, "contacts") ?? undefined,
                  dealId: firstAssocId(a, "deals") ?? undefined,
                });
              }
            } else {
              for (const ent of entities) {
                for (const fid of ent.ids) {
                  const ids = await getAssoc(ent.fromObj, fid, t.obj);
                  for (const eid of ids) {
                    seen.add(eid);
                    const cur = engagementToParents.get(eid) ?? {};
                    if (ent.fromObj === "contacts") cur.contactId = fid;
                    if (ent.fromObj === "companies") cur.companyId = fid;
                    if (ent.fromObj === "deals") cur.dealId = fid;
                    engagementToParents.set(eid, cur);
                  }
                  await sleep(40);
                }
              }
            }
            if (!seen.size) continue;
            await appendLog({
              level: "info",
              step,
              message: `Lendo ${seen.size} ${t.obj}`,
              count: seen.size,
            });
            const recs = await batchRead(t.obj, [...seen], t.props);
            for (const a of recs) {
              const p = a.properties;
              const subject =
                p.hs_note_body?.replace(/<[^>]+>/g, "").slice(0, 100) ??
                p.hs_call_title ??
                p.hs_meeting_title ??
                p.hs_task_subject ??
                p.hs_email_subject ??
                t.type;
              const body =
                p.hs_note_body ?? p.hs_call_body ?? p.hs_meeting_body ?? p.hs_task_body ?? p.hs_email_text ?? null;
              const due = p.hs_timestamp ?? null;
              const parents = engagementToParents.get(a.id) ?? {};
              const activityData = {
                type: t.type,
                subject,
                body,
                due_date: due,
                completed: t.type !== "task",
                related_contact_id: parents.contactId ? contactMap.get(parents.contactId) ?? null : null,
                related_company_id: parents.companyId ? companyMap.get(parents.companyId) ?? null : null,
                related_deal_id: parents.dealId ? dealMap.get(parents.dealId) ?? null : null,
              };
              const existingId = await findExistingId("activities", a.id);
              if (existingId) {
                const ext = await mergeExternalIds("activities", existingId, {
                  hubspot: a.id,
                  hs_kind: t.obj,
                });
                const { error } = await supabase
                  .from("activities")
                  .update({ ...activityData, external_ids: ext as never })
                  .eq("id", existingId);
                if (error) stepFail++;
                else stepOk++;
              } else {
                const { error } = await supabase.from("activities").insert({
                  owner_id: userId,
          workspace_id: workspaceId,
                  ...activityData,
                  external_ids: { hubspot: a.id, hs_kind: t.obj } as never,
                });
                if (error) stepFail++;
                else stepOk++;
              }
              await bumpProgress(step, stepOk, stepFail);

            }
          }
        }

        totalSucceeded += stepOk;
        totalFailed += stepFail;
        await updateItem(step, {
          status: "done",
          after: { succeeded: stepOk, failed: stepFail, finished_at: new Date().toISOString() },
        });
        await appendLog({
          level: "info",
          step,
          message: `Etapa ${step} concluída: ${stepOk} ok / ${stepFail} falhas`,
        });
        await supabase
          .from("enrichment_jobs")
          .update({ succeeded: totalSucceeded, failed: totalFailed, processed: steps.indexOf(step) + 1 })
          .eq("id", jobId);
      }

      await finishOk();
      await appendLog({
        level: "info",
        step: "done",
        message: `Importação concluída: ${totalSucceeded} ok / ${totalFailed} falhas`,
      });
      return { jobId, succeeded: totalSucceeded, failed: totalFailed };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await appendLog({ level: "error", step: "fatal", message: msg });
      await finishErr(msg);
      throw e;
    }
  });

// ─────────────────────────── Legacy compat ────────────────────────────────────
export const previewHubspotLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ limit: z.number().min(1).max(100).default(10) }).parse(input))
  .handler(async ({ data }) => {
    const params: Record<string, string> = {
      limit: String(data.limit),
      properties: "firstname,lastname,email,phone,company,hs_analytics_source",
    };
    const r = (await hsFetch("/crm/v3/objects/contacts", params)) as {
      results: { id: string; properties: Record<string, string | null | undefined> }[];
    };
    return {
      contacts: r.results.map((c) => ({
        id: c.id,
        first_name: c.properties.firstname ?? "",
        last_name: c.properties.lastname ?? "",
        email: c.properties.email ?? "",
        phone: c.properties.phone ?? "",
        company_name: c.properties.company ?? "",
        source: c.properties.hs_analytics_source ?? "hubspot",
      })),
    };
  });
