import { workRpc } from "@/lib/access-control/work-core.server";
import { assertSafeWebhookUrl, dohResolver } from "@/lib/webhooks/url-guard";
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
  cursor_at?: string | null;
  cursor_id?: string | null;
};

async function hmacSha256Hex(secret: string, body: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const esc = (v: unknown) => {
    if (v == null) return "";
    const s = typeof v === "string" ? v : JSON.stringify(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join(
    "\n",
  );
}

export async function runAuditExport(exportId: string, workspaceId: string) {
  const { data: cfg, error: configError } = await supabaseAdmin
    .from("audit_exports")
    .select("*")
    .eq("id", exportId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (configError) return { ok: false, error: configError.message };
  if (!cfg) return { ok: false, error: "export not found" };
  const ex = cfg as ExportRow;

  const { data: run, error: runInsertError } = await (
    supabaseAdmin.from("audit_export_runs") as any
  )
    .insert({
      owner_id: ex.owner_id,
      workspace_id: ex.workspace_id,
      export_id: ex.id,
      status: "running",
    })
    .select("id")
    .maybeSingle();
  if (runInsertError || !run?.id)
    return {
      ok: false,
      error: runInsertError?.message ?? "Não foi possível registrar a execução.",
    };
  const runId = run.id as string;

  try {
    if (ex.destination === "email")
      throw Error("Entrega de auditoria por e-mail ainda não está disponível.");
    const since =
      ex.cursor_at ?? ex.last_run_at ?? new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const batch = await workRpc<{
      rows: Record<string, unknown>[];
      has_more: boolean;
      cursor_at: string;
      cursor_id: string | null;
    }>(supabaseAdmin, "shared_audit_export_rows", {
      p_id: ex.id,
      p_workspace: ex.workspace_id,
      p_since: since,
      p_after: ex.cursor_id ?? null,
      p_until: new Date().toISOString(),
    });
    if (!Array.isArray(batch.rows) || !batch.cursor_at)
      throw Error("Resposta de auditoria inválida.");
    const rows = batch.rows;
    const body =
      ex.format === "csv" ? toCsv(rows as Record<string, unknown>[]) : JSON.stringify(rows);
    const contentType = ex.format === "csv" ? "text/csv" : "application/json";

    let outputUrl: string | null = null;
    if (rows.length && ex.destination === "webhook") {
      const url = ex.config.url;
      if (!url) throw new Error("webhook url missing");
      const headers: Record<string, string> = { "Content-Type": contentType };
      if (ex.hmac_secret) headers["X-Signature"] = await hmacSha256Hex(ex.hmac_secret, body);
      await assertSafeWebhookUrl(url, dohResolver);
      const res = await fetch(url, {
        method: "POST",
        headers,
        body,
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`webhook ${res.status}`);
      outputUrl = url;
    } else if (rows.length && ex.destination === "s3") {
      // S3 upload via signed URL — config: { presigned_url }
      const url = ex.config.presigned_url;
      if (!url) throw new Error("s3 presigned_url missing");
      await assertSafeWebhookUrl(url, dohResolver);
      const res = await fetch(url, {
        redirect: "error",
        signal: AbortSignal.timeout(15000),
        method: "PUT",
        headers: { "Content-Type": contentType },
        body,
      });
      if (!res.ok) throw new Error(`s3 ${res.status}`);
      outputUrl = url.split("?")[0];
    }

    const { error: cursorError } = await (supabaseAdmin.from("audit_exports") as any)
      .update({
        last_run_at: new Date().toISOString(),
        last_status: "success",
        cursor_at: batch.cursor_at,
        cursor_id: batch.cursor_id,
      })
      .eq("id", ex.id)
      .eq("workspace_id", workspaceId)
      .select("id")
      .single();
    if (cursorError) throw Error(cursorError.message);
    if (runId) {
      const { error: historyError } = await (supabaseAdmin.from("audit_export_runs") as any)
        .update({
          status: "success",
          finished_at: new Date().toISOString(),
          records_count: rows.length,
          output_url: outputUrl,
        })
        .eq("id", runId)
        .eq("workspace_id", workspaceId)
        .select("id")
        .single();
      if (historyError) throw Error(historyError.message);
    }
    return { ok: true, count: rows.length, hasMore: batch.has_more };
  } catch (err) {
    const msg = (err as Error).message;
    await (supabaseAdmin.from("audit_exports") as any)
      .update({ last_status: "failed" })
      .eq("id", ex.id);
    if (runId) {
      await (supabaseAdmin.from("audit_export_runs") as any)
        .update({ status: "failed", finished_at: new Date().toISOString(), error_message: msg })
        .eq("id", runId);
    }
    return { ok: false, error: msg };
  }
}
