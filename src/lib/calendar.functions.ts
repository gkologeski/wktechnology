import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildCalendarAuthUrl, callbackRedirectUri, signState } from "@/lib/email-oauth.server";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

export type CalendarTestStep = {
  name: string;
  status: "ok" | "error" | "skipped";
  detail?: string;
};

function describeGoogleCalendarError(status: number, text: string) {
  let message = text;
  try {
    const parsed = JSON.parse(text) as {
      error?: { message?: string; status?: string; errors?: Array<{ reason?: string }> };
    };
    message = parsed.error?.message || text;
    const reason = parsed.error?.errors?.[0]?.reason || parsed.error?.status;
    const disabledMatch = message.match(/project\s+(\d+)/i);
    if (
      status === 403 &&
      (reason === "accessNotConfigured" ||
        /calendar api has not been used|it is disabled/i.test(message))
    ) {
      return `HTTP 403: A Google Calendar API está desativada no projeto Google Cloud${disabledMatch ? ` ${disabledMatch[1]}` : ""} usado pelas credenciais OAuth. Ative a Google Calendar API nesse mesmo projeto e aguarde alguns minutos antes de testar novamente. Detalhe do Google: ${message}`;
    }
  } catch {
    // Keep the original response text when Google does not return JSON.
  }
  return `HTTP ${status}: ${message.slice(0, 400)}`;
}

