// Server functions para Custom Properties (definições).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

export const CUSTOM_ENTITIES = ["leads", "contacts", "companies", "deals", "activities"] as const;
export type CustomEntity = (typeof CUSTOM_ENTITIES)[number];

export const CUSTOM_TYPES = [
  "text",
  "textarea",
  "number",
  "date",
  "boolean",
  "select",
  "multiselect",
  "url",
  "email",
  "tel",
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
  activities: "Tarefas",
};

const upsertSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  entity: z.enum(CUSTOM_ENTITIES),
  key: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z][a-z0-9_]*$/i, "Use apenas letras, números e _"),
  label: z.string().min(1).max(120),
  type: z.enum(CUSTOM_TYPES),
  options: z.array(z.string().min(1).max(80)).max(50).default([]),
  position: z.number().int().min(0).default(0),
  required: z.boolean().default(false),
  enabled: z.boolean().default(true),
  ai_prompt: z.string().max(4000).nullable().optional(),
  group_name: z.string().max(80).nullable().optional(),
});

export const listCustomProperties = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ entity: z.enum(CUSTOM_ENTITIES).nullable().optional() }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    let q = supabase
      .from("custom_properties")
      .select(
        "id, entity, key, label, type, options, position, required, enabled, ai_prompt, group_name, created_at, updated_at",
      )
      .eq("workspace_id", workspaceId)
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
    const workspaceId = await resolveActiveWorkspace(userId);
    const payload = {
      owner_id: userId,
      workspace_id: workspaceId,
      entity: data.entity,
      key: data.key,
      label: data.label,
      type: data.type,
      options: data.options,
      position: data.position,
      required: data.required,
      enabled: data.enabled,
      ai_prompt: data.ai_prompt ?? null,
      group_name: data.group_name ?? null,
    };
    if (data.id) {
      const { error } = await supabase
        .from("custom_properties")
        .update(payload as never)
        .eq("id", data.id)
        .eq("workspace_id", workspaceId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    } else {
      const { data: row, error } = await supabase
        .from("custom_properties")
        .insert(payload as never)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { id: (row as { id: string }).id };
    }
  });

export const deleteCustomProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { error } = await supabase
      .from("custom_properties")
      .delete()
      .eq("id", data.id)
      .eq("workspace_id", workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Atualiza um campo dentro do jsonb `custom_fields` da entidade. */
export const setCustomFieldValue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        entity: z.enum(CUSTOM_ENTITIES),
        entity_id: z.string().uuid(),
        key: z.string().min(1).max(64),
        value: z.unknown(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    // ler atual e mesclar
    const { data: row, error: selErr } = await supabase
      .from(data.entity)
      .select("custom_fields")
      .eq("id", data.entity_id)
      .eq("workspace_id", workspaceId)
      .single();
    if (selErr) throw new Error(selErr.message);
    const current = ((row as { custom_fields?: Record<string, unknown> } | null)?.custom_fields ??
      {}) as Record<string, unknown>;
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
      .eq("workspace_id", workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export const computeAiProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        property_id: z.string().uuid(),
        entity_id: z.string().uuid(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data: prop, error: pErr } = await sb
      .from("custom_properties")
      .select("entity, key, type, options, ai_prompt, label")
      .eq("id", data.property_id)
      .eq("workspace_id", workspaceId)
      .single();
    if (pErr || !prop) throw new Error("Propriedade não encontrada");
    if (!prop.ai_prompt) throw new Error("Esta propriedade não tem prompt de IA");
    const { data: row, error: rErr } = await sb
      .from(prop.entity)
      .select("*")
      .eq("id", data.entity_id)
      .eq("workspace_id", workspaceId)
      .single();
    if (rErr || !row) throw new Error("Registro não encontrado");
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");
    const ctxJson = JSON.stringify(row, null, 2).slice(0, 8000);
    const typeHint =
      prop.type === "boolean"
        ? "Retorne APENAS 'true' ou 'false'."
        : prop.type === "number"
          ? "Retorne APENAS um número decimal."
          : prop.type === "select"
            ? `Retorne APENAS um destes valores: ${(prop.options as string[]).join(", ")}`
            : prop.type === "multiselect"
              ? `Retorne JSON array com valores entre: ${(prop.options as string[]).join(", ")}`
              : prop.type === "date"
                ? "Retorne APENAS uma data no formato YYYY-MM-DD."
                : "Retorne APENAS o texto final, sem aspas nem explicação.";
    const res = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você calcula o valor da propriedade "${prop.label}" (${prop.type}). ${typeHint}`,
          },
          {
            role: "user",
            content: `Prompt: ${prop.ai_prompt}\n\nDados do registro (JSON):\n${ctxJson}`,
          },
        ],
        temperature: 0.2,
      }),
    });
    if (!res.ok) throw new Error(`AI Gateway ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = (j.choices?.[0]?.message?.content ?? "").trim();
    let value: string | number | boolean | string[] | null = raw;
    if (prop.type === "boolean") value = /^t|true|sim|yes|1$/i.test(raw);
    else if (prop.type === "number") {
      const n = parseFloat(raw.replace(",", "."));
      value = Number.isFinite(n) ? n : null;
    } else if (prop.type === "multiselect") {
      try {
        const p = JSON.parse(raw);
        value = Array.isArray(p) ? p.map(String) : [];
      } catch {
        value = [];
      }
    }
    const cur = (row.custom_fields ?? {}) as Record<string, unknown>;
    const next = { ...cur, [prop.key]: value };
    const { error } = await sb
      .from(prop.entity)
      .update({ custom_fields: next })
      .eq("id", data.entity_id)
      .eq("workspace_id", workspaceId);
    if (error) throw new Error(error.message);
    return { value: value as string | number | boolean | string[] | null };
  });
