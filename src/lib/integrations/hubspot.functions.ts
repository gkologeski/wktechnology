// HubSpot import via Lovable Connector Gateway
// Cascata: Empresas (limitadas pelo usuário) → Contatos vinculados → Negócios vinculados
//          → Leads (contatos com lifecyclestage=lead) → Atividades vinculadas
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

type HSRec = { id: string; properties: Record<string, string | null | undefined> };

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

function mapLeadStatusEnum(label: string | undefined): string {
  const l = (label ?? "").toLowerCase();
  if (l.includes("qualif")) return "qualified";
  if (l.includes("contat") || l.includes("contact")) return "contacted";
  if (l.includes("unqual") || l.includes("descart") || l.includes("perdid") || l.includes("lost"))
    return "unqualified";
  return "new";
}

async function syncDealPipelines(
  supabase: any, // eslint-disable-line @typescript-eslint/no-explicit-any
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
      .eq("owner_id", userId)
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
    .eq("owner_id", userId)
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
const ObjectKey = z.enum(["companies", "contacts", "deals", "leads", "activities"]);
type ObjectKey = z.infer<typeof ObjectKey>;

const LOCAL_TABLE: Record<ObjectKey, "companies" | "contacts" | "deals" | "leads" | "activities"> = {
  companies: "companies",
  contacts: "contacts",
  deals: "deals",
  leads: "leads",
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
        maxCompanies: z.number().min(1).max(2000).default(200),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    void context;

    async function remoteCount(key: ObjectKey): Promise<number> {
      if (key === "companies") return searchTotal("companies");
      if (key === "contacts") return searchTotal("contacts");
      if (key === "deals") return searchTotal("deals");
      if (key === "leads") {
        return searchTotal("contacts", {
          filterGroups: [
            { filters: [{ propertyName: "lifecyclestage", operator: "EQ", value: "lead" }] },
          ],
        });
      }
      const parts = await Promise.all([
        searchTotal("notes"),
        searchTotal("calls"),
        searchTotal("meetings"),
        searchTotal("tasks"),
        searchTotal("emails"),
      ]);
      return parts.reduce((a, b) => a + b, 0);
    }

    // Para os filhos, "planned" considera apenas o que está vinculado às
    // empresas que efetivamente serão importadas (respeitando maxCompanies).
    let companyIdsPromise: Promise<string[]> | null = null;
    const getCompanyIds = () => {
      if (!companyIdsPromise) companyIdsPromise = fetchCompanyIdsCount(data.maxCompanies);
      return companyIdsPromise;
    };

    async function plannedCount(key: ObjectKey, remote: number): Promise<number> {
      if (key === "companies") return Math.min(remote, data.maxCompanies);
      const companyIds = await getCompanyIds();
      if (companyIds.length === 0) return 0;

      if (key === "contacts") {
        const set = await unionAssocIds("companies", companyIds, "contacts");
        return set.size;
      }
      if (key === "deals") {
        const set = await unionAssocIds("companies", companyIds, "deals");
        return set.size;
      }
      if (key === "leads") {
        const contacts = await unionAssocIds("companies", companyIds, "contacts");
        if (contacts.size === 0) return 0;
        const recs = await batchRead("contacts", [...contacts], ["lifecyclestage"]);
        return recs.filter((r) => (r.properties?.lifecyclestage ?? "") === "lead").length;
      }
      // activities: união de notes/calls/meetings/tasks/emails ligados a companies, contatos e deals do escopo.
      const [contacts, deals] = await Promise.all([
        unionAssocIds("companies", companyIds, "contacts"),
        unionAssocIds("companies", companyIds, "deals"),
      ]);
      const types = ["notes", "calls", "meetings", "tasks", "emails"] as const;
      let total = 0;
      for (const t of types) {
        const [a, b, c] = await Promise.all([
          unionAssocIds("companies", companyIds, t),
          unionAssocIds("contacts", [...contacts], t),
          unionAssocIds("deals", [...deals], t),
        ]);
        const merged = new Set<string>();
        for (const x of a) merged.add(x);
        for (const x of b) merged.add(x);
        for (const x of c) merged.add(x);
        total += merged.size;
      }
      return total;
    }

    const out: Record<string, { planned: number; remote: number }> = {};
    // Sequencial para reaproveitar getCompanyIds() entre chamadas e evitar rate-limit.
    for (const k of data.objects) {
      const remote = await remoteCount(k);
      const planned = Math.min(await plannedCount(k, remote), remote);
      out[k] = { planned, remote };
    }
    return out as Record<ObjectKey, { planned: number; remote: number }>;
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
    companies: z.boolean().default(true),
    contacts: z.boolean().default(true),
    deals: z.boolean().default(true),
    leads: z.boolean().default(false),
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

const STEP_ORDER = ["companies", "contacts", "deals", "leads", "activities"] as const;
type StepName = (typeof STEP_ORDER)[number];

const STEP_DEPS: Record<StepName, StepName[]> = {
  companies: [],
  contacts: ["companies"],
  deals: ["companies", "contacts"],
  leads: ["contacts"],
  activities: ["contacts", "companies", "deals"],
};

function planSteps(scope: Scope): StepName[] {
  const wanted = new Set<StepName>();
  wanted.add("companies"); // sempre
  if (scope.contacts) wanted.add("contacts");
  if (scope.deals) {
    wanted.add("contacts");
    wanted.add("deals");
  }
  if (scope.leads) {
    wanted.add("contacts");
    wanted.add("leads");
  }
  if (scope.activities) {
    wanted.add("contacts");
    wanted.add("activities");
  }
  return STEP_ORDER.filter((s) => wanted.has(s));
}

export const startHubspotImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ScopeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const scope = data;
    const steps = planSteps(scope);

    const { data: job, error: jobErr } = await supabase
      .from("enrichment_jobs")
      .insert({
        owner_id: userId,
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
        .eq("owner_id", userId)
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
          .eq("owner_id", userId)
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
          dealPipelines = await syncDealPipelines(supabase, userId);
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
          leadPipeline = await syncLeadPipeline(supabase, userId);
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
          while (stepOk + stepFail < scope.maxCompanies) {
            const remaining = scope.maxCompanies - (stepOk + stepFail);
            const limit = Math.min(100, remaining);
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
            await bumpProgress(step, stepOk, stepFail, scope.maxCompanies);
            after = res.paging?.next?.after;
            page++;
            if (!after) break;
            await sleep(150);
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
                .eq("owner_id", userId)
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
          // Contatos importados que tinham lifecyclestage = lead
          const leadIds = [...contactLifecycle.entries()]
            .filter(([, ls]) => ls === "lead")
            .map(([id]) => id);
          await appendLog({
            level: "info",
            step,
            message: `Lendo ${leadIds.length} leads (contatos com lifecyclestage=lead)`,
            count: leadIds.length,
          });
          const recs = await batchRead("contacts", leadIds, [
            "firstname",
            "lastname",
            "email",
            "phone",
            "company",
            "hs_lead_status",
            "hs_analytics_source",
          ]);
          for (const c of recs) {
            const p = c.properties;
            const hsStatus = p.hs_lead_status ?? "";
            const stageEntry = hsStatus ? leadPipeline?.stageByValue.get(hsStatus) : undefined;
            const leadData = {
              first_name: (p.firstname ?? p.email ?? "Sem nome") as string,
              last_name: p.lastname ?? null,
              email: p.email ?? null,
              phone: p.phone ?? null,
              company_name: p.company ?? null,
              source: p.hs_analytics_source ?? "hubspot",
              status: mapLeadStatusEnum(stageEntry?.label ?? hsStatus) as never,
              stage_id: stageEntry?.stageId ?? hsStatus ?? null,
              pipeline_id: leadPipeline?.localPipelineId ?? null,
            };
            const existingId = await findExistingId("leads", c.id, [
              { column: "email", value: p.email },
            ]);
            if (existingId) {
              const ext = await mergeExternalIds("leads", existingId, {
                hubspot: c.id,
                hs_lead_status: hsStatus || null,
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
                ...leadData,
                external_ids: { hubspot: c.id, hs_lead_status: hsStatus || null } as never,
              });
              if (error) stepFail++;
              else stepOk++;
            }
            await bumpProgress(step, stepOk, stepFail, leadIds.length);
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
