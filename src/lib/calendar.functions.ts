import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildCalendarAuthUrl,
  callbackRedirectUri,
  signState,
} from "@/lib/email-oauth.server";

export const startCalendarOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      provider: z.enum(["google", "microsoft"]).default("google"),
      return_to: z.string().optional(),
      origin: z.string().url(),
    }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    if (data.provider !== "google") {
      throw new Error("Microsoft Calendar ainda não disponível — em breve.");
    }
    const redirectUri = callbackRedirectUri(data.origin);
    const state = signState({ user_id: context.userId, return_to: data.return_to, mode: "calendar" });
    const url = buildCalendarAuthUrl({ redirectUri, state });
    return { url };
  });

export const listCalendarAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("calendar_accounts")
      .select("id, provider, email, primary_calendar_id, sync_enabled, last_synced_at, last_status, last_error, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });

export const disconnectCalendarAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("calendar_accounts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setCalendarSyncEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid(), enabled: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("calendar_accounts").update({ sync_enabled: data.enabled }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const syncCalendarNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    // Verify ownership
    const { data: row, error } = await context.supabase
      .from("calendar_accounts").select("id").eq("id", data.id).maybeSingle();
    if (error || !row) throw new Error("Calendário não encontrado");
    const { syncCalendarAccount } = await import("./calendar/engine.server");
    return syncCalendarAccount(data.id);
  });

export const listCalendarEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    limit: z.number().int().min(1).max(500).optional(),
  }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("calendar_events")
      .select("id, calendar_account_id, title, description, location, start_at, end_at, all_day, attendees, html_link, status")
      .order("start_at", { ascending: true })
      .limit(data.limit ?? 200);
    if (data.from) q = q.gte("start_at", data.from);
    if (data.to) q = q.lte("start_at", data.to);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });
