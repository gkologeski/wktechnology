// Ações de atividades: criar atividade, pesquisa, tarefa e intenção de negócio.
// Extraído de engine-actions.server.ts sem mudança de comportamento.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type LogStep,
  mergeExtra,
  renderTokens,
  resolveExtraFields,
} from "../engine-shared.server";
import type { RunCtx, RunnableAction } from "./run-context";

export async function handleActivityAction(
  supabase: SupabaseClient,
  action: RunnableAction,
  ctx: RunCtx,
  at: string,
): Promise<LogStep | null> {
  switch (action.type) {
    case "create_activity": {
      const subject = renderTokens(action.subject, ctx.after) as string;
      const body = action.body ? (renderTokens(action.body, ctx.after) as string) : null;
      const due = action.due_in_days
        ? new Date(Date.now() + action.due_in_days * 86_400_000).toISOString()
        : null;
      const baseRow: Record<string, unknown> = {
        owner_id: ctx.ownerId,
        type: action.activity_type ?? "task",
        subject,
        body,
        due_date: due,
      };
      if (ctx.entity === "leads") baseRow.related_lead_id = ctx.entityId;
      else if (ctx.entity === "contacts") baseRow.related_contact_id = ctx.entityId;
      else if (ctx.entity === "companies") baseRow.related_company_id = ctx.entityId;
      else if (ctx.entity === "deals") baseRow.related_deal_id = ctx.entityId;
      const { error } = await supabase.from("activities").insert(baseRow as never);
      if (error) throw new Error(error.message);
      return { at, ok: true, action: "create_activity", detail: { subject } };
    }
    case "create_survey_activity": {
      // Cria uma atividade de pesquisa PENDENTE (respondida depois em Pesquisas).
      const isQuest = action.source === "prospecting_questionnaire";
      const { data: src } = isQuest
        ? await supabase
            .from("prospecting_questionnaires")
            .select("name")
            .eq("id", action.source_id)
            .maybeSingle()
        : await supabase
            .from("survey_templates")
            .select("name")
            .eq("id", action.source_id)
            .maybeSingle();
      const sourceName = (src as { name?: string } | null)?.name ?? "Pesquisa";
      const subject = action.subject
        ? (renderTokens(action.subject, ctx.after, ctx.vars) as string)
        : `Pesquisa — ${sourceName}`;
      const body = action.body ? (renderTokens(action.body, ctx.after, ctx.vars) as string) : null;
      const due = action.due_in_days
        ? new Date(Date.now() + action.due_in_days * 86_400_000).toISOString()
        : null;
      const row: Record<string, unknown> = {
        owner_id: ctx.ownerId,
        type: "survey",
        subject,
        body,
        due_date: due,
        completed: false,
        custom_fields: {
          survey_source: action.source,
          survey_source_id: action.source_id,
          survey_source_name: sourceName,
          survey_status: "pending",
        },
      };
      if (ctx.entity === "leads") row.related_lead_id = ctx.entityId;
      else if (ctx.entity === "contacts") row.related_contact_id = ctx.entityId;
      else if (ctx.entity === "companies") row.related_company_id = ctx.entityId;
      else if (ctx.entity === "deals") row.related_deal_id = ctx.entityId;
      else if (ctx.entity === "tickets") row.related_ticket_id = ctx.entityId;
      else throw new Error("create_survey_activity não suporta esta entidade");
      const { data: created, error } = await supabase
        .from("activities")
        .insert(row as never)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return {
        at,
        ok: true,
        action: "create_survey_activity",
        detail: { activity_id: (created as { id: string }).id, subject },
      };
    }
    case "open_deal_dialog": {
      // Registra uma intenção pendente. A criação do negócio é confirmada
      // pelo usuário no modal aberto na tela do registro.
      if (ctx.entity !== "leads") throw new Error("open_deal_dialog suporta apenas leads");
      const subject = action.subject
        ? (renderTokens(action.subject, ctx.after, ctx.vars) as string)
        : "Criar oportunidade";
      const { data: created, error } = await supabase
        .from("activities")
        .insert({
          owner_id: ctx.ownerId,
          type: "task",
          subject,
          completed: false,
          related_lead_id: ctx.entityId,
          custom_fields: {
            ui_action: "create_deal",
            pipeline_id: action.pipeline_id ?? null,
            stage_value: action.stage_value ?? null,
            due_rule: action.due_rule ?? "last_business_day_of_month",
          },
        } as never)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return {
        at,
        ok: true,
        action: "open_deal_dialog",
        detail: {
          activity_id: (created as { id: string }).id,
          pipeline_id: action.pipeline_id ?? null,
        },
      };
    }
    case "create_task": {
      const subject = (renderTokens(action.subject, ctx.after) as string).trim();
      if (!subject) throw new Error("subject obrigatório");
      const body = action.body ? (renderTokens(action.body, ctx.after) as string) : null;
      const due = action.due_in_days
        ? new Date(Date.now() + action.due_in_days * 86_400_000).toISOString()
        : null;
      const base: Record<string, unknown> = {
        owner_id: action.assignee_id?.trim() || ctx.ownerId,
        type: "task",
        subject,
        body,
        due_date: due,
      };
      if (ctx.entity === "leads") base.related_lead_id = ctx.entityId;
      else if (ctx.entity === "contacts") base.related_contact_id = ctx.entityId;
      else if (ctx.entity === "companies") base.related_company_id = ctx.entityId;
      else if (ctx.entity === "deals") base.related_deal_id = ctx.entityId;
      const row = mergeExtra(base, resolveExtraFields(action.extra_fields, ctx.after, ctx.vars));
      const { error } = await supabase.from("activities").insert(row as never);
      if (error) throw new Error(error.message);
      return { at, ok: true, action: "create_task", detail: { subject } };
    }
    default:
      return null;
  }
}
