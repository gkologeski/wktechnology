// Per-step execution helpers for HubSpot import.
// Each step runs in its own HTTP request (via /api/public/hubspot-run-step)
// so the Cloudflare Worker timeout (~30s) is respected.
// State is rebuilt from DB each call (no in-memory cache between steps).
import type { SupabaseClient } from "@supabase/supabase-js";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/hubspot";

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
  if (!res.ok)
    throw new Error(`HubSpot POST [${res.status}] ${path}: ${JSON.stringify(data).slice(0, 300)}`);
  return data;
}

async function discoverTotal(objectType: string): Promise<number | null> {
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

// Busca associações em lote usando o endpoint v4 (até 1000 IDs por request).
// Reduz milhares de chamadas individuais para dezenas de batches.
// Se o batch v4 falhar, faz fallback para getAssoc individual em paralelo.
async function getAssocMany(
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
        const tos = (row.to ?? [])
          .map((t) => String(t.toObjectId ?? t.id ?? ""))
          .filter(Boolean);
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

type HSRec = {
  id: string;
  properties: Record<string, string | null | undefined>;
  createdAt?: string;
  updatedAt?: string;
};

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
  }
  return out;
}

// ─── Property discovery + value parsing helpers ──────────────────────────────

// In-request cache (each tick runs one step in one HTTP request, so this is enough).
const propertyCache = new Map<string, string[]>();

