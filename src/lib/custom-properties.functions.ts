// Server functions para Custom Properties (definições).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const CUSTOM_ENTITIES = ["leads", "contacts", "companies", "deals"] as const;
export type CustomEntity = (typeof CUSTOM_ENTITIES)[number];

export const CUSTOM_TYPES = [
  "text", "textarea", "number", "date", "boolean",
  "select", "multiselect", "url", "email", "tel",
] as const;
export type CustomType = (typeof CUSTOM_TYPES)[number];

export const CUSTOM_TYPE_LABELS: Record<CustomType, string> = {
  text: "Texto curto",
  textarea: "Texto longo",
  number: "Número",
  date: "Data",
  boolean: "Sim/Não",
  select: "Seleção (única)",
  multiselect: "Seleção (múltipla)",
  url: "URL",
  email: "Email",
  tel: "Telefone",
};

export const CUSTOM_ENTITY_LABELS: Record<CustomEntity, string> = {
  leads: "Leads",
  contacts: "Contatos",
  companies: "Empresas",
  deals: "Negócios",
};

const upsertSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  entity: z.enum(CUSTOM_ENTITIES),
  key: z.string().min(1).max(64).regex(/^[a-z][a-z0-9_]*$/i, "Use apenas letras, números e _"),
  label: z.string().min(1).max(120),
  type: z.enum(CUSTOM_TYPES),
  options: z.array(z.string().min(1).max(80)).max(50).default([]),
  position: z.number().int().min(0).default(0),
  required: z.boolean().default(false),
  enabled: z.boolean().default(true),
  ai_prompt: z.string().max(4000).nullable().optional(),
});

export const listCustomProperties = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ entity: z.enum(CUSTOM_ENTITIES).nullable().optional() }).parse(i ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase.from("custom_properties")
      .select("id, entity, key, label, type, options, position, required, enabled, ai_prompt, created_at, updated_at")
      .eq("owner_id", userId)
      .order("entity", { ascending: true })
      .order("position", { ascending: true });
    if (data.entity) q = q.eq("entity", data.entity);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertCustomProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => upsertSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      owner_id: userId,
      entity: data.entity,
      key: data.key,
      label: data.label,
      type: data.type,
      options: data.options,
      position: data.position,
      required: data.required,
      enabled: data.enabled,
      ai_prompt: data.ai_prompt ?? null,
    };
    if (data.id) {
      const { error } = await supabase.from("custom_properties").update(payload as never).eq("id", data.id).eq("owner_id", userId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    } else {
      const { data: row, error } = await supabase.from("custom_properties").insert(payload as never).select("id").single();
      if (error) throw new Error(error.message);
      return { id: (row as { id: string }).id };
    }
  });

export const deleteCustomProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("custom_properties").delete().eq("id", data.id).eq("owner_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Atualiza um campo dentro do jsonb `custom_fields` da entidade. */
export const setCustomFieldValue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    entity: z.enum(CUSTOM_ENTITIES),
    entity_id: z.string().uuid(),
    key: z.string().min(1).max(64),
    value: z.unknown(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // ler atual e mesclar
    const { data: row, error: selErr } = await supabase
      .from(data.entity)
      .select("custom_fields")
      .eq("id", data.entity_id)
      .eq("owner_id", userId)
      .single();
    if (selErr) throw new Error(selErr.message);
    const current = ((row as { custom_fields?: Record<string, unknown> } | null)?.custom_fields ?? {}) as Record<string, unknown>;
    const next = { ...current };
    if (data.value === null || data.value === "" || data.value === undefined) {
      delete next[data.key];
    } else {
      next[data.key] = data.value;
    }
    const { error } = await supabase
      .from(data.entity)
      .update({ custom_fields: next } as never)
      .eq("id", data.entity_id)
      .eq("owner_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
