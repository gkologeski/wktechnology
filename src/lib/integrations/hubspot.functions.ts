// HubSpot import via Lovable Connector Gateway
// Orquestra importação respeitando árvore de dependências:
// companies → contacts → deals (+ deal_contacts) → leads → activities
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/hubspot";

// ─────────────────────────── HTTP helper ──────────────────────────────────────
async function hsFetch(path: string, params?: Record<string, string>) {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");
  const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
  if (!HUBSPOT_API_KEY) throw new Error("Conecte o HubSpot para continuar");

  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  const res = await fetch(`${GATEWAY_URL}${path}${qs}`, {
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": HUBSPOT_API_KEY,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`HubSpot [${res.status}]: ${JSON.stringify(data).slice(0, 300)}`);
  return data;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────── Preview counts ───────────────────────────────────
export const previewHubspotCounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    async function count(obj: string): Promise<number> {
      try {
        const r = await hsFetch(`/crm/v3/objects/${obj}/search`, {});
        // search endpoint actually requires POST; fallback to listing first page total
        return (r as { total?: number }).total ?? 0;
      } catch {
        try {
          const r = await hsFetch(`/crm/v3/objects/${obj}`, { limit: "1" });
          return (r as { total?: number }).total ?? -1;
        } catch {
          return -1;
        }
      }
    }
    const [companies, contacts, deals] = await Promise.all([
      count("companies"),
      count("contacts"),
      count("deals"),
    ]);
    return { companies, contacts, deals };
  });

// ─────────────────────────── Import orchestrator ──────────────────────────────
const ScopeSchema = z.object({
  companies: z.boolean().default(true),
  contacts: z.boolean().default(true),
  deals: z.boolean().default(true),
  leads: z.boolean().default(false),
  activities: z.boolean().default(false),
  maxPerObject: z.number().int().min(1).max(2000).default(500),
});
type Scope = z.infer<typeof ScopeSchema>;

type LogEntry = { ts: string; level: "info" | "warn" | "error"; step: string; message: string; count?: number };

const STEP_ORDER = ["companies", "contacts", "deals", "deal_contacts", "leads", "activities"] as const;
type StepName = (typeof STEP_ORDER)[number];

const STEP_DEPS: Record<StepName, StepName[]> = {
  companies: [],
  contacts: ["companies"],
  deals: ["companies", "contacts"],
  deal_contacts: ["deals", "contacts"],
  leads: [],
  activities: ["contacts", "companies", "deals"],
};

function planSteps(scope: Scope): StepName[] {
  const wanted = new Set<StepName>();
  if (scope.companies) wanted.add("companies");
  if (scope.contacts) {
    wanted.add("contacts");
    wanted.add("companies");
  }
  if (scope.deals) {
    wanted.add("deals");
    wanted.add("deal_contacts");
    wanted.add("companies");
    wanted.add("contacts");
  }
  if (scope.leads) wanted.add("leads");
  if (scope.activities) {
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

    // Create parent job
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

    // Create one item per step
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
      // find by job_id + before->>step
      const { data: items } = await supabase
        .from("enrichment_job_items")
        .select("id, before")
        .eq("job_id", jobId);
      const target = (items ?? []).find(
        (it) => (it.before as { step?: string } | null)?.step === step
      );
      if (!target) return;
      const merged: Record<string, unknown> = {};
      if (patch.status) merged.status = patch.status;
      if (patch.before) merged.before = { ...(target.before as object), ...patch.before };
      if (patch.after) merged.after = patch.after;
      await supabase.from("enrichment_job_items").update(merged as never).eq("id", target.id);
    };

    // ID maps: hubspotId → localId
    const companyMap = new Map<string, string>();
    const contactMap = new Map<string, string>();
    const dealMap = new Map<string, string>();

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
          while (stepOk + stepFail < scope.maxPerObject) {
            const remaining = scope.maxPerObject - (stepOk + stepFail);
            const limit = Math.min(100, remaining);
            const params: Record<string, string> = {
              limit: String(limit),
              properties: "name,domain,industry,numberofemployees,phone,city,state,zip,address,website",
            };
            if (after) params.after = after;
            const res = (await hsFetch("/crm/v3/objects/companies", params)) as {
              results: { id: string; properties: Record<string, string | null | undefined> }[];
              paging?: { next?: { after: string } };
            };
            if (!res.results.length) break;
            await appendLog({ level: "info", step, message: `Página ${page}: ${res.results.length} empresas`, count: res.results.length });

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
          let after: string | undefined;
          let page = 1;
          while (stepOk + stepFail < scope.maxPerObject) {
            const remaining = scope.maxPerObject - (stepOk + stepFail);
            const limit = Math.min(100, remaining);
            const params: Record<string, string> = {
              limit: String(limit),
              properties: "firstname,lastname,email,phone,jobtitle,company",
              associations: "companies",
            };
            if (after) params.after = after;
            const res = (await hsFetch("/crm/v3/objects/contacts", params)) as {
              results: {
                id: string;
                properties: Record<string, string | null | undefined>;
                associations?: { companies?: { results: { id: string }[] } };
              }[];
              paging?: { next?: { after: string } };
            };
            if (!res.results.length) break;
            await appendLog({ level: "info", step, message: `Página ${page}: ${res.results.length} contatos`, count: res.results.length });

            for (const c of res.results) {
              const p = c.properties;
              if (!p.firstname && !p.email) {
                stepFail++;
                continue;
              }
              const hsCompanyId = c.associations?.companies?.results?.[0]?.id;
              const localCompanyId = hsCompanyId ? companyMap.get(hsCompanyId) ?? null : null;
              if (hsCompanyId && !localCompanyId) {
                await appendLog({
                  level: "warn",
                  step,
                  message: `Contato ${p.email ?? p.firstname}: empresa ${hsCompanyId} fora do escopo, importado sem vínculo`,
                });
              }
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
            after = res.paging?.next?.after;
            page++;
            if (!after) break;
            await sleep(150);
          }
        } else if (step === "deals") {
          let after: string | undefined;
          let page = 1;
          while (stepOk + stepFail < scope.maxPerObject) {
            const remaining = scope.maxPerObject - (stepOk + stepFail);
            const limit = Math.min(100, remaining);
            const params: Record<string, string> = {
              limit: String(limit),
              properties: "dealname,amount,dealstage,closedate,pipeline",
              associations: "companies,contacts",
            };
            if (after) params.after = after;
            const res = (await hsFetch("/crm/v3/objects/deals", params)) as {
              results: {
                id: string;
                properties: Record<string, string | null | undefined>;
                associations?: {
                  companies?: { results: { id: string }[] };
                  contacts?: { results: { id: string }[] };
                };
              }[];
              paging?: { next?: { after: string } };
            };
            if (!res.results.length) break;
            await appendLog({ level: "info", step, message: `Página ${page}: ${res.results.length} negócios`, count: res.results.length });

            for (const d of res.results) {
              const p = d.properties;
              const hsCompanyId = d.associations?.companies?.results?.[0]?.id;
              const hsContactId = d.associations?.contacts?.results?.[0]?.id;
              const localCompanyId = hsCompanyId ? companyMap.get(hsCompanyId) ?? null : null;
              const localContactId = hsContactId ? contactMap.get(hsContactId) ?? null : null;
              const { data: row, error } = await supabase
                .from("deals")
                .insert({
                  owner_id: userId,
                  name: p.dealname ?? "Sem nome",
                  value: p.amount ? Number(p.amount) : 0,
                  currency: "BRL",
                  stage: "new",
                  company_id: localCompanyId,
                  primary_contact_id: localContactId,
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
                // collect deal_contacts associations
                const allContacts = d.associations?.contacts?.results ?? [];
                for (const ac of allContacts) {
                  const lc = contactMap.get(ac.id);
                  if (lc) {
                    await supabase.from("deal_contacts").insert({ deal_id: row.id, contact_id: lc });
                  }
                }
              }
            }
            after = res.paging?.next?.after;
            page++;
            if (!after) break;
            await sleep(150);
          }
        } else if (step === "deal_contacts") {
          // Already handled inline within deals step. Just log a summary.
          await appendLog({ level: "info", step, message: "Vínculos deal↔contact registrados durante a importação de negócios" });
          stepOk = dealMap.size;
        } else if (step === "leads") {
          // Treat HubSpot contacts with lifecyclestage=lead as leads (separate from contacts table).
          let after: string | undefined;
          let page = 1;
          while (stepOk + stepFail < scope.maxPerObject) {
            const remaining = scope.maxPerObject - (stepOk + stepFail);
            const limit = Math.min(100, remaining);
            const params: Record<string, string> = {
              limit: String(limit),
              properties: "firstname,lastname,email,phone,company,hs_lead_status,lifecyclestage,hs_analytics_source",
            };
            if (after) params.after = after;
            const res = (await hsFetch("/crm/v3/objects/contacts", params)) as {
              results: { id: string; properties: Record<string, string | null | undefined> }[];
              paging?: { next?: { after: string } };
            };
            if (!res.results.length) break;
            const onlyLeads = res.results.filter((c) => c.properties.lifecyclestage === "lead" || !!c.properties.hs_lead_status);
            await appendLog({ level: "info", step, message: `Página ${page}: ${onlyLeads.length} leads (de ${res.results.length} contatos)`, count: onlyLeads.length });

            for (const c of onlyLeads) {
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
              if (error) {
                stepFail++;
              } else {
                stepOk++;
              }
            }
            after = res.paging?.next?.after;
            page++;
            if (!after) break;
            await sleep(150);
          }
        } else if (step === "activities") {
          // Pull notes/calls/meetings/tasks/emails. Map to activities, attach to associated entities.
          const types: { obj: string; type: "note" | "call" | "meeting" | "task" | "email"; props: string }[] = [
            { obj: "notes", type: "note", props: "hs_note_body,hs_timestamp" },
            { obj: "calls", type: "call", props: "hs_call_title,hs_call_body,hs_timestamp,hs_call_disposition" },
            { obj: "meetings", type: "meeting", props: "hs_meeting_title,hs_meeting_body,hs_timestamp" },
            { obj: "tasks", type: "task", props: "hs_task_subject,hs_task_body,hs_timestamp,hs_task_status" },
            { obj: "emails", type: "email", props: "hs_email_subject,hs_email_text,hs_timestamp" },
          ];
          let totalForStep = 0;
          for (const t of types) {
            if (totalForStep >= scope.maxPerObject) break;
            try {
              const remaining = scope.maxPerObject - totalForStep;
              const params: Record<string, string> = {
                limit: String(Math.min(100, remaining)),
                properties: t.props,
                associations: "contacts,companies,deals",
              };
              const res = (await hsFetch(`/crm/v3/objects/${t.obj}`, params)) as {
                results: {
                  id: string;
                  properties: Record<string, string | null | undefined>;
                  associations?: {
                    contacts?: { results: { id: string }[] };
                    companies?: { results: { id: string }[] };
                    deals?: { results: { id: string }[] };
                  };
                }[];
              };
              if (!res.results.length) continue;
              await appendLog({ level: "info", step, message: `${res.results.length} ${t.obj}`, count: res.results.length });

              for (const a of res.results) {
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
                const hsContact = a.associations?.contacts?.results?.[0]?.id;
                const hsCompany = a.associations?.companies?.results?.[0]?.id;
                const hsDeal = a.associations?.deals?.results?.[0]?.id;
                const { error } = await supabase.from("activities").insert({
                  owner_id: userId,
                  type: t.type,
                  subject,
                  body,
                  due_date: due,
                  completed: t.type !== "task",
                  related_contact_id: hsContact ? contactMap.get(hsContact) ?? null : null,
                  related_company_id: hsCompany ? companyMap.get(hsCompany) ?? null : null,
                  related_deal_id: hsDeal ? dealMap.get(hsDeal) ?? null : null,
                  external_ids: { hubspot: a.id, hs_kind: t.obj } as never,
                });
                if (error) {
                  stepFail++;
                } else {
                  stepOk++;
                  totalForStep++;
                }
              }
              await sleep(150);
            } catch (e) {
              await appendLog({
                level: "warn",
                step,
                message: `Falha ao buscar ${t.obj}: ${e instanceof Error ? e.message : String(e)}`,
              });
            }
          }
        }

        totalSucceeded += stepOk;
        totalFailed += stepFail;
        await updateItem(step, {
          status: "done",
          after: { succeeded: stepOk, failed: stepFail, finished_at: new Date().toISOString() },
        });
        await appendLog({ level: "info", step, message: `Etapa ${step} concluída: ${stepOk} ok / ${stepFail} falhas` });

        // Update parent counters incrementally
        await supabase
          .from("enrichment_jobs")
          .update({ succeeded: totalSucceeded, failed: totalFailed, processed: steps.indexOf(step) + 1 })
          .eq("id", jobId);
      }

      await finishOk();
      await appendLog({ level: "info", step: "done", message: `Importação concluída: ${totalSucceeded} ok / ${totalFailed} falhas` });
      return { jobId, succeeded: totalSucceeded, failed: totalFailed };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await appendLog({ level: "error", step: "fatal", message: msg });
      await finishErr(msg);
      throw e;
    }
  });

// ─────────────────────────── Legacy compat (mantido) ──────────────────────────
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
