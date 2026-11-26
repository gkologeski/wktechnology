import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readClickUpAttachment } from "./clickup-api.server";
import { assertClickUpImport } from "./clickup-import.server";

type Ctx = { client: SupabaseClient; workspaceId: string; userId: string };
type FileRow = {
  id: string;
  attachment_id: string;
  title: string;
  bytes: number | null;
  content_type: string | null;
  storage_path: string | null;
  status: "preserved" | "pending";
  issue: string | null;
};
const BUCKET = "clickup-source-files";
async function hash(value: Uint8Array | string) {
  return createHash("sha256").update(value).digest("hex");
}

/** Original binário privado. URLs transitórias são usadas só para a transferência e nunca salvas. */
export async function preserveClickUpFile(
  ctx: Ctx,
  runId: string,
  teamId: string,
  attachment: Record<string, unknown>,
  externalId: string,
) {
  await assertClickUpImport(ctx.client, ctx.workspaceId, ctx.userId, "manage");
  if (!externalId.trim() || externalId.length > 1024)
    throw new Error("Identidade do arquivo de origem inválida.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const authorized = await supabaseAdmin.rpc(
    "clickup_import_file_authorize" as never,
    {
      p_workspace: ctx.workspaceId,
      p_source: teamId,
      p_run: runId,
    } as never,
  );
  if (authorized.error) throw new Error("Arquivo fora das origens autorizadas desta importação.");
  // O escopo já foi fixado no run pelo checkpoint; reconfere também antes de baixar bytes.
  const run = await ctx.client
    .from("clickup_import_runs" as never)
    .select("source_team_ids")
    .eq("id", runId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (
    run.error ||
    !run.data ||
    !(run.data as { source_team_ids: string[] }).source_team_ids.includes(teamId)
  )
    throw new Error("Arquivo fora das origens autorizadas desta importação.");
  // Raw attachments may have no id. The collector supplies the ledger's exact
  // contextual identity so metadata, bytes and the record drawer stay linked.
  const attachmentId = externalId;
  const title = String(attachment["title"] ?? "Arquivo de origem");
  const key = await hash(
    JSON.stringify({
      id: attachmentId,
      title,
      size: attachment["size"],
      updated: attachment["date_updated"] ?? attachment["date"],
    }),
  );
  const previous = await supabaseAdmin
    .from("clickup_source_files" as never)
    .select("*")
    .eq("workspace_id", ctx.workspaceId)
    .eq("team_id", teamId)
    .eq("file_key", key)
    .maybeSingle();
  if (previous.error) throw new Error(previous.error.message);
  if (previous.data && (previous.data as FileRow).status === "preserved")
    return previous.data as FileRow;
  let storagePath: string | null = null,
    sha256: string | null = null,
    size: number | null = null,
    contentType: string | null = null;
  let issue: string | null = null;
  try {
    if (typeof attachment["url"] !== "string")
      throw new Error("A origem não forneceu o conteúdo do arquivo.");
    if (Number(attachment["size"]) > 64 * 1024 * 1024)
      throw new Error("Arquivo maior que 64 MiB; conteúdo ainda não preservado.");
    const result = await readClickUpAttachment(attachment["url"]);
    sha256 = await hash(result.bytes);
    size = result.bytes.byteLength;
    contentType = result.contentType;
    storagePath = `${ctx.workspaceId}/${teamId}/${sha256}`;
    const uploaded = await supabaseAdmin.storage.from(BUCKET).upload(storagePath, result.bytes, {
      upsert: false,
      contentType: result.contentType,
    });
    if (uploaded.error && !/already exists|duplicate/i.test(uploaded.error.message))
      throw new Error("Falha ao guardar o conteúdo em armazenamento privado.");
  } catch (error) {
    // Mensagens são locais e não incluem a URL de origem nem corpo de resposta do provedor.
    issue =
      error instanceof Error &&
      /^(Arquivo |O endereço |A origem |Não foi |Falha ao )/.test(error.message)
        ? error.message
        : "Conteúdo do arquivo pendente de preservação; retome a coleta.";
    storagePath = null;
    sha256 = null;
  }
  const saved = await supabaseAdmin
    .from("clickup_source_files" as never)
    .upsert(
      {
        workspace_id: ctx.workspaceId,
        run_id: runId,
        team_id: teamId,
        attachment_id: attachmentId,
        file_key: key,
        title,
        sha256,
        storage_path: storagePath,
        bytes: size,
        content_type: contentType,
        status: storagePath ? "preserved" : "pending",
        issue,
      } as never,
      { onConflict: "workspace_id,team_id,file_key" },
    )
    .select("*")
    .single();
  if (saved.error) throw new Error(saved.error.message);
  return saved.data as unknown as FileRow;
}

export async function listClickUpSourceFiles(
  ctx: Ctx,
  input: { sourceId: string; externalId: string },
) {
  await assertClickUpImport(ctx.client, ctx.workspaceId, ctx.userId, "view");
  const files: Pick<FileRow, "id" | "title" | "bytes" | "status" | "issue" | "content_type">[] = [];
  for (let from = 0; ; from += 1000) {
    const result = await ctx.client
      .from("clickup_source_files" as never)
      .select("id,title,bytes,status,issue,content_type")
      .eq("workspace_id", ctx.workspaceId)
      .eq("team_id", input.sourceId)
      .eq("attachment_id", input.externalId)
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, from + 999);
    if (result.error) throw new Error(result.error.message);
    files.push(...((result.data ?? []) as typeof files));
    if (!result.data || result.data.length < 1000) break;
  }
  return files.map((f) => ({
    id: f.id,
    name: f.title,
    size: f.bytes,
    status: f.status,
    issue: f.issue,
    contentType: f.content_type,
  }));
}

export async function getClickUpSourceFileUrl(ctx: Ctx, input: { id: string }) {
  await assertClickUpImport(ctx.client, ctx.workspaceId, ctx.userId, "view");
  const file = await ctx.client
    .from("clickup_source_files" as never)
    .select("id,title,storage_path,status")
    .eq("workspace_id", ctx.workspaceId)
    .eq("id", input.id)
    .maybeSingle();
  if (file.error || !file.data || (file.data as FileRow).status !== "preserved")
    throw new Error("Arquivo não disponível ou sem permissão.");
  const data = file.data as FileRow;
  const signed = await ctx.client.storage.from(BUCKET).createSignedUrl(data.storage_path!, 60, {
    download: data.title,
  });
  if (signed.error) throw new Error("Não foi possível abrir o arquivo privado.");
  return { url: signed.data.signedUrl, name: data.title, expiresIn: 60 };
}
