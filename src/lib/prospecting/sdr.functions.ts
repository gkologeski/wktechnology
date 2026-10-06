import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAnyPermission } from "@/lib/access-control/enforce.server";
import { assertSdr } from "@/lib/prospecting/sdr/access.server";
import { loadSdrReadiness } from "@/lib/prospecting/sdr/readiness.server";
import { qualificationFeasibility } from "@/lib/prospecting/sdr/readiness";

// Leituras passam pelo cliente do usuário (RLS por workspace). Ações que
// tocam provedores leem o registro primeiro com RLS e só então usam o admin.

export const getSdrOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: wsRaw } = await supabase.rpc("default_workspace_for_user", { _user: userId });
    if (!wsRaw) throw new Error("Workspace não identificado.");
    const wsId: string = wsRaw;
    await assertAnyPermission(supabase, userId, wsId, [
      "techsales.marketing.sdr_agent.view.workspace",
      "techsales.marketing.sdr_agent.view.team",
      "techsales.marketing.sdr_agent.view.own",
      "techsales.marketing.sdr_agent.manage.workspace",
    ]);
    const since = new Date(Date.now() - 30 * 86400_000).toISOString();
    const [settings, offers, materials, links, jobs, enrollments, actions, isAdmin] =
      await Promise.all([
        supabase.from("sdr_workspace_settings").select("*").eq("workspace_id", wsId).maybeSingle(),
        supabase.from("sdr_offers").select("*").eq("workspace_id", wsId).order("position"),
        supabase.from("sdr_materials").select("*").eq("workspace_id", wsId).order("title"),
        supabase
          .from("sdr_material_offers")
          .select("material_id, offer_id")
          .eq("workspace_id", wsId),
        supabase
          .from("sdr_turn_jobs")
          .select(
            "id, status, kind, draft_text, draft_payload, error, created_at, enrollment_id, conversation_id",
          )
          .eq("workspace_id", wsId)
          .in("status", ["drafted", "failed", "queued", "running"])
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("sdr_enrollments")
          .select(
            "id, status, commercial_stage, meeting_status, qualification_score, qualification_id, contact_phone, offers, deal_id, booking_id, conversation_id, created_at",
          )
          .eq("workspace_id", wsId)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("sdr_actions")
          .select("kind, status")
          .eq("workspace_id", wsId)
          .gte("created_at", since)
          .limit(5000),
        supabase.rpc("is_workspace_admin", { _workspace: wsId, _user: userId }),
      ]);
    const err = [settings, offers, materials, links, jobs, enrollments, actions].find(
      (r) => r.error,
    )?.error;
    if (err) throw new Error(err.message);
    // Qualificação canônica (mesma linha exibida na Prospecção).
    const qIds = (enrollments.data ?? [])
      .map((e) => e.qualification_id)
      .filter((x): x is string => !!x);
    const { data: quals } = qIds.length
      ? await supabase
          .from("prospecting_qualifications")
          .select(
            "id, total_score, decision, answers, questionnaire:prospecting_questionnaires(name)",
          )
          .in("id", qIds)
      : { data: [] };
    const qualifications = Object.fromEntries(
      (quals ?? []).map((q) => [
        q.id,
        {
          total: Number(q.total_score ?? 0),
          decision: q.decision,
          answered: Object.keys((q.answers as Record<string, unknown>) ?? {}).length,
          questionnaire: (q.questionnaire as { name?: string } | null)?.name ?? null,
        },
      ]),
    );
    const readiness = await loadSdrReadiness(supabase, wsId);
    const metrics: Record<string, number> = {};
    for (const a of actions.data ?? [])
      metrics[`${a.kind}:${a.status}`] = (metrics[`${a.kind}:${a.status}`] ?? 0) + 1;
    return {
      workspaceId: wsId as string,
      canManage: !!isAdmin.data,
      settings: settings.data,
      offers: offers.data ?? [],
      materials: materials.data ?? [],
      links: links.data ?? [],
      jobs: jobs.data ?? [],
      enrollments: enrollments.data ?? [],
      qualifications,
      readiness,
      metrics,
    };
  });

