import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const QUOTA_BYTES = 100 * 1024 * 1024;

function randomToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const listFiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ folderId: z.string().uuid().nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const foldersQ = await (data.folderId === null
      ? supabase
          .from("user_file_folders")
          .select("id, name, parent_id, created_at")
          .eq("owner_id", userId)
          .is("parent_id", null)
          .order("name")
      : supabase
          .from("user_file_folders")
          .select("id, name, parent_id, created_at")
          .eq("owner_id", userId)
          .eq("parent_id", data.folderId)
          .order("name"));
    const filesQ = await (data.folderId === null
      ? supabase
          .from("user_files")
          .select("id, name, size_bytes, mime_type, is_public, public_token, created_at, folder_id")
          .eq("owner_id", userId)
          .is("folder_id", null)
          .order("created_at", { ascending: false })
      : supabase
          .from("user_files")
          .select("id, name, size_bytes, mime_type, is_public, public_token, created_at, folder_id")
          .eq("owner_id", userId)
          .eq("folder_id", data.folderId)
          .order("created_at", { ascending: false }));
    const usedQ = await supabase.rpc("user_files_used_bytes", { uid: userId });

    if (foldersQ.error) throw new Error(foldersQ.error.message);
    if (filesQ.error) throw new Error(filesQ.error.message);
    return {
      folders: foldersQ.data ?? [],
      files: filesQ.data ?? [],
      usedBytes: Number(usedQ.data ?? 0),
      quotaBytes: QUOTA_BYTES,
    };
  });

export const getFolderPath = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ folderId: z.string().uuid().nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    if (!data.folderId) return [] as { id: string; name: string }[];
    const { supabase, userId } = context;
    const trail: { id: string; name: string }[] = [];
    let current: string | null = data.folderId;
    for (let i = 0; i < 32 && current; i++) {
      const res = await supabase
        .from("user_file_folders")
        .select("id, name, parent_id")
        .eq("id", current)
        .eq("owner_id", userId)
        .maybeSingle();
      const row = res.data as { id: string; name: string; parent_id: string | null } | null;
      if (res.error || !row) break;
      trail.unshift({ id: row.id, name: row.name });
      current = row.parent_id;

    }
    return trail;
  });

export const createFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ name: z.string().trim().min(1).max(200), parentId: z.string().uuid().nullable() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase
      .from("user_file_folders")
      .insert({ owner_id: context.userId, name: data.name, parent_id: data.parentId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const renameNode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        kind: z.enum(["file", "folder"]),
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const table = data.kind === "file" ? "user_files" : "user_file_folders";
    const { error } = await context.supabase
      .from(table)
      .update({ name: data.name })
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("user_files")
      .select("storage_path")
      .eq("id", data.id)
      .eq("owner_id", userId)
      .maybeSingle();
    if (row?.storage_path) {
      await supabase.storage.from("user-files").remove([row.storage_path]);
    }
    const { error } = await supabase.from("user_files").delete().eq("id", data.id).eq("owner_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Recursively collect all descendant files, remove storage, then delete folder (cascade DB).
    const stack: string[] = [data.id];
    const paths: string[] = [];
    while (stack.length) {
      const cur = stack.pop()!;
      const [{ data: children }, { data: files }] = await Promise.all([
        supabase.from("user_file_folders").select("id").eq("owner_id", userId).eq("parent_id", cur),
        supabase.from("user_files").select("storage_path").eq("owner_id", userId).eq("folder_id", cur),
      ]);
      (children ?? []).forEach((c: { id: string }) => stack.push(c.id));
      (files ?? []).forEach((f: { storage_path: string }) => paths.push(f.storage_path));
    }
    if (paths.length) await supabase.storage.from("user-files").remove(paths);
    const { error } = await supabase
      .from("user_file_folders")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const togglePublicLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), enable: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const patch = data.enable
      ? { is_public: true, public_token: randomToken() }
      : { is_public: false, public_token: null };
    const { data: row, error } = await context.supabase
      .from("user_files")
      .update(patch)
      .eq("id", data.id)
      .eq("owner_id", context.userId)
      .select("public_token, is_public")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const getDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("user_files")
      .select("storage_path, name")
      .eq("id", data.id)
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (!row) throw new Error("Arquivo não encontrado");
    const { data: signed, error } = await context.supabase.storage
      .from("user-files")
      .createSignedUrl(row.storage_path, 120, { download: row.name });
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });
