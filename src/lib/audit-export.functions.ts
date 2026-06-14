// Exportação programada de audit logs (S3 / webhook / email).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function activeWorkspace(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("active_workspace_id")
    .eq("id", userId)
    .maybeSingle();
  if (!data?.active_workspace_id) throw new Error("Workspace ativo não encontrado");
  return data.active_workspace_id as string;
}

const UpsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  destination: z.enum(["s3", "webhook", "email"]),
  config: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
  format: z.enum(["json", "csv"]).default("json"),
  schedule_cron: z.string().min(5).max(64).default("0 2 * * *"),
  hmac_secret: z.string().max(256).optional(),
  enabled: z.boolean().default(true),
});

export const listAuditExports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const ws = await activeWorkspace(supabase, userId);
    const { data } = await supabase
      .from("audit_exports")
      .select("*")
      .eq("workspace_id", ws)
      .order("created_at", { ascending: false });
    return { items: data ?? [] };
  });

export const upsertAuditExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ws = await activeWorkspace(supabase, userId);
    const payload = {
      owner_id: ws,
      workspace_id: ws,
      name: data.name,
      destination: data.destination,
      config: data.config,
      format: data.format,
      schedule_cron: data.schedule_cron,
      hmac_secret: data.hmac_secret ?? null,
      enabled: data.enabled,
    };
    if (data.id) {
      const { error } = await (supabase.from("audit_exports") as any)
        .update(payload)
        .eq("id", data.id)
        .eq("workspace_id", ws);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: ins, error } = await (supabase.from("audit_exports") as any)
      .insert(payload)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { ok: true, id: ins?.id };
  });

export const deleteAuditExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ws = await activeWorkspace(supabase, userId);
    await supabase.from("audit_exports").delete().eq("id", data.id).eq("workspace_id", ws);
    return { ok: true };
  });

export const listAuditExportRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { exportId: string }) => z.object({ exportId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ws = await activeWorkspace(supabase, userId);
    const { data: rows } = await supabase
      .from("audit_export_runs")
      .select("id, started_at, finished_at, status, records_count, error_message")
      .eq("export_id", data.exportId)
      .eq("workspace_id", ws)
      .order("started_at", { ascending: false })
      .limit(50);
    return { items: rows ?? [] };
  });

export const runAuditExportNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ws = await activeWorkspace(supabase, userId);
    const { runAuditExport } = await import("./audit-export.server");
    const r = await runAuditExport(data.id, ws);
    return r;
  });