async function assertAdmin(supabase: any, userId: string, workspaceId: string) {
  const { data } = await supabase.rpc("is_workspace_admin", {
    _workspace: workspaceId,
    _user: userId,
  });
  if (!data) throw new Error("Somente administradores do workspace podem alterar o SDR.");
}

export const saveSdrSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        enabled: z.boolean(),
        auto_send_enabled: z.boolean(),
        daily_send_limit: z.number().int().min(1).max(1000),
        quiet_hours_start: z.number().int().min(0).max(23),
        quiet_hours_end: z.number().int().min(0).max(23),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId, data.workspaceId);
    const { workspaceId, ...rest } = data;
    const { error } = await context.supabase.from("sdr_workspace_settings").upsert({
      workspace_id: workspaceId,
      ...rest,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setSdrOfferActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({ workspaceId: z.string().uuid(), id: z.string().uuid(), active: z.boolean() })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId, data.workspaceId);
    const { error } = await context.supabase
      .from("sdr_offers")
      .update({ status: data.active ? "active" : "inactive" })
      .eq("id", data.id)
      .eq("workspace_id", data.workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveSdrMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        id: z.string().uuid().optional(),
        title: z.string().trim().min(1).max(200),
        url: z
          .string()
          .url()
          .refine((u) => u.startsWith("https://"), "Use um link https"),
        approved: z.boolean(),
        active: z.boolean(),
        offerIds: z.array(z.string().uuid()).max(50),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId, data.workspaceId);
    const row = {
      ...(data.id ? { id: data.id } : {}),
      workspace_id: data.workspaceId,
      title: data.title,
      url: data.url,
      approved: data.approved,
      approved_by: data.approved ? userId : null,
      approved_at: data.approved ? new Date().toISOString() : null,
      active: data.active,
    };
    const { data: saved, error } = await supabase
      .from("sdr_materials")
      .upsert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const { error: dErr } = await supabase
      .from("sdr_material_offers")
      .delete()
      .eq("material_id", saved.id);
    if (dErr) throw new Error(dErr.message);
    if (data.offerIds.length) {
      const { error: lErr } = await supabase.from("sdr_material_offers").insert(
        data.offerIds.map((offer_id) => ({
          workspace_id: data.workspaceId,
          material_id: saved.id,
          offer_id,
        })),
      );
      if (lErr) throw new Error(lErr.message);
    }
    return { id: saved.id as string };
  });

const JobInput = z.object({ jobId: z.string().uuid() });

/** Lê o trabalho com RLS (prova de acesso ao workspace) antes de qualquer ação privilegiada. */
async function loadJobScoped(supabase: any, userId: string, jobId: string) {
  const { data, error } = await supabase
    .from("sdr_turn_jobs")
    .select("id, workspace_id, enrollment_id, conversation_id, status")
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Rascunho não encontrado.");
  return data as {
    id: string;
    workspace_id: string;
    enrollment_id: string;
    conversation_id: string;
    status: string;
  };
}

