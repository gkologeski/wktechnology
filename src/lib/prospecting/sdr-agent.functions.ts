import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Versões do agente (rascunho × publicado), publicação/rollback atômicos e
// sandbox de teste. O sandbox usa o MESMO prompt do runtime e não grava nada.

const Ids = z.object({ workspaceId: z.string().uuid(), playbookId: z.string().uuid() });

export const getSdrAgentVersions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => Ids.parse(i))
  .handler(async ({ data, context }) => {
    const { assertSdr } = await import("@/lib/prospecting/sdr/access.server");
    await assertSdr(context.supabase, context.userId, data.workspaceId, "view");
    const { data: rows, error } = await context.supabase
      .from("sdr_agent_versions")
      .select("id, version, status, persona, notes, created_at, updated_at, published_at")
      .eq("workspace_id", data.workspaceId)
      .eq("playbook_id", data.playbookId)
      .order("version", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const saveSdrAgentDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    Ids.extend({ persona: z.unknown(), notes: z.string().max(500).nullish() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { assertSdr } = await import("@/lib/prospecting/sdr/access.server");
    const { PersonaSchema } = await import("@/lib/prospecting/sdr/persona");
    await assertSdr(context.supabase, context.userId, data.workspaceId, "manage");
    const persona = PersonaSchema.parse(data.persona ?? {});
    const { data: pb } = await context.supabase
      .from("sdr_playbooks")
      .select("id")
      .eq("id", data.playbookId)
      .eq("workspace_id", data.workspaceId)
      .maybeSingle();
    if (!pb) throw new Error("Agente não encontrado neste workspace.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: draft } = await supabaseAdmin
      .from("sdr_agent_versions")
      .select("id")
      .eq("playbook_id", data.playbookId)
      .eq("status", "draft")
      .maybeSingle();
    if (draft) {
      const { error } = await supabaseAdmin
        .from("sdr_agent_versions")
        .update({ persona, notes: data.notes ?? null, updated_at: new Date().toISOString() })
        .eq("id", draft.id);
      if (error) throw new Error(error.message);
      return { id: draft.id };
    }
    const { data: last } = await supabaseAdmin
      .from("sdr_agent_versions")
      .select("version")
      .eq("playbook_id", data.playbookId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: ins, error } = await supabaseAdmin
      .from("sdr_agent_versions")
      .insert({
        workspace_id: data.workspaceId,
        playbook_id: data.playbookId,
        version: (last?.version ?? 0) + 1,
        status: "draft",
        persona,
        notes: data.notes ?? null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

/** Publica o rascunho ou restaura uma versão arquivada (rollback). */
export const publishSdrAgentVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => Ids.extend({ versionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { assertSdr } = await import("@/lib/prospecting/sdr/access.server");
    await assertSdr(context.supabase, context.userId, data.workspaceId, "manage");
    // Leitura com RLS confirma que a versão é deste workspace/agente.
    const { data: v } = await context.supabase
      .from("sdr_agent_versions")
      .select("id, status")
      .eq("id", data.versionId)
      .eq("workspace_id", data.workspaceId)
      .eq("playbook_id", data.playbookId)
      .maybeSingle();
    if (!v) throw new Error("Versão não encontrada.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("sdr_publish_agent_version", {
      p_version: v.id,
      p_user: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const TestMsg = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().trim().min(1).max(4000),
});

export const testSdrAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    Ids.extend({
      persona: z.unknown(),
      origin: z.enum(["prospecting", "inbound"]),
      messages: z.array(TestMsg).min(1).max(40),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { assertSdr } = await import("@/lib/prospecting/sdr/access.server");
    const { PersonaSchema, stripStockOpener, toneIssues } =
      await import("@/lib/prospecting/sdr/persona");
    const { buildSystemPrompt, callSdrAgent } = await import("@/lib/prospecting/sdr/agent.server");
    const { validateAgentOutput } = await import("@/lib/prospecting/sdr/policy");
    const { loadKnowledge, loadQuestions } = await import("@/lib/prospecting/sdr/worker.server");
    await assertSdr(context.supabase, context.userId, data.workspaceId, "update");
    const persona = PersonaSchema.parse(data.persona ?? {});
    const { data: pb } = await context.supabase
      .from("sdr_playbooks")
      .select("*")
      .eq("id", data.playbookId)
      .eq("workspace_id", data.workspaceId)
      .maybeSingle();
    if (!pb) throw new Error("Agente não encontrado neste workspace.");
    // Leituras com o cliente do usuário (RLS); nada é gravado.
    const { configFromRow, hasTool, scopeKnowledge } =
      await import("@/lib/prospecting/sdr/agent-config");
    const config = configFromRow(pb as Record<string, unknown>);
    const { offers, materials } = scopeKnowledge(
      config,
      await loadKnowledge(context.supabase, data.workspaceId),
    );
    const questions = hasTool(config, "qualify")
      ? await loadQuestions(context.supabase, data.workspaceId, pb.questionnaire_id)
      : [];
    const system = buildSystemPrompt({
      offers,
      materials,
      questions,
      config,
      bookingAvailable: !!pb.booking_page_id && hasTool(config, "schedule"),
      extraInstructions: pb.qualification_prompt,
      persona,
      origin: data.origin,
    });
    const history = data.messages.map((m, i) => ({
      id: `test-${i}`,
      direction: m.role === "user" ? ("inbound" as const) : ("outbound" as const),
      body: m.text,
      created_at: new Date().toISOString(),
    }));
    const t0 = Date.now();
    const ai = await callSdrAgent({
      workspaceId: data.workspaceId,
      system,
      history,
      feature: "sdr_agente_teste",
    });
    const ms = Date.now() - t0;
    if (!ai.ok) return { ok: false as const, error: ai.error, status: ai.status, ms };
    const out = validateAgentOutput(ai.output, { offers, materials });
    if ("error" in out) return { ok: false as const, error: out.error, status: 200, ms };
    const raw = out.reply;
    const reply = stripStockOpener(raw);
    const lastInbound = [...data.messages].reverse().find((m) => m.role === "user")?.text ?? null;
    return {
      ok: true as const,
      ms,
      reply,
      trace: {
        sandbox: true,
        side_effects: "nenhum (sem WhatsApp, CRM, agenda ou notificações)",
        intent: out.intent,
        offer_keys: out.offer_keys,
        material_ids: out.material_ids,
        handoff_reason: (out as { handoff_reason?: string }).handoff_reason ?? null,
        warnings: out.warnings ?? [],
        opener_removed: raw !== reply,
        tone_issues: toneIssues(reply, lastInbound, persona),
      },
    };
  });

// ---------- configuração completa POR AGENTE ----------
// Cada agente guarda a própria configuração em `sdr_playbooks`. O workspace
// controla só liga/desliga e limites técnicos: nunca sobrescreve estes campos.
export const getSdrAgentConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => Ids.parse(i))
  .handler(async ({ data, context }) => {
    const { assertSdr } = await import("@/lib/prospecting/sdr/access.server");
    const { configFromRow } = await import("@/lib/prospecting/sdr/agent-config");
    await assertSdr(context.supabase, context.userId, data.workspaceId, "view");
    const { data: pb, error } = await context.supabase
      .from("sdr_playbooks")
      .select("*")
      .eq("id", data.playbookId)
      .eq("workspace_id", data.workspaceId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!pb) throw new Error("Agente não encontrado neste workspace.");

    const [{ data: offers }, { data: materials }, { data: questionnaires }, { data: pages }] =
      await Promise.all([
        context.supabase
          .from("sdr_offers")
          .select("offer_key, name, status")
          .eq("workspace_id", data.workspaceId)
          .order("position"),
        context.supabase
          .from("sdr_materials")
          .select("id, title, approved, active")
          .eq("workspace_id", data.workspaceId),
        context.supabase
          .from("prospecting_questionnaires")
          .select("id, name")
          .eq("workspace_id", data.workspaceId),
        context.supabase
          .from("booking_pages")
          .select("id, title")
          .eq("workspace_id", data.workspaceId),
      ]);

    return {
      agent: {
        id: pb.id as string,
        name: pb.name as string,
        enabled: pb.enabled as boolean,
        mode: pb.mode as string,
        qualification_prompt: (pb.qualification_prompt as string | null) ?? "",
        handoff_score: pb.handoff_score as number,
        opportunity_min_score: pb.opportunity_min_score as number,
        max_messages: pb.max_messages as number,
        follow_up_hours: pb.follow_up_hours as number,
        max_follow_ups: pb.max_follow_ups as number,
        business_hours: pb.business_hours as {
          tz: string;
          start: string;
          end: string;
          weekdays: number[];
        },
      },
      config: configFromRow(pb as Record<string, unknown>),
      options: {
        offers: (offers ?? []) as { offer_key: string; name: string; status: string }[],
        materials: (materials ?? []) as {
          id: string;
          title: string;
          approved: boolean;
          active: boolean;
        }[],
        questionnaires: (questionnaires ?? []) as { id: string; name: string }[],
        bookingPages: ((pages ?? []) as { id: string; title: string }[]).map((p) => ({
          id: p.id,
          name: p.title,
        })),
      },
    };
  });

export const saveSdrAgentConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    Ids.extend({
      config: z.unknown(),
      agent: z
        .object({
          qualification_prompt: z.string().max(4000).nullish(),
          handoff_score: z.number().int().min(0).max(100).optional(),
          opportunity_min_score: z.number().int().min(0).max(100).optional(),
          max_messages: z.number().int().min(1).max(20).optional(),
          follow_up_hours: z.number().int().min(1).max(720).optional(),
          max_follow_ups: z.number().int().min(0).max(10).optional(),
          mode: z.enum(["supervised", "auto"]).optional(),
        })
        .default({}),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { assertSdr } = await import("@/lib/prospecting/sdr/access.server");
    const { AgentConfigSchema } = await import("@/lib/prospecting/sdr/agent-config");
    await assertSdr(context.supabase, context.userId, data.workspaceId, "manage");
    await (await import("@/lib/view-as-guard.server")).assertNotReadOnlyView(context.supabase);
    const cfg = AgentConfigSchema.parse(data.config ?? {});

    // Responsável precisa ser membro ativo deste workspace.
    if (cfg.assigned_to) {
      const { data: member } = await context.supabase
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", data.workspaceId)
        .eq("user_id", cfg.assigned_to)
        .neq("status", "inactive")
        .maybeSingle();
      if (!member) throw new Error("Selecione um responsável ativo deste workspace.");
    }

    const { data: out, error } = await context.supabase
      .from("sdr_playbooks")
      .update({
        assigned_to: cfg.assigned_to,
        offer_keys: cfg.offer_keys,
        material_ids: cfg.material_ids,
        allowed_tools: cfg.allowed_tools,
        channels: cfg.channels,
        guardrails: cfg.guardrails,
        kb_sources: cfg.kb_sources,
        booking_page_id: cfg.booking_page_id,
        questionnaire_id: cfg.questionnaire_id,
        ...data.agent,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.playbookId)
      .eq("workspace_id", data.workspaceId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!out) throw new Error("Agente não encontrado ou sem permissão para editar.");
    return { ok: true };
  });

/** Últimos turnos do agente (logs e métricas por agente). */
export const getSdrAgentLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => Ids.parse(i))
  .handler(async ({ data, context }) => {
    const { assertSdr } = await import("@/lib/prospecting/sdr/access.server");
    await assertSdr(context.supabase, context.userId, data.workspaceId, "view");
    const { data: enr } = await context.supabase
      .from("sdr_enrollments")
      .select("id")
      .eq("workspace_id", data.workspaceId)
      .eq("playbook_id", data.playbookId)
      .limit(500);
    const ids = (enr ?? []).map((e) => e.id as string);
    if (!ids.length) return { items: [], totals: { total: 0, failed: 0 } };
    const { data: jobs, error } = await context.supabase
      .from("sdr_turn_jobs")
      .select("id, kind, status, error, created_at, agent_version_id, conversation_id")
      .eq("workspace_id", data.workspaceId)
      .in("enrollment_id", ids)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    const items = jobs ?? [];
    return {
      items,
      totals: {
        total: items.length,
        failed: items.filter((j) => j.status === "failed").length,
      },
    };
  });
