import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TemplateInput = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  html: z.string().max(200_000),
});

export const listQuoteTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("quote_templates")
      .select("id, name, description, html, is_default, is_system, updated_at")
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
    const { data: row, error } = await supabase
      .from("quote_templates")
      .insert({
        owner_id: userId,
        name: data.name,
        description: data.description ?? null,
        html: data.html,
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
    z.object({
      id: z.string().uuid(),
      patch: z.object({
        name: z.string().trim().min(1).max(120).optional(),
        description: z.string().trim().max(500).nullable().optional(),
        html: z.string().max(200_000).optional(),
      }),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: current, error: gErr } = await supabase
      .from("quote_templates")
      .select("is_system")
      .eq("id", data.id)
      .maybeSingle();
    if (gErr) throw gErr;
    if (!current) throw new Error("Modelo não encontrado");

    const patch: Record<string, unknown> = {};
    if (data.patch.html !== undefined) patch.html = data.patch.html;
    if (data.patch.description !== undefined) patch.description = data.patch.description;
    if (data.patch.name !== undefined) {
      if (current.is_system) {
        throw new Error("Modelos do sistema não podem ter o nome alterado. Duplique-o para personalizar.");
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

    const { error } = await supabase.from("quote_templates").delete().eq("id", data.id);
    if (error) throw error;
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
