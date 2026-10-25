import { requireSharedPermission } from "@/lib/access-control/shared-permission.middleware";
import { workRpc } from "@/lib/access-control/work-core.server";
import { resolveActiveWorkspace as getActiveWorkspaceId } from "@/lib/active-workspace.server";
// Server fns para a biblioteca de mídia (uploads de imagens/arquivos).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const BUCKET = "media";
const SIGNED_TTL = 60 * 60 * 24 * 365 * 5; // 5 years

function slugifyFilename(name: string) {
  const dot = name.lastIndexOf(".");
  const base = (dot > 0 ? name.slice(0, dot) : name) || "arquivo";
  const ext = dot > 0 ? name.slice(dot).toLowerCase() : "";
  const safeBase =
    base
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[-.]+|[-.]+$/g, "")
      .slice(0, 60) || "arquivo";
  return `${safeBase}${ext}`;
}

const ALLOWED_MIMES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "image/avif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
];

export const createMediaUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSharedPermission("system.media", "create")])
  .inputValidator(
    (d: { filename: string; mime?: string; size_bytes?: number; folder?: "branding" }) =>
      z
        .object({
          filename: z.string().min(1).max(200),
          mime: z.string().max(120).optional(),
          size_bytes: z
            .number()
            .int()
            .nonnegative()
            .max(20 * 1024 * 1024)
            .optional(),
          folder: z.enum(["branding"]).optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    if (data.mime && !ALLOWED_MIMES.includes(data.mime.toLowerCase())) {
      throw new Error(`Tipo de arquivo não permitido: ${data.mime}`);
    }
    const workspaceId = await getActiveWorkspaceId(userId);
    const safeName = slugifyFilename(data.filename);
    const path = await workRpc<string>(context.supabase, "shared_media_begin", {
      filename: safeName,
      folder: data.folder ?? null,
    });

    const { data: signed, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message || "Falha ao gerar URL de upload");
    return {
      path,
      token: signed.token,
      bucket: BUCKET,
      filename: safeName,
      workspace_id: workspaceId,
    };
  });

export const registerMediaAsset = createServerFn({ method: "POST" })
  .middleware([requireSharedPermission("system.media", "create")])
  .inputValidator(
    (d: {
      path: string;
      filename: string;
      mime?: string;
      size_bytes?: number;
      width?: number;
      height?: number;
    }) =>
      z
        .object({
          path: z.string().min(1).max(500),
          filename: z.string().min(1).max(200),
          mime: z.string().max(120).optional(),
          size_bytes: z.number().int().nonnegative().optional(),
          width: z.number().int().positive().optional(),
          height: z.number().int().positive().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const workspaceId = await getActiveWorkspaceId(userId);
    if (!data.path.startsWith(`${workspaceId}/`)) {
      throw new Error("Caminho não pertence ao workspace ativo.");
    }
    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(data.path, SIGNED_TTL);
    if (signErr || !signed?.signedUrl) {
      throw new Error(signErr?.message || "Falha ao assinar URL.");
    }
    const url = signed.signedUrl;
    const expires = new Date(Date.now() + SIGNED_TTL * 1000).toISOString();

    const row = await workRpc(context.supabase, "shared_media_register", {
      p: { ...data, url, url_expires_at: expires },
    });
    return row as {
      id: string;
      url: string;
      path: string;
      filename: string;
      mime: string | null;
      size_bytes: number | null;
      width: number | null;
      height: number | null;
      created_at: string;
    };
  });

export const listMediaAssets = createServerFn({ method: "POST" })
  .middleware([requireSharedPermission("system.media", "view")])
  .inputValidator(
    (d: { q?: string; kind?: "image" | "doc" | "all"; limit?: number; offset?: number }) =>
      z
        .object({
          q: z.string().max(120).optional(),
          kind: z.enum(["image", "doc", "all"]).optional(),
          limit: z.number().int().min(1).max(100).optional(),
          offset: z.number().int().min(0).optional(),
        })
        .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const workspaceId = await getActiveWorkspaceId(userId);
    const limit = data.limit ?? 48;
    const offset = data.offset ?? 0;

    let q = context.supabase
      .from("media_assets")
      .select(
        "id, url, url_expires_at, path, filename, mime, size_bytes, width, height, created_at",
        { count: "exact" },
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (data.q && data.q.trim()) {
      q = q.ilike("filename", `%${data.q.trim()}%`);
    }
    if (data.kind === "image") {
      q = q.like("mime", "image/%");
    } else if (data.kind === "doc") {
      q = q.not("mime", "like", "image/%");
    }

    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);

    type Row = {
      id: string;
      url: string;
      url_expires_at: string | null;
      path: string;
      filename: string;
      mime: string | null;
      size_bytes: number | null;
      width: number | null;
      height: number | null;
      created_at: string;
    };
    const list = (rows ?? []) as unknown as Row[];
    const refreshed: Row[] = await Promise.all(
      list.map(async (r) => {
        const exp = r.url_expires_at ? new Date(r.url_expires_at).getTime() : 0;
        if (!r.path.startsWith(`${workspaceId}/`) || r.path.split("/").includes(".."))
          throw new Error("Mídia de outro workspace.");
        if (exp - Date.now() < 60 * 60 * 24 * 30 * 1000) {
          await workRpc(context.supabase, "shared_media_authorize", { i: r.id, a: "view" });
          const { data: s } = await supabaseAdmin.storage
            .from(BUCKET)
            .createSignedUrl(r.path, SIGNED_TTL);
          if (s?.signedUrl) {
            const newExp = new Date(Date.now() + SIGNED_TTL * 1000).toISOString();
            await supabaseAdmin
              .from("media_assets")
              .update({ url: s.signedUrl, url_expires_at: newExp } as never)
              .eq("id", r.id);
            return { ...r, url: s.signedUrl, url_expires_at: newExp };
          }
        }
        return r;
      }),
    );

    return { rows: refreshed, total: count ?? refreshed.length };
  });

export const deleteMediaAsset = createServerFn({ method: "POST" })
  .middleware([requireSharedPermission("system.media", "delete")])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const workspaceId = await getActiveWorkspaceId(userId);
    await workRpc(context.supabase, "shared_media_authorize", { i: data.id, a: "delete" });
    const { data: row, error: selErr } = await supabaseAdmin
      .from("media_assets")
      .select("id, path, owner_user_id, workspace_id")
      .eq("id", data.id)
      .maybeSingle();
    if (selErr || !row) throw new Error(selErr?.message || "Arquivo não encontrado.");
    if ((row as { workspace_id: string }).workspace_id !== workspaceId) {
      throw new Error("Sem permissão para este workspace.");
    }
    if (!row.path.startsWith(`${workspaceId}/`) || row.path.split("/").includes(".."))
      throw new Error("Caminho inválido.");
    const removal = await supabaseAdmin.storage.from(BUCKET).remove([row.path]);
    if (removal.error) throw new Error(removal.error.message);
    const { error } = await supabaseAdmin.from("media_assets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
