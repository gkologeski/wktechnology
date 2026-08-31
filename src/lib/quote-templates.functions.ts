import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import { blocksToHtml, isTemplateDocument } from "@/lib/quote-template-blocks";
import { deleteByIdGuarded } from "@/lib/db/delete-guarded";

async function activeWorkspace(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("active_workspace_id")
    .eq("id", userId)
    .maybeSingle();
  const ws = (data as { active_workspace_id?: string | null } | null)?.active_workspace_id;
  if (!ws) {
    const { data: m } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    const fallback = (m as { workspace_id?: string } | null)?.workspace_id;
    if (!fallback) throw new Error("Workspace ativo não encontrado");
    return fallback;
  }
  return ws;
}

const BlocksSchema = z
  .object({
    version: z.literal(1),
    theme: z.record(z.string(), z.unknown()),
    blocks: z.array(
      z.object({ id: z.string(), type: z.string(), props: z.record(z.string(), z.unknown()) }),
    ),
  })
  .passthrough();

const TemplateInput = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  html: z.string().max(200_000).optional(),
  blocks: BlocksSchema.nullable().optional(),
});

function compile(input: { html?: string; blocks?: unknown }): { html: string; blocks: any } {
  if (input.blocks && isTemplateDocument(input.blocks)) {
    return { html: blocksToHtml(input.blocks), blocks: input.blocks as any };
  }
  return { html: input.html ?? "", blocks: null };
}

export const listQuoteTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("quote_templates")
      .select("id, name, description, html, blocks, is_default, is_system, updated_at")
      .order("is_default", { ascending: false })
      .order("name", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });

export const getQuoteTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("quote_templates")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Error("Modelo não encontrado");
    return row;
  });

export const createQuoteTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => TemplateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspace_id = await activeWorkspace(supabase, userId);
    const compiled = compile({ html: data.html, blocks: data.blocks ?? undefined });
    const { data: row, error } = await supabase
      .from("quote_templates")
      .insert({
        owner_id: userId,
        workspace_id,
        name: data.name,
        description: data.description ?? null,
        html: compiled.html,
        blocks: compiled.blocks,
        is_default: false,
        is_system: false,
      })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const updateQuoteTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        patch: z.object({
          name: z.string().trim().min(1).max(120).optional(),
          description: z.string().trim().max(500).nullable().optional(),
          html: z.string().max(200_000).optional(),
          blocks: BlocksSchema.nullable().optional(),
        }),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: current, error: gErr } = await supabase
      .from("quote_templates")
      .select("is_system, html, blocks")
      .eq("id", data.id)
      .maybeSingle();
    if (gErr) throw gErr;
    if (!current) throw new Error("Modelo não encontrado");

    const patch: { html?: string; blocks?: any; description?: string | null; name?: string } = {};
    if (data.patch.blocks !== undefined) {
      const compiled = compile({ html: data.patch.html, blocks: data.patch.blocks ?? undefined });
      patch.blocks = compiled.blocks;
      patch.html = compiled.html;
    } else if (data.patch.html !== undefined) {
      patch.html = data.patch.html;
      patch.blocks = null; // editar HTML cru desativa o modo visual
    }
    if (data.patch.description !== undefined) patch.description = data.patch.description;
    if (data.patch.name !== undefined) {
      if (current.is_system) {
        throw new Error(
          "Modelos do sistema não podem ter o nome alterado. Duplique-o para personalizar.",
        );
      }
      patch.name = data.patch.name;
    }

    const { error } = await supabase.from("quote_templates").update(patch).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteQuoteTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: current, error: gErr } = await supabase
      .from("quote_templates")
      .select("is_system")
      .eq("id", data.id)
      .maybeSingle();
    if (gErr) throw gErr;
    if (!current) throw new Error("Modelo não encontrado");
    if (current.is_system) throw new Error("Modelos do sistema não podem ser excluídos.");

    await deleteByIdGuarded(supabase, "quote_templates", data.id);
    return { ok: true };
  });

export const setDefaultQuoteTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Limpa o default atual e marca o novo, na mesma ordem para respeitar o índice único parcial.
    const { error: clearErr } = await supabase
      .from("quote_templates")
      .update({ is_default: false })
      .eq("is_default", true);
    if (clearErr) throw clearErr;
    const { error } = await supabase
      .from("quote_templates")
      .update({ is_default: true })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const duplicateQuoteTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspace_id = await activeWorkspace(supabase, userId);
    const { data: src, error: gErr } = await supabase
      .from("quote_templates")
      .select("name, description, html")
      .eq("id", data.id)
      .maybeSingle();
    if (gErr) throw gErr;
    if (!src) throw new Error("Modelo não encontrado");

    const { data: row, error } = await supabase
      .from("quote_templates")
      .insert({
        owner_id: userId,
        workspace_id,
        name: `${src.name} (cópia)`,
        description: src.description,
        html: src.html,
        is_default: false,
        is_system: false,
      })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });
