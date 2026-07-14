// Snippets: textos pré-prontos reutilizáveis, inseridos via /atalho.
// Escopo global no workspace, com visibilidade "personal" (dono) ou
// "shared" (todos do workspace). Compartilhados só podem ser criados
// ou editados por admin do workspace (reforçado por RLS).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

export type SnippetRow = {
  id: string;
  owner_id: string;
  workspace_id: string | null;
  name: string;
  shortcut: string;
  body_html: string;
  body_text: string;
  folder: string | null;
  visibility: "personal" | "shared";
  usage_count: number;
  created_at: string;
  updated_at: string;
};

const shortcutRegex = /^[a-zA-Z0-9_\-/]+$/;

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  shortcut: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(shortcutRegex, "use apenas letras, números, _ - /"),
  body_html: z.string().max(200_000).optional().default(""),
  body_text: z.string().max(200_000).optional().default(""),
  folder: z.string().trim().max(80).optional().nullable(),
  visibility: z.enum(["personal", "shared"]).default("personal"),
});

export const listSnippets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        q: z.string().trim().max(120).optional(),
        visibility: z.enum(["personal", "shared", "all"]).optional().default("all"),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ context, data }): Promise<{ items: SnippetRow[] }> => {
    let query = context.supabase
      .from("snippets")
      .select("*")
      .order("usage_count", { ascending: false })
      .order("shortcut", { ascending: true })
      .limit(500);

    if (data.visibility && data.visibility !== "all") {
      query = query.eq("visibility", data.visibility);
    }
    if (data.q) {
      const like = `%${data.q}%`;
      query = query.or(`shortcut.ilike.${like},name.ilike.${like},folder.ilike.${like}`);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return { items: (rows ?? []) as SnippetRow[] };
  });

export const upsertSnippet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertSchema.parse(d))
  .handler(async ({ context, data }): Promise<{ item: SnippetRow }> => {
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const payload = {
      id: data.id,
      owner_id: context.userId,
      workspace_id: workspaceId,
      name: data.name,
      shortcut: data.shortcut,
      body_html: data.body_html ?? "",
      body_text: data.body_text ?? "",
      folder: data.folder ?? null,
      visibility: data.visibility,
    };
    const { data: row, error } = await context.supabase
      .from("snippets")
      .upsert(payload)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { item: row as SnippetRow };
  });

export const deleteSnippet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("snippets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const incrementSnippetUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.rpc("increment_snippet_usage", { _id: data.id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