export const testCalendarConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(
    async ({
      data,
      context,
    }): Promise<{
      ok: boolean;
      steps: CalendarTestStep[];
      calendar_count?: number;
      primary_email?: string;
    }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const steps: CalendarTestStep[] = [];
      const fail = (name: string, detail: string) => {
        steps.push({ name, status: "error", detail });
        return { ok: false, steps };
      };

      const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        return fail(
          "Credenciais OAuth do Google",
          "Variáveis GOOGLE_OAUTH_CLIENT_ID/SECRET ausentes no servidor.",
        );
      }
      steps.push({
        name: "Credenciais OAuth do Google",
        status: "ok",
        detail: "Client ID/Secret configurados.",
      });

      const { data: row, error: ownErr } = await context.supabase
        .from("calendar_accounts")
        .select("id, email")
        .eq("id", data.id)
        .maybeSingle();
      if (ownErr || !row)
        return fail(
          "Conta vinculada ao usuário",
          ownErr?.message || "Conta não encontrada ou sem permissão.",
        );
      steps.push({ name: "Conta vinculada ao usuário", status: "ok", detail: row.email });

      const { data: full, error: fullErr } = await supabaseAdmin
        .from("calendar_accounts")
        .select("id, email, access_token, refresh_token, expires_at, primary_calendar_id")
        .eq("id", data.id)
        .maybeSingle();
      if (fullErr || !full)
        return fail("Carregar tokens", fullErr?.message || "Tokens não encontrados.");
      if (!full.refresh_token)
        return fail(
          "Refresh token presente",
          "Conta sem refresh_token. Desconecte e reconecte concedendo acesso offline.",
        );
      steps.push({ name: "Refresh token presente", status: "ok" });

      let accessToken = full.access_token as string | null;
      try {
        const res = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: full.refresh_token as string,
            grant_type: "refresh_token",
          }).toString(),
        });
        const text = await res.text();
        if (!res.ok) {
          await supabaseAdmin
            .from("calendar_accounts")
            .update({
              last_status: "error",
              last_error: `refresh failed: ${res.status} ${text}`.slice(0, 500),
            })
            .eq("id", data.id);
          return fail("Renovar access token", `HTTP ${res.status}: ${text.slice(0, 400)}`);
        }
        const j = JSON.parse(text) as { access_token: string; expires_in: number };
        accessToken = j.access_token;
        const expiresAt = new Date(Date.now() + (j.expires_in - 60) * 1000).toISOString();
        await supabaseAdmin
          .from("calendar_accounts")
          .update({
            access_token: j.access_token,
            expires_at: expiresAt,
            last_status: "connected",
            last_error: null,
          })
          .eq("id", data.id);
        steps.push({
          name: "Renovar access token",
          status: "ok",
          detail: `Expira em ${j.expires_in}s`,
        });
      } catch (e) {
        return fail("Renovar access token", e instanceof Error ? e.message : String(e));
      }

      let calendarCount = 0;
      try {
        const res = await fetch(
          "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=50",
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );
        const text = await res.text();
        if (!res.ok)
          return fail(
            "Listar calendários (API Google)",
            describeGoogleCalendarError(res.status, text),
          );
        const j = JSON.parse(text) as {
          items?: Array<{ id: string; summary: string; primary?: boolean }>;
        };
        const items = j.items ?? [];
        calendarCount = items.length;
        const primary = items.find((i) => i.primary);
        steps.push({
          name: "Listar calendários (API Google)",
          status: "ok",
          detail: `${items.length} calendário(s). Principal: ${primary?.summary ?? "n/a"}`,
        });

        const calId = encodeURIComponent(full.primary_calendar_id || primary?.id || "primary");
        const ev = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${calId}/events?maxResults=1`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );
        if (!ev.ok) {
          const t = await ev.text();
          return fail(
            "Ler eventos do calendário principal",
            describeGoogleCalendarError(ev.status, t),
          );
        }
        steps.push({ name: "Ler eventos do calendário principal", status: "ok" });
      } catch (e) {
        return fail("Listar calendários (API Google)", e instanceof Error ? e.message : String(e));
      }

      return { ok: true, steps, calendar_count: calendarCount, primary_email: full.email };
    },
  );

export const startCalendarOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        provider: z.enum(["google", "microsoft"]).default("google"),
        return_to: z.string().optional(),
        origin: z.string().url(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    if (data.provider !== "google") {
      throw new Error("Microsoft Calendar ainda não disponível — em breve.");
    }
    const redirectUri = callbackRedirectUri(data.origin);
    const state = signState({
      user_id: context.userId,
      return_to: data.return_to,
      return_origin: data.origin,
      mode: "calendar",
    });
    const url = buildCalendarAuthUrl({ redirectUri, state });
    return { url };
  });

export const listCalendarAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ws = await resolveActiveWorkspace(context.userId);
    const { data, error } = await supabaseAdmin
      .from("calendar_accounts")
      .select(
        "id, provider, email, primary_calendar_id, sync_enabled, auto_create_meet_link, last_synced_at, last_status, last_error, created_at",
      )
      .eq("workspace_id", ws)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });

export const setCalendarMeetEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid(), enabled: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ws = await resolveActiveWorkspace(context.userId);
    const { error } = await supabaseAdmin
      .from("calendar_accounts")
      .update({ auto_create_meet_link: data.enabled })
      .eq("id", data.id)
      .eq("workspace_id", ws);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const disconnectCalendarAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ws = await resolveActiveWorkspace(context.userId);
    // Preserva o histórico de reuniões (recording_url, transcript, summary_text,
    // vínculos com activities/bookings) desassociando os eventos da conta antes
    // de removê-la. A FK também é ON DELETE SET NULL, mas mantemos explícito
    // para deixar clara a intenção e evitar regressões futuras.
    const { error: detachError } = await supabaseAdmin
      .from("calendar_events")
      .update({ calendar_account_id: null })
      .eq("calendar_account_id", data.id)
      .eq("workspace_id", ws);
    if (detachError) throw new Error(detachError.message);
    const { error } = await supabaseAdmin
      .from("calendar_accounts")
      .delete()
      .eq("id", data.id)
      .eq("workspace_id", ws);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setCalendarSyncEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid(), enabled: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ws = await resolveActiveWorkspace(context.userId);
    const { error } = await supabaseAdmin
      .from("calendar_accounts")
      .update({ sync_enabled: data.enabled })
      .eq("id", data.id)
      .eq("workspace_id", ws);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const syncCalendarNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ws = await resolveActiveWorkspace(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("calendar_accounts")
      .select("id")
      .eq("id", data.id)
      .eq("workspace_id", ws)
      .maybeSingle();
    if (error || !row) throw new Error("Calendário não encontrado");
    const { syncCalendarAccount } = await import("./calendar/engine.server");
    return syncCalendarAccount(data.id);
  });

export const syncAccountRecordings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ account_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ws = await resolveActiveWorkspace(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("calendar_accounts")
      .select(
        "id, owner_id, provider, email, primary_calendar_id, access_token, refresh_token, expires_at, sync_token, sync_page_token, sync_enabled, last_synced_at",
      )
      .eq("id", data.account_id)
      .eq("workspace_id", ws)
      .maybeSingle();
    if (error || !row) throw new Error("Calendário não encontrado");
    const { syncPastRecordings } = await import("./calendar/engine.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return syncPastRecordings(row as any);
  });

export const pushActivityToCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        account_id: z.string().uuid(),
        activity_id: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ws = await resolveActiveWorkspace(context.userId);
    const { data: acct, error: aErr } = await supabaseAdmin
      .from("calendar_accounts")
      .select("id")
      .eq("id", data.account_id)
      .eq("workspace_id", ws)
      .maybeSingle();
    if (aErr || !acct) throw new Error("Calendário não encontrado");
    const { data: act, error: actErr } = await context.supabase
      .from("activities")
      .select("id")
      .eq("id", data.activity_id)
      .maybeSingle();
    if (actErr || !act) throw new Error("Atividade não encontrada");
    const { pushSingleActivity } = await import("./calendar/engine.server");
    return pushSingleActivity(data.account_id, data.activity_id);
  });

export const listCalendarEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
        limit: z.number().int().min(1).max(500).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("calendar_events")
      .select(
        "id, calendar_account_id, title, description, location, start_at, end_at, all_day, attendees, html_link, status",
      )
      .order("start_at", { ascending: true })
      .limit(data.limit ?? 200);
    if (data.from) q = q.gte("start_at", data.from);
    if (data.to) q = q.lte("start_at", data.to);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });
