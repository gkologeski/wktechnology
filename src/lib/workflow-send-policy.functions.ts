// Política de envio dos fluxos por empresa: horário, cotas comerciais,
// deduplicação, remetente de e-mail e agenda padrão.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const policySchema = z.object({
  whatsapp_daily_limit: z.number().int().min(0).max(100000).nullable(),
  email_daily_limit: z.number().int().min(0).max(100000).nullable(),
  dedupe_hours: z.number().int().min(0).max(720),
  timezone: z.string().min(3).max(64),
  window_start: z.number().int().min(0).max(23).nullable(),
  window_end: z.number().int().min(1).max(24).nullable(),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7),
  email_provider: z.enum(["gmail_owner", "gmail_account", "outlook"]),
  email_account_id: z.string().uuid().nullable(),
  default_booking_page_id: z.string().uuid().nullable(),
});

export type SendPolicyInput = z.infer<typeof policySchema>;

export const getWorkflowSendPolicy = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { resolveActiveWorkspace } = await import("@/lib/active-workspace.server");
    const ws = await resolveActiveWorkspace(context.userId);
    const sb = context.supabase;
    const [pol, accounts, pages, isAdmin] = await Promise.all([
      sb
        .from("workflow_send_policies")
        .select(
          "whatsapp_daily_limit, email_daily_limit, dedupe_hours, timezone, window_start, window_end, weekdays, email_provider, email_account_id, default_booking_page_id, updated_at",
        )
        .eq("workspace_id", ws)
        .maybeSingle(),
      sb
        .from("email_accounts")
        .select("id, email, status")
        .eq("workspace_id", ws)
        .eq("provider", "gmail")
        .order("email"),
      sb.from("booking_pages").select("id, title, active").eq("workspace_id", ws).order("title"),
      sb.rpc("is_active_workspace_admin", { _workspace: ws, _user: context.userId }),
    ]);
    if (pol.error) throw new Error(`Não foi possível ler a política: ${pol.error.message}`);
    const outlookReady = !!process.env["MICROSOFT_OUTLOOK_API_KEY"];
    return {
      policy: (pol.data as (SendPolicyInput & { updated_at: string }) | null) ?? null,
      accounts: ((accounts.data ?? []) as { id: string; email: string; status: string }[]).map(
        (a) => ({ id: a.id, email: a.email, connected: a.status === "connected" }),
      ),
      bookingPages: (pages.data ?? []) as { id: string; title: string; active: boolean }[],
      canEdit: isAdmin.data === true,
      outlookReady,
    };
  });

export const saveWorkflowSendPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => policySchema.parse(d))
  .handler(async ({ data, context }) => {
    const { assertActiveWorkspaceAdmin } =
      await import("@/lib/access-control/access-admin-guard.server");
    const ws = await assertActiveWorkspaceAdmin(context.supabase, context.userId);
    const sb = context.supabase;
    if ((data.window_start == null) !== (data.window_end == null))
      throw new Error("Informe início e fim do horário de envio, ou deixe ambos vazios.");
    if (
      data.window_start != null &&
      data.window_end != null &&
      data.window_end <= data.window_start
    )
      throw new Error("O fim do horário de envio precisa ser depois do início.");
    try {
      new Intl.DateTimeFormat("pt-BR", { timeZone: data.timezone });
    } catch {
      throw new Error("Fuso horário inválido.");
    }
    if (data.email_provider === "gmail_account") {
      if (!data.email_account_id) throw new Error("Escolha a caixa de e-mail da empresa.");
      const { data: acc } = await sb
        .from("email_accounts")
        .select("id, status")
        .eq("workspace_id", ws)
        .eq("id", data.email_account_id)
        .maybeSingle();
      if (!acc || acc.status !== "connected")
        throw new Error("A caixa escolhida precisa ser desta empresa e estar conectada.");
    }
    if (data.default_booking_page_id) {
      const { data: pg } = await sb
        .from("booking_pages")
        .select("id, active")
        .eq("workspace_id", ws)
        .eq("id", data.default_booking_page_id)
        .maybeSingle();
      if (!pg || !pg.active)
        throw new Error("A agenda padrão precisa ser desta empresa e estar ativa.");
    }
    const row = {
      ...data,
      email_account_id: data.email_provider === "gmail_account" ? data.email_account_id : null,
      workspace_id: ws,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    };
    const { error } = await sb
      .from("workflow_send_policies")
      .upsert(row as never, { onConflict: "workspace_id" });
    if (error) throw new Error(`Não foi possível salvar: ${error.message}`);
    return { ok: true };
  });