export const approveSdrDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => JobInput.extend({ text: z.string().trim().min(1).max(4000) }).parse(i))
  .handler(async ({ data, context }) => {
    const job = await loadJobScoped(context.supabase, context.userId, data.jobId);
    await assertSdr(context.supabase, context.userId, job.workspace_id, "supervise");
    if (job.status !== "drafted") throw new Error("Este rascunho não está mais pendente.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendSdrMessage } = await import("./sdr/actions.server");
    const r = await sendSdrMessage(supabaseAdmin, {
      jobId: job.id,
      expectedStatus: "drafted",
      text: data.text,
      actorUserId: context.userId,
    });
    if (!r.ok) {
      const msg: Record<string, string> = {
        owner_not_ai: "Um humano já assumiu esta conversa.",
        stale_version: "A conversa mudou desde o rascunho. Gere um novo.",
        enrollment_inactive: "A prospecção foi encerrada.",
        window_closed: "A janela de 24 horas fechou; use um template aprovado.",
        daily_limit: "Limite diário de envios do SDR atingido.",
        provider_failed: "O WhatsApp recusou o envio. Nada foi confirmado.",
        job_state_changed: "Este rascunho já foi tratado.",
      };
      throw new Error(msg[r.reason] ?? "Envio não realizado.");
    }
    return { ok: true };
  });

export const discardSdrDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => JobInput.parse(i))
  .handler(async ({ data, context }) => {
    const job = await loadJobScoped(context.supabase, context.userId, data.jobId);
    await assertSdr(context.supabase, context.userId, job.workspace_id, "supervise");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("sdr_turn_jobs")
      .update({
        status: "discarded",
        decided_by: context.userId,
        decided_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .in("status", ["drafted", "failed", "queued"]);
    return { ok: true };
  });

export const takeoverSdrConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    JobInput.extend({ reason: z.string().max(300).default("Assumido manualmente") }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const job = await loadJobScoped(context.supabase, context.userId, data.jobId);
    await assertSdr(context.supabase, context.userId, job.workspace_id, "supervise");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { handoffToHuman } = await import("./sdr/actions.server");
    await handoffToHuman(supabaseAdmin, {
      workspaceId: job.workspace_id,
      enrollmentId: job.enrollment_id,
      conversationId: job.conversation_id,
      reason: data.reason,
      actorUserId: context.userId,
    });
    return { ok: true };
  });

export const retrySdrMeetingSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ enrollmentId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: enr, error } = await context.supabase
      .from("sdr_enrollments")
      .select("id, workspace_id, booking_id")
      .eq("id", data.enrollmentId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!enr?.booking_id) throw new Error("Nenhuma reserva vinculada.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { retryBookingSync } = await import("./sdr/actions.server");
    if (!enr.workspace_id) throw new Error("Workspace não identificado.");
    await assertAnyPermission(context.supabase, context.userId, enr.workspace_id, [
      "techsales.marketing.sdr_agent.update.workspace",
      "techsales.marketing.sdr_agent.manage.workspace",
    ]);
    const r = await retryBookingSync(supabaseAdmin, enr.workspace_id, enr.booking_id);
    await supabaseAdmin
      .from("sdr_enrollments")
      .update({ meeting_status: r.status })
      .eq("id", enr.id);
    return r;
  });

/**
 * Prepara o playbook do piloto (limiar e página de agenda) sem ativá-lo.
 * Bloqueia limiar impossível com os critérios atuais e agenda de outro workspace.
 */
export const saveSdrPilotPlaybook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        playbookId: z.string().uuid(),
        opportunity_min_score: z.number().int().min(1).max(85),
        booking_page_id: z.string().uuid().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId, data.workspaceId);
    const { data: pb, error } = await supabase
      .from("sdr_playbooks")
      .select("id, questionnaire_id")
      .eq("id", data.playbookId)
      .eq("workspace_id", data.workspaceId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!pb) throw new Error("Playbook não encontrado neste workspace.");
    if (data.booking_page_id) {
      const { data: page } = await supabase
        .from("booking_pages")
        .select("id")
        .eq("id", data.booking_page_id)
        .eq("workspace_id", data.workspaceId)
        .maybeSingle();
      if (!page) throw new Error("Página de agenda não pertence a este workspace.");
    }
    const [{ data: questions }, { data: icp }] = await Promise.all([
      pb.questionnaire_id
        ? supabase
            .from("prospecting_questions")
            .select("id, type, weight, options, text_points, text_min_chars")
            .eq("questionnaire_id", pb.questionnaire_id)
            .eq("workspace_id", data.workspaceId)
        : Promise.resolve({ data: [] }),
      supabase
        .from("icp_criteria")
        .select("points")
        .eq("workspace_id", data.workspaceId)
        .eq("enabled", true),
    ]);
    const f = qualificationFeasibility({
      questions: (questions ?? []) as never,
      icpEnabledCriteria: (icp ?? []) as never,
      threshold: data.opportunity_min_score,
    });
    if (!f.feasibleForLead)
      throw new Error(f.issues[0] ?? "Limiar inalcançável com os critérios atuais.");
    const { error: uErr } = await supabase
      .from("sdr_playbooks")
      .update({
        opportunity_min_score: data.opportunity_min_score,
        booking_page_id: data.booking_page_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", pb.id)
      .eq("workspace_id", data.workspaceId);
    if (uErr) throw new Error(uErr.message);
    return { ok: true, feasibility: f };
  });
