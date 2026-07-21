// Sprint 8 — CRUD de assinaturas de workflow (eventos cross-módulo).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

export type WorkflowSubscriptionAction = {
  type: "create_ticket";
  subject: string;
  description?: string | null;
  priority?: "low" | "medium" | "high" | "urgent";
  assignee_id?: string | null;
  pipeline_id?: string | null;
};

export type WorkflowSubscriptionRow = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  event_pattern: string;
  action: WorkflowSubscriptionAction;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

const ActionSchema = z.object({
  type: z.literal("create_ticket"),
  subject: z.string().min(1).max(300),
  description: z.string().max(5000).optional().nullable(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  assignee_id: z.string().uuid().optional().nullable(),
  pipeline_id: z.string().uuid().optional().nullable(),
});

const UpsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  event_pattern: z
    .string()
    .trim()
    .min(3)
    .max(120)
    .regex(/^[a-z0-9_.*]+$/i, "use apenas letras, números, . _ *"),
  action: ActionSchema,
  enabled: z.boolean().default(true),
});

export const listWorkflowSubscriptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ items: WorkflowSubscriptionRow[] }> => {
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const { data, error } = await context.supabase
      .from("workflow_subscriptions")
      .select("*")
      .eq("owner_id", workspaceId)
      .order("event_pattern", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return { items: (data ?? []) as unknown as WorkflowSubscriptionRow[] };
  });

export const saveWorkflowSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpsertSchema.parse(d))
  .handler(async ({ context, data }): Promise<{ item: WorkflowSubscriptionRow }> => {
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const payload = {
      id: data.id,
      owner_id: workspaceId,
      name: data.name,
      description: data.description ?? null,
      event_pattern: data.event_pattern,
      action: data.action as unknown as Record<string, unknown>,
      enabled: data.enabled,
      created_by: context.userId,
    };
    const { data: row, error } = await context.supabase
      .from("workflow_subscriptions")
      .upsert(payload as never)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { item: row as unknown as WorkflowSubscriptionRow };
  });

export const toggleWorkflowSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), enabled: z.boolean() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("workflow_subscriptions")
      .update({ enabled: data.enabled })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteWorkflowSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("workflow_subscriptions")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
