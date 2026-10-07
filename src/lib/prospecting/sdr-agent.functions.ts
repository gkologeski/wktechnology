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
      .select("id, questionnaire_id, qualification_prompt, booking_page_id")
      .eq("id", data.playbookId)
      .eq("workspace_id", data.workspaceId)
      .maybeSingle();
    if (!pb) throw new Error("Agente não encontrado neste workspace.");
    // Leituras com o cliente do usuário (RLS); nada é gravado.
    const { offers, materials } = await loadKnowledge(context.supabase, data.workspaceId);
    const questions = await loadQuestions(context.supabase, data.workspaceId, pb.questionnaire_id);
    const system = buildSystemPrompt({
      offers,
      materials,
      questions,
      bookingAvailable: !!pb.booking_page_id,
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
