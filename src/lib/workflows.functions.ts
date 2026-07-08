// Server functions para o builder de Workflows.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { tickWorkflows } from "@/lib/workflows/engine.server";
import { requireTool } from "@/lib/permissions.server";
import { SaveSchema } from "@/lib/workflows/schemas";



export const listWorkflows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("workflows")
      .select("id, name, entity, enabled, trigger, actions, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);

    const since = new Date(Date.now() - 86_400_000).toISOString();
    const { data: runs } = await supabase
      .from("workflow_runs")
      .select("workflow_id, status")
      .gte("created_at", since);
    const stats = new Map<string, { total: number; errors: number }>();
    for (const r of runs ?? []) {
      const s = stats.get(r.workflow_id as string) ?? { total: 0, errors: 0 };
      s.total += 1;
      if (r.status === "error") s.errors += 1;
      stats.set(r.workflow_id as string, s);
    }
    return (data ?? []).map((w) => ({
      ...w,
      runs_24h: stats.get(w.id)?.total ?? 0,
      errors_24h: stats.get(w.id)?.errors ?? 0,
    }));
  });

export const saveWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SaveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireTool(userId, "manage_workflows");
    const payload = {
      owner_id: userId,
      name: data.name,
      entity: data.entity,
      enabled: data.enabled,
      trigger: data.trigger,
      actions: data.actions,
    } as never;
    if (data.id) {
      const { error } = await supabase.from("workflows").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase
      .from("workflows")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireTool(context.userId, "manage_workflows");
    const { error } = await context.supabase.from("workflows").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listRecentRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        workflowId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(100).default(20),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("workflow_runs")
      .select("id, workflow_id, status, started_at, finished_at, error, log, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.workflowId) q = q.eq("workflow_id", data.workflowId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const triggerTickNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Roda como o usuário (RLS) — só processa eventos do owner_id dele.
    return await tickWorkflows(context.supabase, 50);
  });
