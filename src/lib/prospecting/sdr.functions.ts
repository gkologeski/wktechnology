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
            "id, status, kind, draft_text, draft_payload, error, block_category, attempts, created_at, updated_at, ai_started_at, ai_finished_at, send_started_at, sent_at, enrollment_id, conversation_id",
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
    // Contadores separados (janela móvel de 24 h), só envios comprovados.
    const since24 = new Date(Date.now() - 86400_000).toISOString();
    const { data: sent24 } = await supabase
      .from("sdr_turn_jobs")
      .select("kind, provider_message_id, sent_at")
      .eq("workspace_id", wsId)
      .eq("status", "sent")
      .gte("sent_at", since24)
      .order("sent_at", { ascending: true })
      .limit(5000);
    const fuSent = (sent24 ?? []).filter((r) => r.kind === "follow_up");
    const fuLimit = Number(settings.data?.followup_daily_limit ?? 50);
    const { count: tplSent } = await supabase
      .from("whatsapp_campaign_recipients")
      .select("id, whatsapp_campaigns!inner(workspace_id)", { count: "exact", head: true })
      .eq("whatsapp_campaigns.workspace_id", wsId)
      .eq("status", "sent")
      .not("wa_message_id", "is", null)
      .gte("sent_at", since24);
    const { count: alerts24 } = await supabase
      .from("sdr_actions")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", wsId)
      .in("kind", ["technical_alert", "circuit_opened"])
      .gte("created_at", since24);
    const counters = {
      followUps: {
        limit: fuLimit,
        used: new Set(fuSent.map((r) => r.provider_message_id)).size,
        nextFreeAt: fuSent[0]?.sent_at
          ? new Date(new Date(fuSent[0].sent_at).getTime() + 86400_000).toISOString()
          : null,
      },
      templates: {
        limit: (settings.data?.template_daily_limit as number | null) ?? null,
        used: tplSent ?? 0,
      },
      replies24h: (sent24 ?? []).filter((r) => r.kind === "reply").length,
      technical: {
        breakerOpenAt: (settings.data?.tech_breaker_open_at as string | null) ?? null,
        breakerReason: (settings.data?.tech_breaker_reason as string | null) ?? null,
        alerts24h: alerts24 ?? 0,
      },
    };
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
      counters,
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
        followup_daily_limit: z.number().int().min(0).max(1000),
        template_daily_limit: z.number().int().min(0).max(100000).nullable(),
        template_respect_hours: z.boolean(),
        tech_conv_turns_per_hour: z.number().int().min(5).max(500),
        tech_failure_threshold: z.number().int().min(2).max(100),
        quiet_hours_start: z.number().int().min(0).max(23),
        quiet_hours_end: z.number().int().min(0).max(23),
        template_interval_min_s: z.number().int().min(0).max(3600).default(0),
        template_interval_max_s: z.number().int().min(0).max(3600).default(0),
      })
      .refine((v) => v.template_interval_min_s <= v.template_interval_max_s, {
        message: "O intervalo mínimo não pode ser maior que o máximo.",
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

export const setSdrOfferApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        ids: z.array(z.string().uuid()).min(1).max(100),
        approved: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId, data.workspaceId);
    const { error } = await context.supabase
      .from("sdr_offers")
      .update(
        data.approved
          ? { approved_at: new Date().toISOString(), approved_by: context.userId }
          : { approved_at: null, approved_by: null },
      )
      .in("id", data.ids)
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
        followup_quota: "Cota de retomadas (follow-ups) das últimas 24 h atingida.",
        followup_hours: "Fora do horário de prospecção para retomadas.",
        followup_max_reached: "Número máximo de retomadas deste contato atingido.",
        invalid_origin: "Origem do trabalho inválida: respostas só valem para mensagens recebidas.",
        not_allowlisted: "Número fora da lista do piloto.",
        uncertain_after_send: "Envio anterior incerto: reconcilie antes de reenviar.",
        provider_failed: "O WhatsApp recusou o envio. Nada foi confirmado.",
        job_state_changed: "Este rascunho já foi tratado.",
      };
      throw new Error(msg[r.reason] ?? "Envio não realizado.");
    }
    return { ok: true };
  });

/**
 * Retomada controlada pelo operador:
 *  - reconcile: falha incerta após chamar a Meta. Se a mensagem aparece no
 *    histórico, fecha como enviada; senão vira rascunho para aprovação humana.
 *  - requeue: falha técnica (disjuntor, tentativas, IA) do turno mais recente
 *    volta à fila com tentativas zeradas e gera resposta para a versão atual.
 */
export const resumeSdrJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => JobInput.extend({ mode: z.enum(["reconcile", "requeue"]) }).parse(i))
  .handler(async ({ data, context }) => {
    const job = await loadJobScoped(context.supabase, context.userId, data.jobId);
    await assertSdr(context.supabase, context.userId, job.workspace_id, "supervise");
    if (job.status !== "failed") throw new Error("Só trabalhos com falha podem ser retomados.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: full } = await supabaseAdmin
      .from("sdr_turn_jobs")
      .select("id, error, block_category, provider_message_id, conversation_id, created_at")
      .eq("id", job.id)
      .eq("workspace_id", job.workspace_id)
      .maybeSingle();
    if (!full) throw new Error("Trabalho não encontrado.");
    const now = new Date().toISOString();
    if (data.mode === "reconcile") {
      if (full.block_category !== "reconcile")
        throw new Error("Este trabalho não precisa de reconciliação.");
      const { data: msg } = await supabaseAdmin
        .from("whatsapp_messages")
        .select("wa_message_id")
        .eq("conversation_id", full.conversation_id)
        .eq("direction", "outbound")
        .contains("raw", { job_id: full.id })
        .limit(1)
        .maybeSingle();
      const proof = msg?.wa_message_id ?? full.provider_message_id;
      await supabaseAdmin
        .from("sdr_turn_jobs")
        .update(
          proof
            ? { status: "sent", provider_message_id: proof, block_category: null, updated_at: now }
            : {
                status: "drafted",
                send_started_at: null,
                block_category: null,
                error: "reconciled_not_sent",
                decided_by: context.userId,
                updated_at: now,
              },
        )
        .eq("id", full.id)
        .eq("status", "failed");
      return { ok: true, result: proof ? "already_sent" : "back_to_draft" };
    }
    if (full.block_category === "reconcile")
      throw new Error("Envio incerto: use a reconciliação, nunca a repetição automática.");
    const { data: newer } = await supabaseAdmin
      .from("sdr_turn_jobs")
      .select("id")
      .eq("conversation_id", full.conversation_id)
      .neq("id", full.id)
      .gte("created_at", full.created_at)
      .limit(1)
      .maybeSingle();
    if (newer) throw new Error("Há um turno mais recente nesta conversa; este ficou obsoleto.");
    await supabaseAdmin
      .from("sdr_turn_jobs")
      .update({
        status: "queued",
        attempts: 0,
        lease_until: null,
        lease_token: null,
        error: null,
        block_category: null,
        updated_at: now,
      })
      .eq("id", full.id)
      .eq("status", "failed");
    return { ok: true, result: "requeued" };
  });

/** Fecha o disjuntor técnico do workspace (somente administradores). */
export const resetSdrBreaker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ workspaceId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId, data.workspaceId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("sdr_workspace_settings")
      .update({ tech_breaker_open_at: null, tech_breaker_reason: null })
      .eq("workspace_id", data.workspaceId);
    await supabaseAdmin.from("sdr_actions").insert({
      workspace_id: data.workspaceId,
      kind: "circuit_closed",
      status: "success",
      created_by: context.userId,
      payload: {},
    });
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
