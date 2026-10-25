import { workflowRecord } from "./record-write.server";
import { normalizeEmailAddress } from "@/lib/email-address";
import { withWorkflowWorkspace } from "./workspace-payload";
// Ações de criação de registros do CRM: lead, contato, empresa, negócio e chamado.
// Extraído de engine-actions.server.ts sem mudança de comportamento.
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkLeadDuplicate } from "@/lib/leads/lead-duplicate-check";
import {
  type LogStep,
  mergeExtra,
  renderTokens,
  resolveExtraFields,
} from "../engine-shared.server";
import type { RunCtx, RunnableAction } from "./run-context";

import { workflowPhone, workspacePhoneCountry } from "@/lib/phone/phone-boundary";
export async function handleCrmAction(
  supabase: SupabaseClient,
  action: RunnableAction,
  ctx: RunCtx,
  at: string,
): Promise<LogStep | null> {
  switch (action.type) {
    case "create_lead": {
      const first = (renderTokens(action.first_name, ctx.after) as string).trim();
      if (!first) throw new Error("first_name obrigatório");
      const owner = action.owner_id?.trim() || ctx.ownerId;
      const base: Record<string, unknown> = {
        owner_id: ctx.ownerId,
        assigned_to: owner,
        status: "new",
        job_title: action.job_title
          ? (renderTokens(action.job_title, ctx.after) as string) || null
          : null,
        first_name: first,
        last_name: action.last_name
          ? (renderTokens(action.last_name, ctx.after) as string) || null
          : null,
        email: normalizeEmailAddress(action.email ? renderTokens(action.email, ctx.after) : null),
        phone: workflowPhone(
          action.phone,
          action.phone ? (renderTokens(action.phone, ctx.after) as string) : null,
          await workspacePhoneCountry(supabase, ctx.workspaceId),
        ),
        company_name: action.company_name
          ? (renderTokens(action.company_name, ctx.after) as string) || null
          : null,
        source: action.source
          ? (renderTokens(action.source, ctx.after) as string) || null
          : "workflow",
      };
      const dup = await checkLeadDuplicate(supabase, {
        workspaceId: ctx.workspaceId,
        email: (base.email as string | null) ?? null,
        phone: (base.phone as string | null) ?? null,
      });
      if (dup.duplicate) {
        return {
          at,
          ok: false,
          action: "create_lead",
          error: dup.message ?? "Lead duplicado",
          detail: { existing_id: dup.existingId },
        };
      }
      const row = mergeExtra(base, resolveExtraFields(action.extra_fields, ctx.after, ctx.vars));
      const data = await workflowRecord(
        supabase,
        ctx,
        "leads",
        "create",
        null,
        withWorkflowWorkspace(ctx, row),
      );
      return {
        at,
        ok: true,
        action: "create_lead",
        detail: {
          id: data.id,
          first_name: first,
          related_records:
            "Use ações explícitas para criar e vincular empresa/contato com as respectivas permissões.",
        },
      };
    }
    case "create_contact": {
      const first = (renderTokens(action.first_name, ctx.after) as string).trim();
      if (!first) throw new Error("first_name obrigatório");
      const owner = action.owner_id?.trim() || ctx.ownerId;
      const base: Record<string, unknown> = {
        owner_id: ctx.ownerId,
        assigned_to: owner,
        first_name: first,
        last_name: action.last_name
          ? (renderTokens(action.last_name, ctx.after) as string) || null
          : null,
        email: normalizeEmailAddress(action.email ? renderTokens(action.email, ctx.after) : null),
        phone: workflowPhone(
          action.phone,
          action.phone ? (renderTokens(action.phone, ctx.after) as string) : null,
          await workspacePhoneCountry(supabase, ctx.workspaceId),
        ),
        job_title: action.job_title
          ? (renderTokens(action.job_title, ctx.after) as string) || null
          : null,
        company_name: action.company_name
          ? (renderTokens(action.company_name, ctx.after) as string) || null
          : null,
      };
      const row = mergeExtra(base, resolveExtraFields(action.extra_fields, ctx.after, ctx.vars));
      const data = await workflowRecord(
        supabase,
        ctx,
        "contacts",
        "create",
        null,
        withWorkflowWorkspace(ctx, row),
      );
      return {
        at,
        ok: true,
        action: "create_contact",
        detail: {
          id: data.id,
          first_name: first,
          related_records:
            "Use ações explícitas para criar e vincular empresa/contato com as respectivas permissões.",
        },
      };
    }
    case "create_company": {
      const name = (renderTokens(action.name, ctx.after) as string).trim();
      if (!name) throw new Error("name obrigatório");
      const owner = action.owner_id?.trim() || ctx.ownerId;
      const base: Record<string, unknown> = {
        owner_id: ctx.ownerId,
        assigned_to: owner,
        name,
        domain: action.domain ? (renderTokens(action.domain, ctx.after) as string) || null : null,
        industry: action.industry
          ? (renderTokens(action.industry, ctx.after) as string) || null
          : null,
      };
      const row = mergeExtra(base, resolveExtraFields(action.extra_fields, ctx.after, ctx.vars));
      const data = await workflowRecord(
        supabase,
        ctx,
        "companies",
        "create",
        null,
        withWorkflowWorkspace(ctx, row),
      );
      return { at, ok: true, action: "create_company", detail: { id: data.id, name } };
    }
    case "create_deal": {
      const name = (renderTokens(action.name, ctx.after) as string).trim();
      if (!name) throw new Error("name obrigatório");
      const owner = action.owner_id?.trim() || ctx.ownerId;
      let pipelineId = action.pipeline_id ?? null;
      const stageId = action.stage_id ?? null;
      if (!pipelineId) {
        const { data: pipe } = await supabase
          .from("pipelines")
          .select("id")
          .eq("owner_id", owner)
          .eq("entity", "deals")
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (pipe) pipelineId = pipe.id as string;
      }
      const base: Record<string, unknown> = {
        owner_id: ctx.ownerId,
        assigned_to: owner,
        name,
        value: typeof action.value === "number" ? action.value : null,
        currency: action.currency ?? "BRL",
        pipeline_id: pipelineId,
        stage_id: stageId,
      };
      // Associação automática quando disparado por lead/contact/company
      if (ctx.entity === "contacts") base.contact_id = ctx.entityId;
      else if (ctx.entity === "companies") base.company_id = ctx.entityId;
      const row = mergeExtra(base, resolveExtraFields(action.extra_fields, ctx.after, ctx.vars));
      const data = await workflowRecord(
        supabase,
        ctx,
        "deals",
        "create",
        null,
        withWorkflowWorkspace(ctx, row),
      );
      return { at, ok: true, action: "create_deal", detail: { id: data.id, name } };
    }
    case "create_ticket": {
      const subject = (renderTokens(action.subject, ctx.after) as string).trim();
      if (!subject) throw new Error("subject obrigatório");
      let pipelineId = action.pipeline_id ?? null;
      if (!pipelineId) {
        const { data: pipe } = await supabase
          .from("pipelines")
          .select("id")
          .eq("owner_id", ctx.ownerId)
          .eq("entity", "tickets")
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (pipe) pipelineId = pipe.id as string;
      }
      const base: Record<string, unknown> = {
        owner_id: ctx.ownerId,
        subject,
        description: action.description
          ? (renderTokens(action.description, ctx.after) as string) || null
          : null,
        priority: action.priority ?? "medium",
        pipeline_id: pipelineId,
        assignee_id: action.assignee_id ?? null,
      };
      if (ctx.entity === "contacts") base.contact_id = ctx.entityId;
      else if (ctx.entity === "companies") base.company_id = ctx.entityId;
      else if (ctx.entity === "deals") base.deal_id = ctx.entityId;
      const row = mergeExtra(base, resolveExtraFields(action.extra_fields, ctx.after, ctx.vars));
      const data = await workflowRecord(
        supabase,
        ctx,
        "tickets",
        "create",
        null,
        withWorkflowWorkspace(ctx, row),
      );
      return { at, ok: true, action: "create_ticket", detail: { id: data.id, subject } };
    }
    default:
      return null;
  }
}
