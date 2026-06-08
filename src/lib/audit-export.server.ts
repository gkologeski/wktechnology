// Execução real de uma exportação de audit log. Pode ser chamado pelo cron
// (via /api/public/hooks/audit-export-tick) ou via UI ("Executar agora").
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type ExportRow = {
  id: string;
  workspace_id: string;
  owner_id: string;
  destination: "s3" | "webhook" | "email";
  format: "json" | "csv";
  config: Record<string, string>;
  hmac_secret: string | null;
  last_run_at: string | null;
};

async function hmacSha256Hex(secret: string, body: string) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const esc = (v: unknown) => {
    if (v == null) return "";
    const s = typeof v === "string" ? v : JSON.stringify(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

export async function runAuditExport(exportId: string, workspaceId: string) {
  const { data: cfg } = await supabaseAdmin
    .from("audit_exports").select("*").eq("id", exportId).maybeSingle();
  if (!cfg) return { ok: false, error: "export not found" };
  const ex = cfg as ExportRow;

  const { data: run } = await (supabaseAdmin.from("audit_export_runs") as any).insert({
    owner_id: ex.owner_id,
    workspace_id: ex.workspace_id,
    export_id: ex.id,
    status: "running",
  }).select("id").maybeSingle();
  const runId = run?.id as string | undefined;

  try {
    const since = ex.last_run_at ?? new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: logs } = await supabaseAdmin
      .from("audit_logs")
      .select("*")
      .eq("workspace_owner_id", workspaceId)
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(10000);
    const rows = logs ?? [];
    const body = ex.format === "csv" ? toCsv(rows as Record<string, unknown>[]) : JSON.stringify(rows);
    const contentType = ex.format === "csv" ? "text/csv" : "application/json";

    let outputUrl: string | null = null;
    if (ex.destination === "webhook") {
      const url = ex.config.url;
      if (!url) throw new Error("webhook url missing");
      const headers: Record<string, string> = { "Content-Type": contentType };
      if (ex.hmac_secret) headers["X-Signature"] = await hmacSha256Hex(ex.hmac_secret, body);
      const res = await fetch(url, { method: "POST", headers, body });
      if (!res.ok) throw new Error(`webhook ${res.status}`);
      outputUrl = url;
    } else if (ex.destination === "s3") {
      // S3 upload via signed URL — config: { presigned_url }
      const url = ex.config.presigned_url;
      if (!url) throw new Error("s3 presigned_url missing");
      const res = await fetch(url, { method: "PUT", headers: { "Content-Type": contentType }, body });
      if (!res.ok) throw new Error(`s3 ${res.status}`);
      outputUrl = url.split("?")[0];
    } else if (ex.destination === "email") {
      // Email destination: registra mas não envia anexo aqui (integração futura).
      outputUrl = `mailto:${ex.config.email || ""}`;
    }

    await (supabaseAdmin.from("audit_exports") as any)
      .update({ last_run_at: new Date().toISOString(), last_status: "success" }).eq("id", ex.id);
    if (runId) {
      await (supabaseAdmin.from("audit_export_runs") as any)
        .update({ status: "success", finished_at: new Date().toISOString(), records_count: rows.length, output_url: outputUrl })
        .eq("id", runId);
    }
    return { ok: true, count: rows.length };
  } catch (err) {
    const msg = (err as Error).message;
    await (supabaseAdmin.from("audit_exports") as any)
      .update({ last_run_at: new Date().toISOString(), last_status: "failed" }).eq("id", ex.id);
    if (runId) {
      await (supabaseAdmin.from("audit_export_runs") as any)
        .update({ status: "failed", finished_at: new Date().toISOString(), error_message: msg })
        .eq("id", runId);
    }
    return { ok: false, error: msg };
  }
}