async function loadHsProperties(objectType: string): Promise<string[]> {
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

function parseHsDate(v: string | null | undefined): string | null {
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

function parseHsNum(v: string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

type HsProps = Record<string, string | null | undefined>;

function mapCompany(p: HsProps) {
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

function mapContact(p: HsProps) {
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

function mapDeal(p: HsProps) {
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
    num_associated_contacts: parseHsNum(p.num_associated_contacts) !== null
      ? Math.trunc(parseHsNum(p.num_associated_contacts) as number)
      : null,
  };
}

function mapLead(p: HsProps) {
  return {
    hubspot_owner_id: p.hubspot_owner_id ?? null,
    hs_object_id: p.hs_object_id ?? null,
    hs_createdate: parseHsDate(p.createdate ?? p.hs_createdate),
    hs_lastmodifieddate: parseHsDate(p.lastmodifieddate ?? p.hs_lastmodifieddate),
    hs_lead_source_detail: p.hs_analytics_source_data_1 ?? p.hs_analytics_source ?? null,
  };
}

function mapActivity(kind: string, p: HsProps) {
  const ms =
    parseHsNum(p.hs_call_duration) ??
    parseHsNum(p.hs_meeting_duration) ??
    null;
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

function rawOf(rec: { id: string; properties: HsProps; createdAt?: string; updatedAt?: string }) {
  return {
    id: rec.id,
    properties: rec.properties,
    createdAt: rec.createdAt ?? null,
    updatedAt: rec.updatedAt ?? null,
  } as never;
}

// ─────────────────────────── Step framework ──────────────────────────────────

export type StepName =
  | "companies"
  | "contacts"
  | "deals"
  | "leads"
  | "activities-notes"
  | "activities-calls"
  | "activities-meetings"
  | "activities-tasks"
  | "activities-emails";

export const STEP_DEPS: Record<StepName, StepName[]> = {
  companies: [],
  contacts: ["companies"],
  deals: ["companies", "contacts"],
  leads: ["contacts"],
  "activities-notes": ["contacts", "companies", "deals"],
  "activities-calls": ["contacts", "companies", "deals"],
  "activities-meetings": ["contacts", "companies", "deals"],
  "activities-tasks": ["contacts", "companies", "deals"],
  "activities-emails": ["contacts", "companies", "deals"],
};

const STEP_ORDER: StepName[] = [
  "companies",
  "contacts",
  "deals",
  "leads",
  "activities-notes",
  "activities-calls",
  "activities-meetings",
  "activities-tasks",
  "activities-emails",
];

export type Scope = {
  companies: boolean;
  contacts: boolean;
  deals: boolean;
  leads: boolean;
  activities: boolean;
  maxCompanies: number;
};

export function planSteps(scope: Scope): StepName[] {
  const wanted = new Set<StepName>();
  wanted.add("companies");
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
    wanted.add("deals");
    wanted.add("contacts");
    wanted.add("activities-notes");
    wanted.add("activities-calls");
    wanted.add("activities-meetings");
    wanted.add("activities-tasks");
    wanted.add("activities-emails");
  }
  return STEP_ORDER.filter((s) => wanted.has(s));
}

type LogEntry = { ts: string; level: "info" | "warn" | "error"; step: string; message: string; count?: number };

type ItemRow = {
  id: string;
  status: string;
  before: { step?: string; order?: number; depends_on?: string[]; [k: string]: unknown } | null;
  after: { succeeded?: number; failed?: number; imported_hs_ids?: string[]; [k: string]: unknown } | null;
};

export type StepCtx = {
  supabase: SupabaseClient;
  userId: string;
  jobId: string;
  step: StepName;
  itemId: string;
  scope: Scope;
  /** Absolute epoch ms after which the step must checkpoint and return partial=true */
  deadlineAt?: number;
};

export type StepResult = {
  succeeded: number;
  failed: number;
  importedHsIds: string[];
  /** true means the step persisted a cursor and is waiting to be re-queued */
  partial?: boolean;
};

async function appendLog(supabase: SupabaseClient, jobId: string, entry: Omit<LogEntry, "ts">) {
  const full: LogEntry = { ...entry, ts: new Date().toISOString() };
  const { data: cur } = await supabase
    .from("enrichment_jobs")
    .select("step_logs")
    .eq("id", jobId)
    .single();
  const arr = Array.isArray(cur?.step_logs) ? (cur!.step_logs as LogEntry[]) : [];
  const next = [...arr, full].slice(-300);
  await supabase.from("enrichment_jobs").update({ step_logs: next as never }).eq("id", jobId);
}

async function patchItemBefore(supabase: SupabaseClient, itemId: string, patch: Record<string, unknown>) {
  const { data: cur } = await supabase
    .from("enrichment_job_items")
    .select("before")
    .eq("id", itemId)
    .single();
  const merged = { ...((cur?.before as object) ?? {}), ...patch };
  await supabase.from("enrichment_job_items").update({ before: merged as never }).eq("id", itemId);
}

// Throttled progress writer. Also heartbeats enrichment_jobs.updated_at so the
// zombie-sweeper doesn't kill long-running steps that are actually progressing.
function makeProgressBumper(supabase: SupabaseClient, itemId: string, jobId: string) {
  let last = 0;
  return async (succeeded: number, failed: number, discovered?: number, force = false) => {
    const now = Date.now();
    if (!force && now - last < 600) return;
    last = now;
    await Promise.all([
      patchItemBefore(supabase, itemId, {
        running_succeeded: succeeded,
        running_failed: failed,
        last_heartbeat_at: new Date().toISOString(),
        ...(discovered !== undefined ? { discovered } : {}),
      }),
      supabase
        .from("enrichment_jobs")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", jobId),
    ]);
  };
}

// Load HS-ID → localId map for entities imported earlier. We scan the local
// database first so a resumed job still sees records imported before a timeout,
// even if the item checkpoint lost its imported_hs_ids list.
async function loadMapForStep(
  supabase: SupabaseClient,
  userId: string,
  jobId: string,
  table: "companies" | "contacts" | "deals",
  fromStep: StepName,
): Promise<Map<string, string>> {
  const importedIds = await loadImportedHsIdsForStep(supabase, userId, jobId, table, fromStep);
  if (importedIds.length > 0 && importedIds.length <= 2_000) {
    return loadLocalMapForHsIds(supabase, userId, table, importedIds);
  }

  return scanLocalHubspotMap(supabase, userId, table);
}

async function loadImportedHsIdsForStep(
  supabase: SupabaseClient,
  userId: string,
  jobId: string,
  table: "companies" | "contacts" | "deals",
  fromStep: StepName,
): Promise<string[]> {
  const { data: items } = await supabase
    .from("enrichment_job_items")
    .select("after, before")
    .eq("job_id", jobId);
  const item = (items ?? []).find((it) => (it.before as { step?: string } | null)?.step === fromStep);
  const ids =
    (item?.after as { imported_hs_ids?: string[] } | null)?.imported_hs_ids ??
    (item?.before as { imported_hs_ids?: string[] } | null)?.imported_hs_ids ??
    [];
  if (ids.length > 0) return Array.from(new Set(ids.map(String)));

  const fallback = await scanLocalHubspotMap(supabase, userId, table);
  return [...fallback.keys()];
}

async function scanLocalHubspotMap(
  supabase: SupabaseClient,
  userId: string,
  table: "companies" | "contacts" | "deals",
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from(table)
      .select("id, external_ids")
      .eq("owner_id", userId)
      .not("external_ids->>hubspot", "is", null)
      .range(from, from + 999);
    for (const r of data ?? []) {
      const hs = (r.external_ids as { hubspot?: string } | null)?.hubspot;
      if (hs) map.set(String(hs), r.id as string);
    }
    if (!data || data.length < 1000) break;
  }
  return map;
}

async function loadLocalMapForHsIds(
  supabase: SupabaseClient,
  userId: string,
  table: "companies" | "contacts" | "deals",
  ids: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = Array.from(new Set(ids.map(String).filter(Boolean)));
  for (let i = 0; i < unique.length; i += 250) {
    const chunk = unique.slice(i, i + 250);
    const { data } = await supabase
      .from(table)
      .select("id, external_ids")
      .eq("owner_id", userId)
      .in("external_ids->>hubspot", chunk);
    for (const r of data ?? []) {
      const hs = (r.external_ids as { hubspot?: string } | null)?.hubspot;
      if (hs) map.set(String(hs), r.id as string);
    }
  }
  return map;
}

// ─────────────────────── Dedup + resume helpers ──────────────────────────────

type UpsertResult = { status: "inserted" | "updated" | "unchanged" | "failed"; localId?: string; error?: string };

/** Compare existing row vs incoming payload by HS id; insert/update/skip. */
async function upsertByHsId(
  supabase: SupabaseClient,
  table: "companies" | "contacts" | "deals" | "leads" | "activities",
  ownerId: string,
  hsId: string,
  payload: Record<string, unknown>,
): Promise<UpsertResult> {
  const compareKeys = Object.keys(payload).filter(
    (k) => k !== "owner_id" && k !== "external_ids" && k !== "hs_raw",
  );
  const selectCols = ["id", ...compareKeys].join(",");
  const { data: existing } = await supabase
    .from(table)
    .select(selectCols)
    .eq("owner_id", ownerId)
    .eq("external_ids->>hubspot", hsId)
    .maybeSingle();

  if (existing) {
    const ex = existing as unknown as Record<string, unknown>;
    const localId = ex.id as string;
    const diff: Record<string, unknown> = {};
    for (const k of compareKeys) {
      const cur = ex[k];
      const nxt = payload[k];
      if (JSON.stringify(cur ?? null) !== JSON.stringify(nxt ?? null)) diff[k] = nxt;
    }
    if (Object.keys(diff).length === 0) return { status: "unchanged", localId };
    const { error } = await supabase.from(table).update(diff as never).eq("id", localId);
    if (error) return { status: "failed", error: error.message };
    return { status: "updated", localId };
  }

  const { data: row, error } = await supabase
    .from(table)
    .insert(payload as never)
    .select("id")
    .single();
  if (error || !row) return { status: "failed", error: error?.message ?? "insert failed" };
  return { status: "inserted", localId: (row as { id: string }).id };
}

type ResumeState = {
  started_at?: string;
  cursor?: string;
  read_index?: number;
  assoc_index?: number;
  deal_contacts_index?: number;
  discovery_entity_index?: number;
  discovery_id_index?: number;
  discovery_complete?: boolean;
  running_succeeded?: number;
  running_failed?: number;
  discovered?: number;
  imported_hs_ids?: string[];
  target_ids?: string[];
  parent_map?: Record<string, string>;
  deal_contacts_map?: Record<string, string[]>;
  parents_map?: Record<string, { contactId?: string; companyId?: string; dealId?: string }>;
  step?: string;
  order?: number;
  depends_on?: string[];
  [k: string]: unknown;
};

async function loadResume(supabase: SupabaseClient, itemId: string): Promise<ResumeState> {
  const { data } = await supabase
    .from("enrichment_job_items")
    .select("before")
    .eq("id", itemId)
    .single();
  return ((data?.before as ResumeState | null) ?? {}) as ResumeState;
}

async function discoverTargetsFromAssociations(args: {
  supabase: SupabaseClient;
  jobId: string;
  itemId: string;
  step: StepName;
  fromObj: string;
  fromIds: string[];
  toObj: string;
  resume: ResumeState;
  deadlineAt: number;
}) {
  const { supabase, jobId, itemId, step, fromObj, fromIds, toObj, resume, deadlineAt } = args;
  const targetIds = [...(resume.target_ids ?? [])];
  const parentMap = { ...(resume.parent_map ?? {}) };
  const seen = new Set(targetIds);
  let assocIndex = resume.assoc_index ?? 0;
  const CHUNK = 500;

  while (assocIndex < fromIds.length) {
    if (Date.now() >= deadlineAt - 1_500) {
      await patchItemBefore(supabase, itemId, { assoc_index: assocIndex, target_ids: targetIds, parent_map: parentMap, discovered: targetIds.length });
      return { targetIds, parentMap, partial: true };
    }
    const chunk = fromIds.slice(assocIndex, assocIndex + CHUNK);
    const assoc = await getAssocMany(fromObj, chunk, toObj, 20);
    for (const [fromId, list] of assoc.entries()) {
      for (const id of list) {
        if (!parentMap[id]) parentMap[id] = fromId;
        if (!seen.has(id)) {
          seen.add(id);
          targetIds.push(id);
        }
      }
    }
    assocIndex += chunk.length;
    await patchItemBefore(supabase, itemId, {
      assoc_index: assocIndex,
      target_ids: targetIds,
      parent_map: parentMap,
      discovered: targetIds.length,
      last_heartbeat_at: new Date().toISOString(),
    });
    await supabase.from("enrichment_jobs").update({ updated_at: new Date().toISOString() }).eq("id", jobId);
    await appendLog(supabase, jobId, {
      level: "info",
      step,
      message: `Associações mapeadas: ${assocIndex}/${fromIds.length} ${fromObj}, ${targetIds.length} ${toObj} únicos`,
    });
  }

  await patchItemBefore(supabase, itemId, { assoc_index: assocIndex, discovery_complete: true, target_ids: targetIds, parent_map: parentMap, discovered: targetIds.length });
  return { targetIds, parentMap, partial: false };
}

async function discoverDealContactsMap(args: {
  supabase: SupabaseClient;
  jobId: string;
  itemId: string;
  step: StepName;
  dealIds: string[];
  resume: ResumeState;
  deadlineAt: number;
}) {
  const { supabase, jobId, itemId, step, dealIds, resume, deadlineAt } = args;
  const dealContactsMap = { ...(resume.deal_contacts_map ?? {}) };
  let index = resume.deal_contacts_index ?? 0;
  const CHUNK = 500;
  while (index < dealIds.length) {
    if (Date.now() >= deadlineAt - 1_500) {
      await patchItemBefore(supabase, itemId, { deal_contacts_index: index, deal_contacts_map: dealContactsMap });
      return { dealContactsMap, partial: true };
    }
    const chunk = dealIds.slice(index, index + CHUNK);
    const assoc = await getAssocMany("deals", chunk, "contacts", 20);
    for (const [dealId, list] of assoc.entries()) dealContactsMap[dealId] = list;
    index += chunk.length;
    await patchItemBefore(supabase, itemId, {
      deal_contacts_index: index,
      deal_contacts_map: dealContactsMap,
      last_heartbeat_at: new Date().toISOString(),
    });
    await supabase.from("enrichment_jobs").update({ updated_at: new Date().toISOString() }).eq("id", jobId);
    await appendLog(supabase, jobId, {
      level: "info",
      step,
      message: `Associações negócio↔contato mapeadas: ${index}/${dealIds.length}`,
    });
  }
  await patchItemBefore(supabase, itemId, { deal_contacts_index: index, deal_contacts_complete: true, deal_contacts_map: dealContactsMap });
  return { dealContactsMap, partial: false };
}

async function discoverActivityTargets(args: {
  supabase: SupabaseClient;
  jobId: string;
  itemId: string;
  step: StepName;
  kind: string;
  entities: { fromObj: string; ids: string[]; key: "companyId" | "contactId" | "dealId" }[];
  resume: ResumeState;
  deadlineAt: number;
}) {
  const { supabase, jobId, itemId, step, kind, entities, resume, deadlineAt } = args;
  const targetIds = [...(resume.target_ids ?? [])];
  const parents = { ...(resume.parents_map ?? {}) } as Record<string, { contactId?: string; companyId?: string; dealId?: string }>;
  const seen = new Set(targetIds);
  let entityIndex = resume.discovery_entity_index ?? 0;
  let idIndex = resume.discovery_id_index ?? 0;
  const CHUNK = 500;

  while (entityIndex < entities.length) {
    const ent = entities[entityIndex];
    while (idIndex < ent.ids.length) {
      if (Date.now() >= deadlineAt - 1_500) {
        await patchItemBefore(supabase, itemId, {
          discovery_entity_index: entityIndex,
          discovery_id_index: idIndex,
          target_ids: targetIds,
          parents_map: parents,
          discovered: targetIds.length,
        });
        return { targetIds, parents, partial: true };
      }
      const chunk = ent.ids.slice(idIndex, idIndex + CHUNK);
      const assoc = await getAssocMany(ent.fromObj, chunk, kind, 20);
      for (const [, list] of assoc.entries()) {
        for (const eid of list) {
          const cur = parents[eid] ?? {};
          cur[ent.key] ??= undefined;
          cur[ent.key] = cur[ent.key] ?? undefined;
          parents[eid] = { ...cur, [ent.key]: cur[ent.key] ?? undefined };
          if (!seen.has(eid)) {
            seen.add(eid);
            targetIds.push(eid);
          }
        }
      }
      for (const [fid, list] of assoc.entries()) {
        for (const eid of list) parents[eid] = { ...(parents[eid] ?? {}), [ent.key]: fid };
      }
      idIndex += chunk.length;
      await patchItemBefore(supabase, itemId, {
        discovery_entity_index: entityIndex,
        discovery_id_index: idIndex,
        target_ids: targetIds,
        parents_map: parents,
        discovered: targetIds.length,
        last_heartbeat_at: new Date().toISOString(),
      });
      await supabase.from("enrichment_jobs").update({ updated_at: new Date().toISOString() }).eq("id", jobId);
      await appendLog(supabase, jobId, {
        level: "info",
        step,
        message: `Associações ${ent.fromObj}→${kind}: ${idIndex}/${ent.ids.length}, ${targetIds.length} itens únicos`,
      });
    }
    entityIndex++;
    idIndex = 0;
  }
  await patchItemBefore(supabase, itemId, {
    discovery_entity_index: entityIndex,
    discovery_id_index: idIndex,
    discovery_complete: true,
    target_ids: targetIds,
    parents_map: parents,
    discovered: targetIds.length,
  });
  return { targetIds, parents, partial: false };
}


const DEFAULT_BUDGET_MS = 22_000;

export async function runStep(ctx: StepCtx): Promise<StepResult> {
  const { supabase, userId, jobId, step, itemId, scope } = ctx;
  const deadlineAt = ctx.deadlineAt ?? Date.now() + DEFAULT_BUDGET_MS;
  const isExpired = () => Date.now() >= deadlineAt;

  const resume = await loadResume(supabase, itemId);
  const isResume = Boolean(resume.cursor || resume.read_index || resume.imported_hs_ids?.length);

  // Initialize / preserve before
  const baseBefore: Record<string, unknown> = {
    ...resume,
    step,
    order: STEP_ORDER.indexOf(step),
    depends_on: STEP_DEPS[step],
    started_at: resume.started_at ?? new Date().toISOString(),
    cursor: resume.cursor,
    read_index: resume.read_index ?? 0,
    running_succeeded: resume.running_succeeded ?? 0,
    running_failed: resume.running_failed ?? 0,
    discovered: resume.discovered,
    imported_hs_ids: resume.imported_hs_ids ?? [],
    last_heartbeat_at: new Date().toISOString(),
    paused: false,
  };
  await supabase
    .from("enrichment_job_items")
    .update({ status: "running", before: baseBefore as never })
    .eq("id", itemId);
  await appendLog(supabase, jobId, {
    level: "info",
    step,
    message: isResume ? `Retomando etapa ${step} (cursor=${resume.cursor ?? "—"}, idx=${resume.read_index ?? 0})` : `Iniciando etapa ${step}`,
  });
  const bump = makeProgressBumper(supabase, itemId, jobId);

  let ok = (resume.running_succeeded as number) ?? 0;
  let fail = (resume.running_failed as number) ?? 0;
  const imported: string[] = [...(resume.imported_hs_ids ?? [])];
  let partial = false;

  // Persist progress + cursor (used on each pause / page boundary)
  const persistCursor = async (extra: Record<string, unknown>) => {
    await patchItemBefore(supabase, itemId, {
      running_succeeded: ok,
      running_failed: fail,
      imported_hs_ids: imported,
      ...extra,
    });
  };

  try {
    if (step === "companies") {
      const allProps = await loadHsProperties("companies");
      const propsParam = allProps.length
        ? allProps.join(",")
        : "name,domain,industry,numberofemployees,phone,city,state,zip,address,website";
      const alreadyProcessed = ok + fail;
      let after: string | undefined = resume.cursor ?? (alreadyProcessed > 0 ? String(alreadyProcessed) : undefined);
      let page = Math.floor(alreadyProcessed / 100) + 1;
      // Descobre o total real no HubSpot apenas na primeira execução do step
      if (resume.discovered === undefined) {
        const total = await discoverTotal("companies");
        if (total !== null) {
          const effective = Math.min(total, scope.maxCompanies);
          await patchItemBefore(supabase, itemId, { discovered: effective });
          await appendLog(supabase, jobId, {
            level: "info",
            step,
            message: `Total no HubSpot: ${total} · alvo desta execução: ${effective}`,
          });
        }
      }
      while (ok + fail < scope.maxCompanies) {
        if (isExpired()) {
          partial = true;
          await persistCursor({ cursor: after ?? (ok + fail > 0 ? String(ok + fail) : undefined) });
          break;
        }
        const remaining = scope.maxCompanies - (ok + fail);
        const limit = Math.min(100, remaining);
        const params: Record<string, string> = { limit: String(limit), properties: propsParam };
        if (after) params.after = after;
        const res = (await hsFetch("/crm/v3/objects/companies", params)) as {
          results: (HSRec & { createdAt?: string; updatedAt?: string })[];
          paging?: { next?: { after: string } };
        };
        if (!res.results.length) break;
        await appendLog(supabase, jobId, {
          level: "info",
          step,
          message: `Página ${page}: ${res.results.length} empresas`,
          count: res.results.length,
        });
        type Task = { hsId: string; name: string; payload: Record<string, unknown> };
        const tasks: Task[] = [];
        for (const c of res.results) {
          const p = c.properties;
          if (!p.name) continue;
          const mapped = mapCompany(p);
          tasks.push({
            hsId: c.id,
            name: p.name as string,
            payload: {
              owner_id: userId,
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
              ...mapped,
              external_ids: { hubspot: c.id } as never,
              hs_raw: rawOf(c),
            },
          });
        }

        // Conta como falha os registros sem nome
        fail += res.results.length - tasks.length;

        const CONCURRENCY = 12;
        for (let i = 0; i < tasks.length; i += CONCURRENCY) {
          const batch = tasks.slice(i, i + CONCURRENCY);
          const results = await Promise.all(
            batch.map((t) => upsertByHsId(supabase, "companies", userId, t.hsId, t.payload)),
          );
          for (let j = 0; j < results.length; j++) {
            const r = results[j];
            if (r.status === "failed") {
              fail++;
              await appendLog(supabase, jobId, {
                level: "warn",
                step,
                message: `Falha empresa ${batch[j].name}: ${r.error}`,
              });
            } else {
              imported.push(batch[j].hsId);
              ok++;
            }
          }
          await bump(ok, fail);
        }
        after = res.paging?.next?.after;
        await persistCursor({ cursor: after ?? null, last_processed: ok + fail });
        await bump(ok, fail);
        page++;
        if (!after) break;
      }
      await patchItemBefore(supabase, itemId, { discovered: ok + fail });
    } else if (step === "contacts") {
      // Fase 1 (cacheada em before.target_ids/parent_map): mapear contatos↔empresas.
      // Fase 2: batchRead em chunks pequenos com checkpoint a cada chunk.
      const companyMap = await loadMapForStep(supabase, userId, jobId, "companies", "companies");
      let targetIds = resume.target_ids as string[] | undefined;
      let parentMap = resume.parent_map as Record<string, string> | undefined;
      if (!targetIds || !parentMap || !resume.discovery_complete) {
        const hsCompanyIds = [...companyMap.keys()];
        if ((resume.assoc_index ?? 0) === 0) {
          await appendLog(supabase, jobId, {
            level: "info", step,
            message: `Mapeando contatos para ${hsCompanyIds.length} empresas`,
          });
          if (hsCompanyIds.length === 0) {
            targetIds = [];
            parentMap = {};
            await patchItemBefore(supabase, itemId, {
              assoc_index: 0,
              discovery_complete: true,
              target_ids: [],
              parent_map: {},
              discovered: 0,
            });
          }
        }
        if (targetIds === undefined || parentMap === undefined) {
          const discovery = await discoverTargetsFromAssociations({
            supabase,
            jobId,
            itemId,
            step,
            fromObj: "companies",
            fromIds: hsCompanyIds,
            toObj: "contacts",
            resume,
            deadlineAt,
          });
          targetIds = discovery.targetIds;
          parentMap = discovery.parentMap;
          await bump(0, 0, targetIds.length, true);
          if (discovery.partial) {
            partial = true;
            await persistCursor({ discovered: targetIds.length });
            await patchItemBefore(supabase, itemId, {
              paused: true,
              last_heartbeat_at: new Date().toISOString(),
            });
            await appendLog(supabase, jobId, {
              level: "info",
              step,
              message: `Mapeamento de contatos pausado para próximo tick (${targetIds.length} contatos encontrados)`,
            });
            return { succeeded: ok, failed: fail, importedHsIds: imported, partial: true };
          }
        }
        await appendLog(supabase, jobId, {
          level: "info", step,
          message: `Plano: ${targetIds.length} contatos a importar`,
        });
      }
      const contactProps = await loadHsProperties("contacts");
      const propsList = contactProps.length
        ? contactProps
        : ["firstname", "lastname", "email", "phone", "jobtitle", "lifecyclestage"];
      let idx = (resume.read_index as number) ?? 0;
      const CHUNK = 100;
      while (idx < targetIds.length) {
        if (isExpired()) { partial = true; break; }
        const chunkIds = targetIds.slice(idx, idx + CHUNK);
        const recs = await batchRead("contacts", chunkIds, propsList);
        const byId = new Map(recs.map((r) => [r.id, r]));
        for (const hsId of chunkIds) {
          const c = byId.get(hsId);
          if (!c) { fail++; continue; }
          const p = c.properties;
          if (!p.firstname && !p.email) { fail++; continue; }
          const localCompanyId = companyMap.get(parentMap[hsId] ?? "") ?? null;
          const mapped = mapContact(p);
          const payload = {
            owner_id: userId,
            first_name: (p.firstname ?? p.email ?? "Sem nome") as string,
            last_name: p.lastname ?? null,
            email: p.email ?? null,
            phone: p.phone ?? null,
            job_title: p.jobtitle ?? null,
            company_id: localCompanyId,
            ...mapped,
            external_ids: { hubspot: c.id, hs_lifecyclestage: p.lifecyclestage ?? null } as never,
            hs_raw: rawOf(c),
          };
          const r = await upsertByHsId(supabase, "contacts", userId, c.id, payload);
          if (r.status === "failed") fail++;
          else { imported.push(c.id); ok++; }
        }
        idx += chunkIds.length;
        await persistCursor({ read_index: idx });
        await bump(ok, fail, targetIds.length);
      }
      if (partial) await persistCursor({ read_index: idx });
      else await persistCursor({ read_index: targetIds.length });
    } else if (step === "deals") {
      const companyMap = await loadMapForStep(supabase, userId, jobId, "companies", "companies");
      const contactMap = await loadMapForStep(supabase, userId, jobId, "contacts", "contacts");
      let targetIds = resume.target_ids as string[] | undefined;
      let parentMap = resume.parent_map as Record<string, string> | undefined;
      let dealContactsMap = resume.deal_contacts_map as Record<string, string[]> | undefined;
      if (!targetIds || !parentMap || !resume.discovery_complete) {
        const hsCompanyIds = [...companyMap.keys()];
        if ((resume.assoc_index ?? 0) === 0) {
          await appendLog(supabase, jobId, {
            level: "info", step,
            message: `Mapeando negócios para ${hsCompanyIds.length} empresas`,
          });
        }
        const discovery = await discoverTargetsFromAssociations({
          supabase,
          jobId,
          itemId,
          step,
          fromObj: "companies",
          fromIds: hsCompanyIds,
          toObj: "deals",
          resume,
          deadlineAt,
        });
        targetIds = discovery.targetIds;
        parentMap = discovery.parentMap;
        await bump(0, 0, targetIds.length, true);
        if (discovery.partial) {
          await persistCursor({ discovered: targetIds.length });
          await patchItemBefore(supabase, itemId, { paused: true, last_heartbeat_at: new Date().toISOString() });
          await appendLog(supabase, jobId, {
            level: "info",
            step,
            message: `Mapeamento de negócios pausado para próximo tick (${targetIds.length} negócios encontrados)`,
          });
          return { succeeded: ok, failed: fail, importedHsIds: imported, partial: true };
        }
        await appendLog(supabase, jobId, {
          level: "info", step,
          message: `Plano: ${targetIds.length} negócios a importar`,
        });
      }
      if (!dealContactsMap || !resume.deal_contacts_complete) {
        const discovery = await discoverDealContactsMap({ supabase, jobId, itemId, step, dealIds: targetIds, resume: await loadResume(supabase, itemId), deadlineAt });
        dealContactsMap = discovery.dealContactsMap;
        if (discovery.partial) {
          await patchItemBefore(supabase, itemId, { paused: true, last_heartbeat_at: new Date().toISOString() });
          await appendLog(supabase, jobId, { level: "info", step, message: "Mapeamento de contatos dos negócios pausado para próximo tick" });
          return { succeeded: ok, failed: fail, importedHsIds: imported, partial: true };
        }
      }
      const dealProps = await loadHsProperties("deals");
      const dealPropsList = dealProps.length ? dealProps : ["dealname", "amount", "dealstage", "closedate", "pipeline"];
      let idx = (resume.read_index as number) ?? 0;
      const CHUNK = 100;
      while (idx < targetIds.length) {
        if (isExpired()) { partial = true; break; }
        const chunkIds = targetIds.slice(idx, idx + CHUNK);
        const recs = await batchRead("deals", chunkIds, dealPropsList);
        const byId = new Map(recs.map((r) => [r.id, r]));
        for (const hsId of chunkIds) {
          const d = byId.get(hsId);
          if (!d) { fail++; continue; }
          const p = d.properties;
          const localCompanyId = companyMap.get(parentMap[hsId] ?? "") ?? null;
          const mapped = mapDeal(p);
          const payload = {
            owner_id: userId,
            name: p.dealname ?? "Sem nome",
            value: p.amount ? Number(p.amount) : 0,
            currency: "BRL",
            stage: "new",
            company_id: localCompanyId,
            expected_close_date: p.closedate ? p.closedate.slice(0, 10) : null,
            ...mapped,
            external_ids: { hubspot: d.id, hs_stage: p.dealstage, hs_pipeline: p.pipeline } as never,
            hs_raw: rawOf(d),
          };
          const r = await upsertByHsId(supabase, "deals", userId, d.id, payload);
          if (r.status === "failed") fail++;
          else {
            imported.push(d.id);
            ok++;
            if (r.status === "inserted") {
              const contactIds = dealContactsMap[d.id] ?? [];
              for (const cid of contactIds) {
                const lc = contactMap.get(cid);
                if (lc && r.localId) {
                  await supabase.from("deal_contacts").insert({ deal_id: r.localId, contact_id: lc });
                }
              }
            }
          }
        }
        idx += chunkIds.length;
        await persistCursor({ read_index: idx });
        await bump(ok, fail, targetIds.length);
      }
      if (partial) await persistCursor({ read_index: idx });
      else await persistCursor({ read_index: targetIds.length });
    } else if (step === "leads") {
      let targetIds = resume.target_ids as string[] | undefined;
      if (!targetIds) {
        const { data: items } = await supabase
          .from("enrichment_job_items")
          .select("after, before")
          .eq("job_id", jobId);
        const contactsItem = (items ?? []).find((it) => (it.before as { step?: string } | null)?.step === "contacts");
        const importedContactHs = (contactsItem?.after as { imported_hs_ids?: string[] } | null)?.imported_hs_ids ?? [];
        const leadHsIds: string[] = [];
        for (let i = 0; i < importedContactHs.length; i += 200) {
          const chunk = importedContactHs.slice(i, i + 200);
          const { data } = await supabase
            .from("contacts")
            .select("external_ids")
            .eq("owner_id", userId)
            .in("external_ids->>hubspot", chunk)
            .eq("external_ids->>hs_lifecyclestage", "lead");
          for (const r of data ?? []) {
            const hs = (r.external_ids as { hubspot?: string } | null)?.hubspot;
            if (hs) leadHsIds.push(String(hs));
          }
        }
        targetIds = leadHsIds;
        await patchItemBefore(supabase, itemId, {
          target_ids: targetIds as never,
          discovered: targetIds.length,
        });
        await bump(0, 0, targetIds.length, true);
        await appendLog(supabase, jobId, {
          level: "info", step,
          message: `Plano: ${targetIds.length} leads`,
        });
      }
      const leadProps = await loadHsProperties("contacts");
      const leadPropsList = leadProps.length
        ? leadProps
        : ["firstname", "lastname", "email", "phone", "company", "hs_lead_status", "hs_analytics_source"];
      let idx = (resume.read_index as number) ?? 0;
      const CHUNK = 100;
      while (idx < targetIds.length) {
        if (isExpired()) { partial = true; break; }
        const chunkIds = targetIds.slice(idx, idx + CHUNK);
        const recs = await batchRead("contacts", chunkIds, leadPropsList);
        for (const c of recs) {
          const p = c.properties;
          const mapped = mapLead(p);
          const payload = {
            owner_id: userId,
            first_name: (p.firstname ?? p.email ?? "Sem nome") as string,
            last_name: p.lastname ?? null,
            email: p.email ?? null,
            phone: p.phone ?? null,
            company_name: p.company ?? null,
            source: p.hs_analytics_source ?? "hubspot",
            status: "new",
            ...mapped,
            external_ids: { hubspot: c.id } as never,
            hs_raw: rawOf(c),
          };
          const r = await upsertByHsId(supabase, "leads", userId, c.id, payload);
          if (r.status === "failed") fail++;
          else { imported.push(c.id); ok++; }
        }
        idx += chunkIds.length;
        await persistCursor({ read_index: idx });
        await bump(ok, fail, targetIds.length);
      }
      if (partial) await persistCursor({ read_index: idx });
      else await persistCursor({ read_index: targetIds.length });
    } else if (step.startsWith("activities-")) {
      const kind = step.replace("activities-", "") as "notes" | "calls" | "meetings" | "tasks" | "emails";
      const TYPE_MAP: Record<typeof kind, { type: "note" | "call" | "meeting" | "task" | "email"; props: string[] }> = {
        notes: { type: "note", props: ["hs_note_body", "hs_timestamp"] },
        calls: { type: "call", props: ["hs_call_title", "hs_call_body", "hs_timestamp", "hs_call_disposition"] },
        meetings: { type: "meeting", props: ["hs_meeting_title", "hs_meeting_body", "hs_timestamp"] },
        tasks: { type: "task", props: ["hs_task_subject", "hs_task_body", "hs_timestamp", "hs_task_status"] },
        emails: { type: "email", props: ["hs_email_subject", "hs_email_text", "hs_timestamp"] },
      };
      const t = TYPE_MAP[kind];

      const companyMap = await loadMapForStep(supabase, userId, jobId, "companies", "companies");
      const contactMap = await loadMapForStep(supabase, userId, jobId, "contacts", "contacts");
      const dealMap = await loadMapForStep(supabase, userId, jobId, "deals", "deals");

      let targetIds = resume.target_ids as string[] | undefined;
      type Parents = { contactId?: string; companyId?: string; dealId?: string };
      let parents = resume.parents_map as Record<string, Parents> | undefined;
      if (!targetIds || !parents || !resume.discovery_complete) {
        const entities: { fromObj: string; ids: string[]; key: "companyId" | "contactId" | "dealId" }[] = [
          { fromObj: "companies", ids: [...companyMap.keys()], key: "companyId" },
          { fromObj: "contacts", ids: [...contactMap.keys()], key: "contactId" },
          { fromObj: "deals", ids: [...dealMap.keys()], key: "dealId" },
        ];
        const discovery = await discoverActivityTargets({ supabase, jobId, itemId, step, kind, entities, resume, deadlineAt });
        targetIds = discovery.targetIds;
        parents = discovery.parents;
        await bump(0, 0, targetIds.length, true);
        if (discovery.partial) {
          await patchItemBefore(supabase, itemId, { paused: true, last_heartbeat_at: new Date().toISOString() });
          await appendLog(supabase, jobId, {
            level: "info",
            step,
            message: `Mapeamento de ${kind} pausado para próximo tick (${targetIds.length} encontrados)`,
          });
          return { succeeded: ok, failed: fail, importedHsIds: imported, partial: true };
        }
        await appendLog(supabase, jobId, {
          level: "info", step,
          message: `Plano: ${targetIds.length} ${kind}`,
        });
      }
      if (targetIds.length === 0) {
        await appendLog(supabase, jobId, { level: "info", step, message: `Sem ${kind}` });
      } else {
        const allActProps = await loadHsProperties(kind);
        const actPropsList = allActProps.length ? allActProps : t.props;
        let idx = (resume.read_index as number) ?? 0;
        const CHUNK = 100;
        while (idx < targetIds.length) {
          if (isExpired()) { partial = true; break; }
          const chunkIds = targetIds.slice(idx, idx + CHUNK);
          const recs = await batchRead(kind, chunkIds, actPropsList);
          for (const a of recs) {
            const p = a.properties;
            const subject =
              p.hs_note_body?.replace(/<[^>]+>/g, "").slice(0, 100) ??
              p.hs_call_title ?? p.hs_meeting_title ?? p.hs_task_subject ?? p.hs_email_subject ?? t.type;
            const body =
              p.hs_note_body ?? p.hs_call_body ?? p.hs_meeting_body ?? p.hs_task_body ?? p.hs_email_text ?? null;
            const due = p.hs_timestamp ?? null;
            const pr = parents[a.id] ?? {};
            const mapped = mapActivity(kind, p);
            const payload = {
              owner_id: userId,
              type: t.type,
              subject,
              body,
              due_date: due,
              completed: t.type !== "task",
              related_contact_id: pr.contactId ? contactMap.get(pr.contactId) ?? null : null,
              related_company_id: pr.companyId ? companyMap.get(pr.companyId) ?? null : null,
              related_deal_id: pr.dealId ? dealMap.get(pr.dealId) ?? null : null,
              ...mapped,
              external_ids: { hubspot: a.id, hs_kind: kind } as never,
              hs_raw: rawOf(a),
            };
            const r = await upsertByHsId(supabase, "activities", userId, a.id, payload);
            if (r.status === "failed") fail++;
            else { imported.push(a.id); ok++; }
          }
          idx += chunkIds.length;
          await persistCursor({ read_index: idx });
          await bump(ok, fail, targetIds.length);
        }
        if (partial) await persistCursor({ read_index: idx });
        else await persistCursor({ read_index: targetIds.length });
      }
    }

    if (partial) {
      // Mantém status='running' para evitar flicker na UI; o próximo tick
      // reclama itens com (status='pending') OU (status='running' AND before.paused=true).
      await patchItemBefore(supabase, itemId, {
        paused: true,
        last_heartbeat_at: new Date().toISOString(),
      });
      await appendLog(supabase, jobId, {
        level: "info",
        step,
        message: `Etapa ${step} pausada para próximo tick (${ok} ok / ${fail} falhas)`,
      });
      return { succeeded: ok, failed: fail, importedHsIds: imported, partial: true };
    }

    await supabase
      .from("enrichment_job_items")
      .update({
        status: "done",
        after: {
          succeeded: ok,
          failed: fail,
          finished_at: new Date().toISOString(),
          imported_hs_ids: imported,
        } as never,
      })
      .eq("id", itemId);
    await appendLog(supabase, jobId, {
      level: "info",
      step,
      message: `Etapa ${step} concluída: ${ok} ok / ${fail} falhas`,
    });
    return { succeeded: ok, failed: fail, importedHsIds: imported };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase
      .from("enrichment_job_items")
      .update({ status: "failed", error: msg, after: { succeeded: ok, failed: fail, imported_hs_ids: imported } as never })
      .eq("id", itemId);
    await appendLog(supabase, jobId, { level: "error", step, message: msg });
    throw e;
  }
}

// Pick the next pending item in the job whose dependencies are all 'done'.
export async function pickNextItem(
  supabase: SupabaseClient,
  jobId: string,
): Promise<{ itemId: string; step: StepName } | null> {
  const { data: rows } = await supabase
    .from("enrichment_job_items")
    .select("id, status, before")
    .eq("job_id", jobId);
  const items = (rows ?? []) as ItemRow[];
  const doneSteps = new Set(items.filter((it) => it.status === "done").map((it) => it.before?.step ?? ""));
  const pending = items
    .filter((it) => it.status === "pending")
    .sort((a, b) => (a.before?.order ?? 0) - (b.before?.order ?? 0));
  for (const it of pending) {
    const deps = it.before?.depends_on ?? [];
    if (deps.every((d) => doneSteps.has(d))) {
      return { itemId: it.id, step: (it.before?.step ?? "") as StepName };
    }
  }
  return null;
}

export async function finalizeJob(supabase: SupabaseClient, jobId: string) {
  const { data: rows } = await supabase
    .from("enrichment_job_items")
    .select("status, after")
    .eq("job_id", jobId);
  const items = (rows ?? []) as ItemRow[];
  const total = items.length;
  const doneCount = items.filter((it) => it.status === "done").length;
  const failedCount = items.filter((it) => it.status === "failed").length;
  let succeeded = 0;
  let failed = 0;
  for (const it of items) {
    succeeded += (it.after?.succeeded as number | undefined) ?? 0;
    failed += (it.after?.failed as number | undefined) ?? 0;
  }
  const allDone = doneCount + failedCount === total;
  if (!allDone) {
    await supabase
      .from("enrichment_jobs")
      .update({ processed: doneCount + failedCount, succeeded, failed })
      .eq("id", jobId);
    return false;
  }
  await supabase
    .from("enrichment_jobs")
    .update({
      status: failedCount > 0 && doneCount === 0 ? "failed" : "done",
      processed: total,
      succeeded,
      failed,
      finished_at: new Date().toISOString(),
    })
    .eq("id", jobId);
  return true;
}
