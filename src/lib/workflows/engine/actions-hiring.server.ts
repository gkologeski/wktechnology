// Ações do ciclo de contratação (Fase 1 do plano de contratação via Workflows).
// Cada ação é um passo isolado, idempotente e restrito ao workspace do run:
// reexecutar o fluxo não duplica pessoa, contrato, alocação ou lançamentos.
// Os identificadores criados ficam em `{{vars.contratacao.*}}` para os passos
// seguintes (ex.: o contrato usa a pessoa criada no passo anterior).
import type { SupabaseClient } from "@supabase/supabase-js";
import { type AnyRow, type LogStep, renderTokens } from "../engine-shared.server";
import { createContractShared } from "@/lib/contracts/contract-create.server";
import { isContractKind, kindToColumns, type ContractKind } from "@/lib/contracts/contract-kinds";
import type { RunCtx, RunnableAction } from "./run-context";

const HIRING_TYPES = new Set([
  "create_person_from_candidate",
  "create_contract_document",
  "create_allocation",
  "create_payable_schedule",
  "create_receivable_invoice",
  "provision_workspace_user",
]);

type HiringVars = {
  person_id?: string;
  contract_id?: string;
  allocation_id?: string;
  candidate_id?: string;
};

function hiringVars(ctx: RunCtx): HiringVars {
  const vars = (ctx.vars = ctx.vars ?? {});
  const h = (vars.contratacao = (vars.contratacao as AnyRow) ?? {}) as HiringVars;
  return h;
}

/** Dados do desfecho de contratação coletados no TechHire (Fase 2). */
type HiringDetails = {
  model?: "internal" | "outsourcing" | "hunting";
  department?: string;
  modality?: string;
  employment_type?: "pj" | "clt" | "contractor" | "intern" | "other";
  role_title?: string;
  start_date?: string;
  monthly_amount?: number | string;
  hourly_rate?: number | string;
  fee_amount?: number | string;
};

function hiringDetails(ctx: RunCtx): HiringDetails {
  const raw = (ctx.after as AnyRow | null)?.hiring_details;
  return raw && typeof raw === "object" ? (raw as HiringDetails) : {};
}

function txt(ctx: RunCtx, raw: string | undefined | null): string {
  if (!raw || !raw.trim()) return "";
  return String(renderTokens(raw, ctx.after, ctx.vars) ?? "").trim();
}

