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

async function searchTotal(obj: string, body: object = {}): Promise<number> {
  try {
    const r = (await hsPost(`/crm/v3/objects/${obj}/search`, { limit: 1, ...body })) as { total?: number };
    return r.total ?? 0;
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

export const countHubspotObjects = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ objects: z.array(ObjectKey).min(1) }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    async function remoteCount(key: ObjectKey): Promise<number> {
      if (key === "companies") return searchTotal("companies");
      if (key === "contacts") return searchTotal("contacts");
      if (key === "deals") return searchTotal("deals");
      if (key === "leads") {
        return searchTotal("contacts", {
          filterGroups: [
            {
              filters: [{ propertyName: "lifecyclestage", operator: "EQ", value: "lead" }],
            },
          ],
        });
      }
      // activities = notes + calls + meetings + tasks + emails
      const parts = await Promise.all([
        searchTotal("notes"),
        searchTotal("calls"),
        searchTotal("meetings"),
        searchTotal("tasks"),
        searchTotal("emails"),
      ]);
      return parts.reduce((a, b) => a + b, 0);
    }

    async function localCount(key: ObjectKey): Promise<number> {
      const table = LOCAL_TABLE[key];
      const { count } = await supabase
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("owner_id", userId)
        .not("external_ids->hubspot", "is", null);
      return count ?? 0;
    }

    const out: Record<string, { local: number; remote: number }> = {};
    await Promise.all(
      data.objects.map(async (k) => {
        const [local, remote] = await Promise.all([localCount(k), remoteCount(k)]);
        out[k] = { local, remote };
      })
    );
    return out as Record<ObjectKey, { local: number; remote: number }>;
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
    // Lifecycle by contact for leads step
    const contactLifecycle = new Map<string, string | null | undefined>();

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
              const { data: row, error } = await supabase
                .from("companies")
                .insert({
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
            const { data: row, error } = await supabase
              .from("contacts")
              .insert({
                owner_id: userId,
                first_name: (p.firstname ?? p.email ?? "Sem nome") as string,
                last_name: p.lastname ?? null,
                email: p.email ?? null,
                phone: p.phone ?? null,
                job_title: p.jobtitle ?? null,
                company_id: localCompanyId,
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
            const { data: row, error } = await supabase
              .from("deals")
              .insert({
                owner_id: userId,
                name: p.dealname ?? "Sem nome",
                value: p.amount ? Number(p.amount) : 0,
                currency: "BRL",
                stage: "new",
                company_id: localCompanyId,
                expected_close_date: p.closedate ? p.closedate.slice(0, 10) : null,
                external_ids: { hubspot: d.id, hs_stage: p.dealstage, hs_pipeline: p.pipeline } as never,
              })
              .select("id")
              .single();
            if (error || !row) {
              stepFail++;
              await appendLog({ level: "warn", step, message: `Falha negócio: ${error?.message}` });
            } else {
              dealMap.set(d.id, row.id);
              stepOk++;
              // associações deal↔contact
              const contactIds = await getAssoc("deals", d.id, "contacts");
              for (const cid of contactIds) {
                const lc = contactMap.get(cid);
                if (lc) await supabase.from("deal_contacts").insert({ deal_id: row.id, contact_id: lc });
              }
              await sleep(60);
            }
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
            const { error } = await supabase.from("leads").insert({
              owner_id: userId,
              first_name: (p.firstname ?? p.email ?? "Sem nome") as string,
              last_name: p.lastname ?? null,
              email: p.email ?? null,
              phone: p.phone ?? null,
              company_name: p.company ?? null,
              source: p.hs_analytics_source ?? "hubspot",
              status: "new",
              external_ids: { hubspot: c.id } as never,
            });
            if (error) stepFail++;
            else stepOk++;
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
              const { error } = await supabase.from("activities").insert({
                owner_id: userId,
                type: t.type,
                subject,
                body,
                due_date: due,
                completed: t.type !== "task",
                related_contact_id: parents.contactId ? contactMap.get(parents.contactId) ?? null : null,
                related_company_id: parents.companyId ? companyMap.get(parents.companyId) ?? null : null,
                related_deal_id: parents.dealId ? dealMap.get(parents.dealId) ?? null : null,
                external_ids: { hubspot: a.id, hs_kind: t.obj } as never,
              });
              if (error) stepFail++;
              else stepOk++;
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
