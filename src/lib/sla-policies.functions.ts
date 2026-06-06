// Server functions for ticket SLA policies (priority/queue).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PriorityEnum = z.enum(["low", "medium", "high", "urgent"]);

export const listSlaPolicies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("sla_policies")
      .select("id, name, pipeline_id, priority, first_response_mins, resolution_mins, active, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertSlaPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1).max(120),
    pipeline_id: z.string().uuid().nullable(),
    priority: PriorityEnum.nullable(),
    first_response_mins: z.number().int().min(1).max(100000),
    resolution_mins: z.number().int().min(1).max(1000000),
    active: z.boolean(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.id) {
      const { error } = await supabase.from("sla_policies").update({
        name: data.name,
        pipeline_id: data.pipeline_id,
        priority: data.priority,
        first_response_mins: data.first_response_mins,
        resolution_mins: data.resolution_mins,
        active: data.active,
      }).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    // owner_id is the workspace owner (current user's workspace).
    const { data: prof } = await supabase.from("profiles").select("active_workspace_id").eq("id", userId).single();
    const wsId = (prof?.active_workspace_id as string | null) ?? userId;
    const { data: ins, error } = await supabase.from("sla_policies").insert({
      owner_id: wsId,
      workspace_id: wsId,
      name: data.name,
      pipeline_id: data.pipeline_id,
      priority: data.priority,
      first_response_mins: data.first_response_mins,
      resolution_mins: data.resolution_mins,
      active: data.active,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins!.id };
  });

export const deleteSlaPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("sla_policies").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Marca tickets com prazo vencido. Pode ser chamado por cron público (sem auth) ou pela UI. */
export const runSlaBreachCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const now = new Date().toISOString();
    const { data: frBreaches, error: e1 } = await supabase
      .from("tickets")
      .update({ sla_first_response_breached: true })
      .lt("sla_first_response_due_at", now)
      .is("sla_first_response_at", null)
      .eq("sla_first_response_breached", false)
      .is("deleted_at", null)
      .select("id");
    if (e1) throw new Error(e1.message);
    const { data: resBreaches, error: e2 } = await supabase
      .from("tickets")
      .update({ sla_resolution_breached: true })
      .lt("sla_resolution_due_at", now)
      .is("resolved_at", null)
      .eq("sla_resolution_breached", false)
      .is("deleted_at", null)
      .select("id");
    if (e2) throw new Error(e2.message);
    return {
      first_response_breaches: frBreaches?.length ?? 0,
      resolution_breaches: resBreaches?.length ?? 0,
    };
  });

/** Lista pipelines (entity=ticket) para o seletor de fila. */
export const listTicketPipelines = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("pipelines")
      .select("id, name, entity")
      .eq("entity", "ticket")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });
