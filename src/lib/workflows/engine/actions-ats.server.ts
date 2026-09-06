// Ações de recrutamento (ATS): criar vaga, criar candidato e avançar etapa.
// Extraído de engine-actions.server.ts sem mudança de comportamento.
import type { SupabaseClient } from "@supabase/supabase-js";
import { type AnyRow, type LogStep, renderTokens } from "../engine-shared.server";
import type { RunCtx, RunnableAction } from "./run-context";

export async function handleAtsAction(
  supabase: SupabaseClient,
  action: RunnableAction,
  ctx: RunCtx,
  at: string,
): Promise<LogStep | null> {
  switch (action.type) {
    case "create_ats_job": {
      const after = ctx.after ?? {};
      const title =
        (renderTokens(action.title, ctx.after) as string) ||
        `Vaga para ${String((after as AnyRow).name ?? "")}`.trim();
      let pipelineId: string | null = null;
      const { data: pipe } = await supabase
        .from("ats_pipelines")
        .select("id")
        .eq("owner_id", ctx.ownerId)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (pipe) pipelineId = pipe.id as string;
      else {
        const { data: created, error: pErr } = await supabase
          .from("ats_pipelines")
          .insert({
            owner_id: ctx.ownerId,
            name: "Pipeline padrão",
            is_default: true,
            stages: [],
          } as never)
          .select("id")
          .single();
        if (pErr) throw new Error(pErr.message);
        pipelineId = created.id as string;
      }
      const headcount = action.headcount && action.headcount > 0 ? action.headcount : 1;
      const slugBase = title
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const createdIds: string[] = [];
      for (let i = 0; i < headcount; i++) {
        const slug = `${slugBase}-${Date.now().toString(36)}-${i}`;
        const { data: inserted, error } = await supabase
          .from("ats_jobs")
          .insert({
            owner_id: ctx.ownerId,
            pipeline_id: pipelineId,
            title,
            slug,
            status: "draft",
            deal_id: ctx.entity === "deals" ? ctx.entityId : null,
            company_id: (((after as AnyRow).company_id as string) ??
              (ctx.entity === "companies" ? ctx.entityId : null)) as string | null,
            hiring_manager_id: action.hiring_manager_id ?? null,
            recruiter_id: action.recruiter_id ?? null,
            metadata: action.department ? { department: action.department } : {},
          } as never)
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        createdIds.push(inserted.id as string);
      }
      if (action.notify_user_id) {
        await supabase.from("notifications").insert({
          owner_id: ctx.ownerId,
          user_id: action.notify_user_id,
          type: "workflow",
          title: `Nova vaga em rascunho: ${title}`,
          body: `Origem: ${ctx.entity}. Revise e publique para abrir a vaga.`,
          link: `/ats/jobs`,
          entity: "ats_jobs",
          entity_id: createdIds[0] ?? null,
        } as never);
      }
      return { at, ok: true, action: "create_ats_job", detail: { ids: createdIds, headcount } };
    }
    case "advance_ats_application_stage": {
      if (ctx.entity !== "ats_applications") {
        throw new Error("advance_ats_application_stage exige workflow sobre Aplicações (ATS)");
      }
      const stageValue = renderTokens(action.stage_value, ctx.after) as string;
      if (!stageValue) throw new Error("stage_value obrigatório");
      const { error } = await supabase
        .from("ats_applications")
        .update({ stage_value: stageValue, moved_at: new Date().toISOString() })
        .eq("id", ctx.entityId);
      if (error) throw new Error(error.message);
      return {
        at,
        ok: true,
        action: "advance_ats_application_stage",
        detail: { stage_value: stageValue },
      };
    }
    case "create_ats_candidate": {
      const fullName = (renderTokens(action.full_name, ctx.after) as string).trim();
      if (!fullName) throw new Error("full_name obrigatório");
      const email = action.email ? (renderTokens(action.email, ctx.after) as string) || null : null;
      const phone = action.phone ? (renderTokens(action.phone, ctx.after) as string) || null : null;
      const { data: inserted, error } = await supabase
        .from("ats_candidates")
        .insert({
          owner_id: ctx.ownerId,
          full_name: fullName,
          email,
          phone,
          source: action.source ?? "workflow",
        } as never)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return {
        at,
        ok: true,
        action: "create_ats_candidate",
        detail: { id: inserted.id, full_name: fullName },
      };
    }
    default:
      return null;
  }
}