/** Aceita "1234.5", "1.234,50" e tokens já resolvidos. */
function num(ctx: RunCtx, raw: string | number | undefined | null): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const s = txt(ctx, raw);
  if (!s) return null;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function isoDate(ctx: RunCtx, raw: string | undefined | null): string | null {
  const s = txt(ctx, raw);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function uuidOrNull(v: string): string | null {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : null;
}

/** Candidato e vaga de origem a partir do registro que disparou o workflow. */
function sourceIds(ctx: RunCtx): {
  candidateId: string | null;
  jobId: string | null;
  applicationId: string | null;
} {
  const after = (ctx.after ?? {}) as AnyRow;
  if (ctx.entity === "ats_applications") {
    return {
      candidateId: (after.candidate_id as string) ?? null,
      jobId: (after.job_id as string) ?? null,
      applicationId: ctx.entityId,
    };
  }
  if (ctx.entity === "ats_candidates") {
    return { candidateId: ctx.entityId, jobId: null, applicationId: null };
  }
  return { candidateId: hiringVars(ctx).candidate_id ?? null, jobId: null, applicationId: null };
}

async function resolvePersonId(
  supabase: SupabaseClient,
  ctx: RunCtx,
  explicit: string | undefined,
): Promise<string | null> {
  const fromAction = uuidOrNull(txt(ctx, explicit));
  if (fromAction) return fromAction;
  const h = hiringVars(ctx);
  if (h.person_id) return h.person_id;
  const { candidateId } = sourceIds(ctx);
  if (!candidateId) return null;
  const { data } = await supabase
    .from("people")
    .select("id")
    .eq("workspace_id", ctx.workspaceId)
    .eq("candidate_id", candidateId)
    .limit(1)
    .maybeSingle();
  const id = (data as { id?: string } | null)?.id ?? null;
  if (id) h.person_id = id;
  return id;
}

function dedupeRef(ctx: RunCtx, kind: string, subject: string): string {
  return `wf:${kind}:${ctx.workflowId ?? "manual"}:${subject}`;
}

/** Próxima data com o dia informado a partir de `from` (inclusive). */
function nthDue(from: Date, day: number, offsetMonths: number): string {
  const base = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  if (from.getUTCDate() > day) base.setUTCMonth(base.getUTCMonth() + 1);
  base.setUTCMonth(base.getUTCMonth() + offsetMonths);
  base.setUTCDate(day);
  return base.toISOString().slice(0, 10);
}

export async function handleHiringAction(
  supabase: SupabaseClient,
  action: RunnableAction,
  ctx: RunCtx,
  at: string,
): Promise<LogStep | null> {
  if (!HIRING_TYPES.has(action.type)) return null;
  if (!ctx.workspaceId) throw new Error("Workspace do registro não identificado.");
  const h = hiringVars(ctx);

  switch (action.type) {
    case "create_person_from_candidate": {
      const { candidateId, jobId } = sourceIds(ctx);
      if (!candidateId) {
        throw new Error("Use esta ação em workflows de Candidaturas ou Candidatos do TechHire.");
      }
      h.candidate_id = candidateId;
      const hd = hiringDetails(ctx);
      // Hunting/placement não gera pessoa nem headcount interno.
      if (hd.model === "hunting") {
        return {
          at,
          ok: true,
          action: action.type,
          detail: { skipped: true, reason: "contratação por hunting não cria pessoa interna" },
        };
      }
      const { data: existing, error: exErr } = await supabase
        .from("people")
        .select("id")
        .eq("workspace_id", ctx.workspaceId)
        .eq("candidate_id", candidateId)
        .limit(1)
        .maybeSingle();
      if (exErr) throw new Error(exErr.message);
      if (existing) {
        h.person_id = (existing as { id: string }).id;
        return {
          at,
          ok: true,
          action: action.type,
          detail: { skipped: true, person_id: h.person_id },
        };
      }

      const { data: cand, error: cErr } = await supabase
        .from("ats_candidates")
        .select("id, full_name, email, phone, location, workspace_id")
        .eq("id", candidateId)
        .eq("workspace_id", ctx.workspaceId)
        .maybeSingle();
      if (cErr) throw new Error(cErr.message);
      if (!cand) throw new Error("Candidato não encontrado neste workspace.");
      const c = cand as AnyRow;

      let job: AnyRow | null = null;
      if (jobId) {
        const { data } = await supabase
          .from("ats_jobs")
          .select("title, seniority")
          .eq("id", jobId)
          .maybeSingle();
        job = (data as AnyRow | null) ?? null;
      }

      const department = txt(ctx, action.department) || String(hd.department ?? "");
      const employment = action.employment_type ?? hd.employment_type ?? "pj";
      const payload = {
        workspace_id: ctx.workspaceId,
        owner_id: ctx.ownerId,
        created_by: ctx.ownerId,
        candidate_id: candidateId,
        full_name: c.full_name,
        email: c.email ?? null,
        phone: c.phone ?? null,
        location: c.location ?? null,
        employment_type: employment,
        status: "active",
        role_title:
          txt(ctx, action.role_title) || hd.role_title || ((job?.title as string) ?? null),
        seniority: (job?.seniority as string) ?? null,
        hire_date:
          isoDate(ctx, action.hire_date) ??
          isoDate(ctx, hd.start_date) ??
          new Date().toISOString().slice(0, 10),
        monthly_cost: num(ctx, action.monthly_cost) ?? num(ctx, hd.monthly_amount),
        cost_hour: num(ctx, action.cost_hour) ?? num(ctx, hd.hourly_rate),
        currency: "BRL",
        tags: department ? [department] : [],
      };
      const { data: inserted, error } = await supabase
        .from("people")
        .insert(payload as never)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      h.person_id = (inserted as { id: string }).id;
      return {
        at,
        ok: true,
        action: action.type,
        detail: { person_id: h.person_id, full_name: c.full_name, department: department || null },
      };
    }

    case "create_contract_document": {
      const personId = await resolvePersonId(supabase, ctx, action.person_id);
      if (!personId)
        throw new Error(
          "Pessoa não encontrada. Inclua antes o passo “Criar pessoa a partir do candidato”.",
        );
      const kind: ContractKind = isContractKind(action.kind) ? action.kind : "client";
      const { document_kind, role } = kindToColumns(kind, null);

      if (action.skip_if_exists !== false) {
        const { data: existing, error: exErr } = await supabase
          .from("contracts")
          .select("id")
          .eq("workspace_id", ctx.workspaceId)
          .eq("document_kind", document_kind)
          .eq("role", role)
          .contains("metadata", { person_id: personId })
          .not("status", "in", "(ended,terminated)")
          .limit(1);
        if (exErr) throw new Error(exErr.message);
        if (existing && existing.length > 0) {
          h.contract_id = (existing[0] as { id: string }).id;
          return {
            at,
            ok: true,
            action: action.type,
            detail: { skipped: true, contract_id: h.contract_id },
          };
        }
      }

      const { data: person } = await supabase
        .from("people")
        .select("full_name, legal_entity_name")
        .eq("id", personId)
        .eq("workspace_id", ctx.workspaceId)
        .maybeSingle();
      const p = (person as AnyRow | null) ?? {};

      let bodyHtml: string | null = null;
      if (action.template_id) {
        const { data: tpl } = await supabase
          .from("contract_templates")
          .select("body_html")
          .eq("id", action.template_id)
          .maybeSingle();
        bodyHtml = (tpl as { body_html?: string | null } | null)?.body_html ?? null;
      }

      const monthly = num(ctx, action.monthly_value);
      const title =
        txt(ctx, action.title) ||
        `Contrato PJ — ${String(p.legal_entity_name || p.full_name || "profissional")}`;
      const { contract } = await createContractShared(supabase, {
        workspaceId: ctx.workspaceId,
        userId: ctx.ownerId,
        kind,
        role,
        fields: {
          title,
          starts_at: isoDate(ctx, action.starts_at),
          ...(monthly !== null ? { monthly_value: monthly } : {}),
        },
        copyLineItems: false,
        bodyHtml,
        status: action.status ?? "draft",
      });
      const { candidateId, applicationId } = sourceIds(ctx);
      const { error: mErr } = await supabase
        .from("contracts")
        .update({
          metadata: {
            person_id: personId,
            candidate_id: candidateId,
            application_id: applicationId,
            origin: "workflow_hiring",
            workflow_id: ctx.workflowId ?? null,
          },
        } as never)
        .eq("id", contract.id)
        .eq("workspace_id", ctx.workspaceId);
      if (mErr) throw new Error(mErr.message);
      h.contract_id = contract.id;
      return { at, ok: true, action: action.type, detail: { contract_id: contract.id, title } };
    }

    case "create_allocation": {
      const personId = await resolvePersonId(supabase, ctx, action.person_id);
      if (!personId) throw new Error("Pessoa não encontrada para alocar.");
      const projectId = uuidOrNull(txt(ctx, action.project_id));
      let q = supabase
        .from("people_allocations")
        .select("id")
        .eq("workspace_id", ctx.workspaceId)
        .eq("person_id", personId)
        .eq("status", "active");
      q = projectId ? q.eq("project_id", projectId) : q.is("project_id", null);
      const { data: existing, error: exErr } = await q.limit(1);
      if (exErr) throw new Error(exErr.message);
      if (existing && existing.length > 0) {
        h.allocation_id = (existing[0] as { id: string }).id;
        return {
          at,
          ok: true,
          action: action.type,
          detail: { skipped: true, allocation_id: h.allocation_id },
        };
      }
      const pct = num(ctx, action.allocation_pct);
      const { data: inserted, error } = await supabase
        .from("people_allocations")
        .insert({
          workspace_id: ctx.workspaceId,
          owner_id: ctx.ownerId,
          person_id: personId,
          project_id: projectId,
          purchase_contract_id: h.contract_id ?? null,
          role_title: txt(ctx, action.role_title) || null,
          allocation_pct: pct ?? 100,
          billable_rate: num(ctx, action.billable_rate),
          cost_rate: num(ctx, action.cost_rate),
          currency: "BRL",
          starts_at: isoDate(ctx, action.starts_at) ?? new Date().toISOString().slice(0, 10),
          status: "active",
        } as never)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      h.allocation_id = (inserted as { id: string }).id;
      return {
        at,
        ok: true,
        action: action.type,
        detail: { allocation_id: h.allocation_id, project_id: projectId },
      };
    }

    case "create_payable_schedule": {
      const amount = num(ctx, action.amount);
      if (!amount || amount <= 0) throw new Error("Informe o valor da parcela a pagar.");
      const personId = await resolvePersonId(supabase, ctx, action.person_id);
      const subject = personId ?? ctx.entityId;
      const ref = dedupeRef(ctx, "payable", subject);
      const { count, error: exErr } = await supabase
        .from("financial_entries")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", ctx.workspaceId)
        .like("external_ref", `${ref}:%`);
      if (exErr) throw new Error(exErr.message);
      if ((count ?? 0) > 0) {
        return { at, ok: true, action: action.type, detail: { skipped: true, entries: count } };
      }
      const installments = Math.min(Math.max(Math.trunc(action.installments ?? 12), 1), 24);
      const day = Math.min(Math.max(Math.trunc(action.day_of_month ?? 10), 1), 28);
      const start = new Date(
        isoDate(ctx, action.starts_at) ?? new Date().toISOString().slice(0, 10),
      );
      const description = txt(ctx, action.description) || "Honorários mensais";
      const contractId = h.contract_id ?? null;
      const base = {
        workspace_id: ctx.workspaceId,
        owner_id: ctx.ownerId,
        direction: "payable",
        origin_type: contractId ? "contract" : "manual",
        origin_id: contractId,
        contract_id: contractId,
        amount,
        currency: "BRL",
        status: "open",
        installment_total: installments,
        metadata: {
          person_id: personId,
          origin: "workflow_hiring",
          workflow_id: ctx.workflowId ?? null,
        },
      };
      const rows = Array.from({ length: installments }, (_, i) => {
        const due = nthDue(start, day, i);
        return {
          ...base,
          // Único por parcela (a constraint é única por workspace).
          external_ref: `${ref}:${i + 1}`,
          description: installments > 1 ? `${description} (${i + 1}/${installments})` : description,
          competence_date: due,
          due_date: due,
          installment_number: i + 1,
        };
      });
      const [first, ...rest] = rows;
      const { data: head, error } = await supabase
        .from("financial_entries")
        .insert(first as never)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      const parentId = (head as { id: string }).id;
      if (rest.length > 0) {
        const { error: rErr } = await supabase
          .from("financial_entries")
          .insert(rest.map((r) => ({ ...r, parent_entry_id: parentId })) as never);
        if (rErr) {
          // Desfaz a 1ª parcela para não deixar agenda incompleta (e liberar o reprocesso).
          await supabase.from("financial_entries").delete().eq("id", parentId);
          throw new Error(rErr.message);
        }
      }
      return {
        at,
        ok: true,
        action: action.type,
        detail: {
          parent_entry_id: parentId,
          entries: installments,
          amount,
          first_due: first.due_date,
        },
      };
    }

    case "create_receivable_invoice": {
      const amount = num(ctx, action.amount);
      if (!amount || amount <= 0) throw new Error("Informe o valor a receber.");
      const ref = dedupeRef(ctx, "receivable", ctx.entityId);
      const { data: existing, error: exErr } = await supabase
        .from("financial_entries")
        .select("id")
        .eq("workspace_id", ctx.workspaceId)
        .eq("external_ref", ref)
        .limit(1);
      if (exErr) throw new Error(exErr.message);
      if (existing && existing.length > 0) {
        return {
          at,
          ok: true,
          action: action.type,
          detail: { skipped: true, entry_id: (existing[0] as { id: string }).id },
        };
      }
      let companyId = uuidOrNull(txt(ctx, action.company_id));
      const { jobId } = sourceIds(ctx);
      if (!companyId && jobId) {
        const { data } = await supabase
          .from("ats_jobs")
          .select("company_id")
          .eq("id", jobId)
          .maybeSingle();
        companyId =
          ((data as { company_id?: string | null } | null)?.company_id as string | null) ?? null;
      }
      const dueInDays = Math.min(Math.max(Math.trunc(action.due_in_days ?? 15), 0), 365);
      const due = new Date(Date.now() + dueInDays * 86_400_000).toISOString().slice(0, 10);
      const { data: inserted, error } = await supabase
        .from("financial_entries")
        .insert({
          workspace_id: ctx.workspaceId,
          owner_id: ctx.ownerId,
          direction: "receivable",
          origin_type: "manual",
          counterparty_company_id: companyId,
          description: txt(ctx, action.description) || "Honorários de hunting",
          amount,
          currency: "BRL",
          competence_date: new Date().toISOString().slice(0, 10),
          due_date: due,
          status: "open",
          external_ref: ref,
          metadata: {
            origin: "workflow_hiring",
            source_entity: ctx.entity,
            source_id: ctx.entityId,
          },
        } as never)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return {
        at,
        ok: true,
        action: action.type,
        detail: {
          entry_id: (inserted as { id: string }).id,
          amount,
          due_date: due,
          company_id: companyId,
        },
      };
    }

    case "provision_workspace_user": {
      if (!action.permission_set_id)
        throw new Error("Selecione o conjunto de permissões do novo usuário.");
      let email = txt(ctx, action.email).toLowerCase();
      if (!email) {
        const personId = await resolvePersonId(supabase, ctx, undefined);
        if (personId) {
          const { data } = await supabase
            .from("people")
            .select("email")
            .eq("id", personId)
            .maybeSingle();
          email = String((data as { email?: string | null } | null)?.email ?? "").toLowerCase();
        }
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        throw new Error("Email do novo usuário ausente ou inválido.");

      // Só administradores do workspace podem conceder acesso por workflow.
      const { data: ownerMember } = await supabase
        .from("workspace_members")
        .select("role, status")
        .eq("workspace_id", ctx.workspaceId)
        .eq("user_id", ctx.ownerId)
        .maybeSingle();
      const om = ownerMember as { role?: string; status?: string } | null;
      if (!om || om.status === "inactive" || !["owner", "admin"].includes(om.role ?? "")) {
        throw new Error(
          "Somente administradores do workspace podem provisionar usuários por workflow.",
        );
      }

      const { data: pending } = await supabase
        .from("workspace_invites")
        .select("id")
        .eq("workspace_id", ctx.workspaceId)
        .eq("email", email)
        .is("accepted_at", null)
        .limit(1);
      if (pending && pending.length > 0) {
        return {
          at,
          ok: true,
          action: action.type,
          detail: { skipped: true, reason: "convite pendente", email },
        };
      }

      const { data: ws } = await supabase
        .from("workspaces")
        .select("created_by")
        .eq("id", ctx.workspaceId)
        .maybeSingle();
      const wsOwner = (ws as { created_by?: string } | null)?.created_by ?? null;
      const { data: set } = await supabase
        .from("permission_sets")
        .select("id, is_system, owner_id")
        .eq("id", action.permission_set_id)
        .maybeSingle();
      const sr = set as { is_system?: boolean; owner_id?: string | null } | null;
      if (!sr || !(sr.is_system || (wsOwner && sr.owner_id === wsOwner))) {
        throw new Error("Conjunto de permissões inválido para este workspace.");
      }

      const [{ data: limitRow }, { count: members }] = await Promise.all([
        supabase.rpc("get_entitlement_limit", {
          _workspace: ctx.workspaceId,
          _key: "users.max",
        } as never),
        supabase
          .from("workspace_members")
          .select("workspace_id", { count: "exact", head: true })
          .eq("workspace_id", ctx.workspaceId)
          .eq("is_test_user", false),
      ]);
      const limit = (limitRow as number | null) ?? null;
      if (limit !== null && (members ?? 0) + 1 > limit) {
        throw new Error(`Limite de usuários do plano atingido (${limit}).`);
      }

      const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
      const role = action.role ?? "member";
      const { data: inv, error } = await supabase
        .from("workspace_invites")
        .insert({
          workspace_id: ctx.workspaceId,
          email,
          role,
          token,
          invited_by: ctx.ownerId,
          permission_set_id: action.permission_set_id,
        } as never)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return {
        at,
        ok: true,
        action: action.type,
        detail: {
          invite_id: (inv as { id: string }).id,
          email,
          role,
          note: "Convite pendente em Configurações › Usuários; envie o link de acesso por lá.",
        },
      };
    }
  }
  return null;
}
