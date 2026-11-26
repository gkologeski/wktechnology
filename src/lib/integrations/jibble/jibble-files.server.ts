import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { prepareImportRecords } from "@/lib/projects/imports/import-preservation.server";
import { readJibbleScreenshot } from "./jibble-screenshot";

type Ctx = { client: SupabaseClient; workspaceId: string; userId: string };
type Input = {
  workspaceId: string;
  sourceId: string;
  runId: string;
  payload: unknown;
  observationKey?: string;
};
type FileRow = {
  id: string;
  title: string;
  bytes: number | null;
  content_type: string | null;
  storage_path: string | null;
  status: "preserved" | "pending" | "resolved";
  issue: string | null;
};
const BUCKET = "time-source-files";
const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");

/** Caller is a resumable service run; the database independently derives and authorizes its actor. */
export async function preserveJibbleScreenshot(
  db: SupabaseClient,
  input: Input,
): Promise<{ preserved: boolean }> {
  const authorized = await (
    db.rpc as unknown as (
      fn: string,
      data: Record<string, unknown>,
    ) => Promise<{ error: { message: string } | null }>
  )("jibble_import_file_authorize", {
    p_workspace: input.workspaceId,
    p_source: input.sourceId,
    p_run: input.runId,
  });
  if (authorized.error) throw new Error("Sem autorização para preservar capturas desta origem.");
  const payload =
    input.payload && typeof input.payload === "object" && !Array.isArray(input.payload)
      ? (input.payload as Record<string, unknown>)
      : {};
  const rawId = payload.id ?? payload.exportId;
  const externalId =
    typeof rawId === "string" && rawId.length > 0 && rawId.length <= 200
      ? rawId.toLowerCase()
      : null;
  const [source] = prepareImportRecords([
    {
      entity: "screenshot",
      externalId,
      payload: input.payload,
      observationKey: input.observationKey,
    },
  ]);
  const title = `Captura ${typeof payload.time === "string" ? payload.time.slice(0, 40) : source.external_id.slice(0, 80)}`;
  let bytes: Uint8Array | null = null;
  let contentType: string | null = null;
  let issue: string | null = null;
  let sha256: string | null = null;
  let storagePath: string | null = null;
  try {
    if (typeof payload.url !== "string" || !payload.url)
      throw new Error("A origem não forneceu o conteúdo da captura, inclusive quando arquivada.");
    const read = await readJibbleScreenshot(payload.url);
    bytes = read.bytes;
    contentType = read.contentType;
    sha256 = hash(bytes);
    storagePath = `${input.workspaceId}/${input.sourceId}/${sha256}`;
    const uploaded = await db.storage
      .from(BUCKET)
      .upload(storagePath, bytes, { upsert: false, contentType });
    if (uploaded.error && String((uploaded.error as { statusCode?: string }).statusCode) !== "409")
      throw new Error("Falha ao guardar a captura em armazenamento privado.");
  } catch (error) {
    // Never expose signed URLs, remote response bodies or request headers.
    issue =
      error instanceof Error &&
      /^(O endereço |Não foi |Captura |O conteúdo |A origem |Falha ao )/.test(error.message)
        ? error.message
        : "Conteúdo da captura pendente; retome a importação para tentar novamente.";
    bytes = null;
    contentType = null;
    sha256 = null;
    storagePath = null;
  }
  const fileKey = hash(`${source.external_id}:${source.payload_hash}:${sha256 ?? "pending"}`);
  const saved = await db.from("jibble_source_files" as never).upsert(
    {
      workspace_id: input.workspaceId,
      run_id: input.runId,
      source_org_id: input.sourceId,
      screenshot_id: source.external_id,
      source_hash: source.payload_hash,
      file_key: fileKey,
      title,
      sha256,
      storage_path: storagePath,
      bytes: bytes?.byteLength ?? null,
      content_type: contentType,
      status: storagePath ? "preserved" : "pending",
      issue,
    } as never,
    { onConflict: "workspace_id,source_org_id,screenshot_id,file_key" },
  );
  if (saved.error) throw new Error("Não foi possível registrar a preservação da captura.");
  if (storagePath) {
    const resolved = await db
      .from("jibble_source_files" as never)
      .update({ status: "resolved", run_id: input.runId } as never)
      .eq("workspace_id", input.workspaceId)
      .eq("source_org_id", input.sourceId)
      .eq("screenshot_id", source.external_id)
      .eq("source_hash", source.payload_hash)
      .eq("status", "pending");
    if (resolved.error) throw new Error("Não foi possível atualizar a conferência da captura.");
  }
  return { preserved: !!storagePath };
}

async function authorizeRead(ctx: Ctx) {
  const { requireJibbleAdmin } = await import("./jibble-service.server");
  const allowed = await requireJibbleAdmin(ctx.client, ctx.userId, { write: false });
  if (allowed.workspaceId !== ctx.workspaceId)
    throw new Error("Workspace diferente da sessão ativa.");
}

export async function listJibbleSourceFiles(
  ctx: Ctx,
  input: { sourceId: string; externalId: string },
) {
  await authorizeRead(ctx);
  const files: FileRow[] = [];
  for (let from = 0; ; from += 1000) {
    const result = await ctx.client
      .from("jibble_source_files" as never)
      .select("id,title,bytes,status,issue,content_type")
      .eq("workspace_id", ctx.workspaceId)
      .eq("source_org_id", input.sourceId)
      .eq("screenshot_id", input.externalId)
      .neq("status", "resolved")
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, from + 999);
    if (result.error) throw new Error("Não foi possível consultar os arquivos desta origem.");
    const page = (result.data ?? []) as FileRow[];
    files.push(...page);
    if (page.length < 1000) break;
  }
  return files.map((file) => ({
    id: file.id,
    name: file.title,
    size: file.bytes,
    status: file.status,
    issue: file.issue,
    contentType: file.content_type,
  }));
}

export async function getJibbleSourceFileUrl(ctx: Ctx, input: { id: string }) {
  await authorizeRead(ctx);
  const result = await ctx.client
    .from("jibble_source_files" as never)
    .select("id,title,storage_path,status")
    .eq("workspace_id", ctx.workspaceId)
    .eq("id", input.id)
    .maybeSingle();
  const file = result.data as FileRow | null;
  if (result.error || !file || file.status !== "preserved" || !file.storage_path)
    throw new Error("Arquivo não disponível ou sem permissão.");
  const signed = await ctx.client.storage
    .from(BUCKET)
    .createSignedUrl(file.storage_path, 60, { download: file.title });
  if (signed.error) throw new Error("Não foi possível abrir o arquivo privado.");
  return { url: signed.data.signedUrl, name: file.title, expiresIn: 60 };
}
