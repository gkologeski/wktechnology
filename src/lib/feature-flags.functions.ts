/**
 * Feature Flags — Fase 0 (Plataforma).
 *
 * Permite ligar/desligar funcionalidades por workspace e fazer rollout
 * gradual (porcentagem) sem deploy. Usado pelas Ondas 5–8 para entregar
 * funcionalidades atrás de flags antes da liberação geral.
 *
 * Convenção de chaves (use prefixos): `ats.<area>.<feature>`
 *   ex.: ats.sourcing.multi_posting, ats.scheduling.round_robin,
 *        ats.compliance.lgpd_dsar, ats.ai.copilot
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FLAG_KEY = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9._-]+$/, "Use apenas minúsculas, números, pontos, hífen e underscore.");

export const listFeatureFlags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("feature_flags")
      .select("id, key, enabled, rollout_percentage, description, metadata, updated_at")
      .order("key", { ascending: true });
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });

export const getFeatureFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ key: FLAG_KEY }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("feature_flags")
      .select("key, enabled, rollout_percentage, metadata")
      .eq("key", data.key)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { flag: row };
  });

export const upsertFeatureFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        key: FLAG_KEY,
        enabled: z.boolean(),
        rollout_percentage: z.number().int().min(0).max(100).default(0),
        description: z.string().max(280).nullish(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("feature_flags")
      .upsert(
        {
          owner_id: context.userId,
          key: data.key,
          enabled: data.enabled,
          rollout_percentage: data.rollout_percentage,
          description: data.description ?? null,
          metadata: (data.metadata ?? {}) as never,
        },
        { onConflict: "owner_id,key" },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { flag: row };
  });

export const deleteFeatureFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ key: FLAG_KEY }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("feature_flags").delete().eq("key", data.key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
