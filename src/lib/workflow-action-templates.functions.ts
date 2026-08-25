// Modelos reutilizáveis de ações de workflow.
// O usuário salva uma ação já configurada (com valores/variáveis mapeados) e
// pode reaplicá-la em outros workflows.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

import type { Json } from "@/integrations/supabase/types";

export type WorkflowActionTemplateRow = {
  id: string;
  owner_id: string;
  workspace_id: string | null;
  name: string;
  description: string | null;
  action_type: string;
  entity: string | null;
  table_name: string | null;
  action_json: Json;
  visibility: "personal" | "shared";
  usage_count: number;
  created_at: string;
  updated_at: string;
};

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  action_type: z.string().min(1).max(60),
  entity: z.string().max(60).optional().nullable(),
  table_name: z.string().max(60).optional().nullable(),
  action_json: z.record(z.string(), z.unknown()),
  visibility: z.enum(["personal", "shared"]).default("personal"),
});

export const listWorkflowActionTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        action_type: z.string().max(60).optional(),
        entity: z.string().max(60).optional(),
        table_name: z.string().max(60).optional(),
        q: z.string().trim().max(120).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ context, data }): Promise<{ items: WorkflowActionTemplateRow[] }> => {
    let query = context.supabase
      .from("workflow_action_templates")
      .select("*")
      .order("usage_count", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(200);

    if (data.action_type) query = query.eq("action_type", data.action_type);
    if (data.entity) query = query.eq("entity", data.entity);
    if (data.table_name) query = query.eq("table_name", data.table_name);
    if (data.q) query = query.ilike("name", `%${data.q}%`);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return { items: (rows ?? []) as WorkflowActionTemplateRow[] };
  });

export const saveWorkflowActionTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertSchema.parse(d))
  .handler(async ({ context, data }): Promise<{ item: WorkflowActionTemplateRow }> => {
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const payload = {
      id: data.id,
      owner_id: context.userId,
      workspace_id: workspaceId,
      name: data.name,
      description: data.description ?? null,
      action_type: data.action_type,
      entity: data.entity ?? null,
      table_name: data.table_name ?? null,
      action_json: data.action_json as unknown as Json,
      visibility: data.visibility,
    };
    const { data: row, error } = await context.supabase
      .from("workflow_action_templates")
      .upsert(payload)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { item: row as WorkflowActionTemplateRow };
  });

export const deleteWorkflowActionTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("workflow_action_templates")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const incrementWorkflowActionTemplateUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.rpc("increment_wat_usage", { _id: data.id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
