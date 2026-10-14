import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Habilidades e ferramentas por agente: catálogo com prontidão, configuração
// no rascunho (a publicada governa a produção) e teste isolado simulado.

const Pb = z.object({ playbookId: z.string().uuid() });

export const getSdrToolCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => Pb.parse(i))
  .handler(async ({ data, context }) => {
    const { getCatalog } = await import("@/lib/prospecting/sdr/tools/admin.server");
    // JSON string: schemas das ferramentas têm formato livre.
    return {
      json: JSON.stringify(await getCatalog(context.supabase, context.userId, data.playbookId)),
    };
  });

export const saveSdrToolConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => Pb.extend({ config: z.unknown() }).parse(i))
  .handler(async ({ data, context }) => {
    const { saveToolDraft } = await import("@/lib/prospecting/sdr/tools/admin.server");
    return saveToolDraft(context.supabase, context.userId, data.playbookId, data.config);
  });

export const testSdrTool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    Pb.extend({
      tool: z.string().min(3).max(60),
      args: z.unknown(),
      sandbox_state: z.unknown().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const admin = await import("@/lib/prospecting/sdr/tools/admin.server");
    const ws = await admin.gate(context.supabase, context.userId, "update");
    const pb = await admin.loadPlaybook(context.supabase, ws, data.playbookId);
    const { parseToolConfig } = await import("@/lib/prospecting/sdr/tools/catalog");
    const { createSandbox } = await import("@/lib/prospecting/sdr/tools/sandbox");
    const { executeTool } = await import("@/lib/prospecting/sdr/tools/dispatcher");
    const { configFromRow, scopeKnowledge } = await import("@/lib/prospecting/sdr/agent-config");
    const { loadKnowledge, loadQuestions } = await import("@/lib/prospecting/sdr/worker.server");
    const { data: vers } = await context.supabase
      .from("sdr_agent_versions")
      .select("status, tool_config")
      .eq("workspace_id", ws)
      .eq("playbook_id", data.playbookId)
      .in("status", ["draft", "published"]);
    const cfg =
      parseToolConfig(vers?.find((v) => v.status === "draft")?.tool_config) ??
      parseToolConfig(vers?.find((v) => v.status === "published")?.tool_config);
    if (!cfg) throw new Error("Configure as ferramentas do agente antes de testar.");
    const agentCfg = configFromRow(pb);
    const { offers, materials } = scopeKnowledge(
      agentCfg,
      await loadKnowledge(context.supabase, ws),
    );
    const history = [
      {
        id: "sandbox-msg-1",
        direction: "inbound" as const,
        body: "Mensagem de teste",
        created_at: new Date().toISOString(),
      },
    ];
    const sb = createSandbox({
      workspaceId: ws,
      playbookId: data.playbookId,
      config: cfg,
      facts: await admin.readinessFacts(ws, pb, cfg),
      history,
      offers,
      materials,
      kbSources: agentCfg.kb_sources,
      attachMaterials: agentCfg.guardrails.attach_materials,
      questions: pb.questionnaire_id
        ? await loadQuestions(context.supabase, ws, pb.questionnaire_id)
        : [],
      assigneeId: agentCfg.assigned_to,
      state: (data.sandbox_state ?? null) as never,
    });
    const output = await executeTool(sb.ctx, data.tool, data.args, `t-${Date.now()}`);
    return {
      simulated: true,
      confirmation_message_id: "sandbox-msg-1",
      output: JSON.stringify(output),
      sandbox_state: sb.snapshot() as never,
    };
  });
