// Custom Objects: definições dinâmicas + registros.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

const FieldSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().min(1).max(80),
  type: z.enum(["text", "number", "date", "boolean", "select", "url", "email"]),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
});
export type CustomObjectField = z.infer<typeof FieldSchema>;

export const listCustomObjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data } = await supabase
      .from("custom_objects")
      .select("id, name, slug, icon, schema, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });
    return { objects: data ?? [] };
  });

export const upsertCustomObject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id?: string;
      name: string;
      slug: string;
      icon?: string | null;
      schema: CustomObjectField[];
    }) =>
      z
        .object({
          id: z.string().uuid().optional(),
          name: z.string().min(1).max(80),
          slug: z
            .string()
            .min(1)
            .max(40)
            .regex(/^[a-z][a-z0-9_-]*$/),
          icon: z.string().max(40).nullable().optional(),
          schema: z.array(FieldSchema).max(40),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    if (data.id) {
      const { error } = await supabase
        .from("custom_objects")
        .update({
          name: data.name,
          slug: data.slug,
          icon: data.icon ?? null,
          schema: data.schema as never,
        })
        .eq("id", data.id)
        .eq("workspace_id", workspaceId);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await supabase.from("custom_objects").insert({
      owner_id: userId,
      workspace_id: workspaceId,
      name: data.name,
      slug: data.slug,
      icon: data.icon ?? null,
      schema: data.schema as never,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCustomObject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await supabase.from("custom_objects").delete().eq("id", data.id).eq("workspace_id", workspaceId);
    return { ok: true };
  });

export const listCustomRecords = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { object_id: string }) => z.object({ object_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data: rows } = await supabase
      .from("custom_object_records")
      .select("id, data, created_at, updated_at")
      .eq("workspace_id", workspaceId)
      .eq("object_id", data.object_id)
      .order("created_at", { ascending: false })
      .limit(500);
    return { records: rows ?? [] };
  });

export const upsertCustomRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; object_id: string; data: Record<string, unknown> }) =>
    z
      .object({
        id: z.string().uuid().optional(),
        object_id: z.string().uuid(),
        data: z.record(z.string(), z.unknown()),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    if (data.id) {
      const { error } = await supabase
        .from("custom_object_records")
        .update({ data: data.data as never })
        .eq("id", data.id)
        .eq("workspace_id", workspaceId);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await supabase.from("custom_object_records").insert({
      owner_id: userId,
      workspace_id: workspaceId,
      object_id: data.object_id,
      data: data.data as never,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCustomRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await supabase.from("custom_object_records").delete().eq("id", data.id).eq("workspace_id", workspaceId);
    return { ok: true };
  });
