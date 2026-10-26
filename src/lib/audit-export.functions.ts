import { workRpc } from "@/lib/access-control/work-core.server";
import { normalizeEmailAddress } from "@/lib/email-address";
// Exportação programada de audit logs (S3 / webhook / email).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuditExportPermission } from "@/lib/access-control/audit-export-permission.middleware";

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
  .middleware([requireAuditExportPermission()])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const ws = context.auditExportWorkspaceId;
    const { data, error } = await supabase
      .from("audit_exports")
      .select(
        "id,owner_id,workspace_id,name,destination,config,format,schedule_cron,enabled,last_run_at,last_status,created_at,updated_at",
      )
      .eq("workspace_id", ws)
      .order("created_at", { ascending: false });
    if (error) throw Error(error.message);
    return { items: data ?? [] };
  });

export const upsertAuditExport = createServerFn({ method: "POST" })
  .middleware([requireAuditExportPermission()])
  .inputValidator((d: unknown) => UpsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ws = context.auditExportWorkspaceId;
    await workRpc(supabase, "shared_audit_export_authorize", { a: data.id ? "update" : "create" });
    if (data.destination === "email") {
      const email = normalizeEmailAddress(data.config.email);
      if (!email) throw new Error("E-mail de destino obrigatório.");
      data.config.email = email;
    }
    const payload = {
      workspace_id: ws,
      name: data.name,
      destination: data.destination,
      config: data.config,
      format: data.format,
      schedule_cron: data.schedule_cron,
      ...(data.hmac_secret?.trim() ? { hmac_secret: data.hmac_secret } : {}),
      enabled: data.enabled,
    };
    if (data.id) {
      const { error } = await (supabase.from("audit_exports") as any)
        .update(payload)
        .eq("id", data.id)
        .eq("workspace_id", ws)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: ins, error } = await (supabase.from("audit_exports") as any)
      .insert({ ...payload, owner_id: userId })
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { ok: true, id: ins?.id };
  });

export const deleteAuditExport = createServerFn({ method: "POST" })
  .middleware([requireAuditExportPermission("delete")])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ws = context.auditExportWorkspaceId;
    const { error } = await supabase
      .from("audit_exports")
      .delete()
      .eq("id", data.id)
      .eq("workspace_id", ws)
      .select("id")
      .single();
    if (error) throw Error(error.message);
    return { ok: true };
  });

export const listAuditExportRuns = createServerFn({ method: "GET" })
  .middleware([requireAuditExportPermission()])
  .inputValidator((d: { exportId: string }) => z.object({ exportId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ws = context.auditExportWorkspaceId;
    const { data: rows, error } = await supabase
      .from("audit_export_runs")
      .select("id, started_at, finished_at, status, records_count, error_message")
      .eq("export_id", data.exportId)
      .eq("workspace_id", ws)
      .order("started_at", { ascending: false })
      .limit(50);
    if (error) throw Error(error.message);
    return { items: rows ?? [] };
  });

export const runAuditExportNow = createServerFn({ method: "POST" })
  .middleware([requireAuditExportPermission("manage")])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ws = context.auditExportWorkspaceId;
    const { data: owned, error: ownErr } = await supabase
      .from("audit_exports")
      .select("id")
      .eq("id", data.id)
      .eq("workspace_id", ws)
      .maybeSingle();
    if (ownErr) throw new Error(ownErr.message);
    if (!owned) throw new Error("Exportação não encontrada neste workspace.");
    const { runAuditExport } = await import("./audit-export.server");
    const r = await runAuditExport(data.id, ws);
    return r;
  });
