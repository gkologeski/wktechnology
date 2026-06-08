import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listAdsAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ads_accounts").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { accounts: data ?? [] };
  });

export const connectAdsAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    provider: z.enum(["meta", "google"]),
    external_account_id: z.string().min(1).max(120),
    display_name: z.string().min(1).max(200),
    access_token: z.string().max(4000).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("ads_accounts").insert(data).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const disconnectAdsAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("ads_accounts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAudiences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ads_audiences").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { audiences: data ?? [] };
  });

export const syncAudience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    account_id: z.string().uuid(),
    segment_id: z.string().uuid().optional(),
    name: z.string().min(1).max(200),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("ads_audiences").insert({
        ...data,
        status: "synced",
        last_synced_at: new Date().toISOString(),
      }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const listLeadForms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ads_lead_forms").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { forms: data ?? [] };
  });
