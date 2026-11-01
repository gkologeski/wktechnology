import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSalesPermission } from "@/lib/access-control/sales-permission.middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import {
  countTemplateVariables,
  REMINDER_OFFSET_VALUES,
  REMINDER_VARIABLE_KEYS,
  templateBodyText,
} from "./meeting-reminders";

export type MeetingReminderConfig = {
  enabled: boolean;
  sender_phone_number_id: string | null;
  rules: Array<{
    offset_minutes: number;
    enabled: boolean;
    template_name: string;
    template_language: string;
    variable_map: string[];
  }>;
  senders: Array<{ id: string; label: string }>;
  templates: Array<{ name: string; language: string; body: string; variables: number }>;
  templatesError: string | null;
  recent: Array<{
    id: string;
    activity_id: string;
    offset_minutes: number;
    meeting_at: string;
    status: string;
    error: string | null;
    created_at: string;
  }>;
};

export const getMeetingReminderConfig = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.meeting_settings", "view")])
  .handler(async ({ context }): Promise<MeetingReminderConfig> => {
    const ws = await resolveActiveWorkspace(context.userId);
    const sb = context.supabase;
    const [s, r, n, d] = await Promise.all([
      sb.from("meeting_reminder_settings").select("*").eq("workspace_id", ws).maybeSingle(),
      sb.from("meeting_reminder_rules").select("*").eq("workspace_id", ws),
      sb
        .from("wa_cloud_numbers")
        .select("phone_number_id, display_phone_number, verified_name")
        .eq("workspace_id", ws),
      sb
        .from("meeting_reminder_dispatches")
        .select("id, activity_id, offset_minutes, meeting_at, status, error, created_at")
        .eq("workspace_id", ws)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);
    const sender = (s.data?.sender_phone_number_id as string | null) ?? null;
    let templates: MeetingReminderConfig["templates"] = [];
    let templatesError: string | null = null;
    try {
      const { loadApprovedTemplates } = await import("./templates.server");
      const list = await loadApprovedTemplates(sb, ws, { phoneNumberId: sender });
      templates = list.map((t) => ({
        name: t.name,
        language: t.language,
        body: templateBodyText(t.components),
        variables: countTemplateVariables(t.components),
      }));
    } catch (e) {
      templatesError = e instanceof Error ? e.message : "Não foi possível carregar os modelos.";
    }
    return {
      enabled: Boolean(s.data?.enabled),
      sender_phone_number_id: sender,
      rules: (r.data ?? []).map((x) => ({
        offset_minutes: x.offset_minutes,
        enabled: x.enabled,
        template_name: x.template_name,
        template_language: x.template_language,
        variable_map: (Array.isArray(x.variable_map) ? x.variable_map : []) as string[],
      })),
      senders: (n.data ?? []).map((x) => ({
        id: String(x.phone_number_id),
        label: `${x.verified_name ?? "Meta"} · ${x.display_phone_number ?? ""}`,
      })),
      templates,
      templatesError,
      recent: (d.data ?? []) as MeetingReminderConfig["recent"],
    };
  });

const SaveSchema = z.object({
  enabled: z.boolean(),
  sender_phone_number_id: z.string().max(64).nullable(),
  rules: z
    .array(
      z.object({
        offset_minutes: z
          .number()
          .int()
          .refine((v) => REMINDER_OFFSET_VALUES.includes(v)),
        enabled: z.boolean(),
        template_name: z.string().min(1).max(200),
        template_language: z.string().min(2).max(20),
        variable_map: z
          .array(z.string().refine((k) => REMINDER_VARIABLE_KEYS.includes(k)))
          .max(10),
      }),
    )
    .max(4),
});

export const saveMeetingReminderConfig = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.meeting_settings", "update")])
  .inputValidator((i) => SaveSchema.parse(i))
  .handler(async ({ data, context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    const sb = context.supabase;
    const offs = data.rules.map((r) => r.offset_minutes);
    if (new Set(offs).size !== offs.length) throw new Error("Opção de lembrete repetida.");
    if (data.sender_phone_number_id) {
      const { data: num } = await sb
        .from("wa_cloud_numbers")
        .select("phone_number_id")
        .eq("workspace_id", ws)
        .eq("phone_number_id", data.sender_phone_number_id)
        .maybeSingle();
      if (!num) throw new Error("Número de envio não pertence a este workspace.");
    }
    const active = data.rules.filter((r) => r.enabled);
    if (data.enabled && !active.length) throw new Error("Ligue ao menos uma opção de lembrete.");
    if (active.length) {
      const { loadApprovedTemplates } = await import("./templates.server");
      const list = await loadApprovedTemplates(sb, ws, {
        phoneNumberId: data.sender_phone_number_id,
      });
      for (const r of active) {
        const t = list.find((x) => x.name === r.template_name && x.language === r.template_language);
        if (!t) throw new Error(`Modelo "${r.template_name}" não está aprovado na Meta.`);
        if (countTemplateVariables(t.components) !== r.variable_map.length)
          throw new Error(`Preencha todas as variáveis do modelo "${r.template_name}".`);
      }
    }
    const { error: e1 } = await sb.from("meeting_reminder_settings").upsert({
      workspace_id: ws,
      enabled: data.enabled,
      sender_phone_number_id: data.sender_phone_number_id,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    });
    if (e1) throw new Error(e1.message);
    const { error: e2 } = await sb
      .from("meeting_reminder_rules")
      .delete()
      .eq("workspace_id", ws)
      .not("offset_minutes", "in", `(${offs.length ? offs.join(",") : "0"})`);
    if (e2) throw new Error(e2.message);
    if (data.rules.length) {
      const { error: e3 } = await sb.from("meeting_reminder_rules").upsert(
        data.rules.map((r) => ({ ...r, workspace_id: ws, updated_at: new Date().toISOString() })),
        { onConflict: "workspace_id,offset_minutes" },
      );
      if (e3) throw new Error(e3.message);
    }
    return { ok: true };
  });

export const getMeetingReminderStatus = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.meetings", "view")])
  .inputValidator((i) => z.object({ activityId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { assertSalesRecord } = await import("@/lib/access-control/sales-core.server");
    await assertSalesRecord(context.supabase, "activities", data.activityId, "view");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ws = await resolveActiveWorkspace(context.userId);
    const [{ data: act }, { data: rules }, { data: sends }] = await Promise.all([
      supabaseAdmin
        .from("activities")
        .select("wa_reminders_disabled, due_date, type")
        .eq("id", data.activityId)
        .eq("workspace_id", ws)
        .maybeSingle(),
      supabaseAdmin
        .from("meeting_reminder_rules")
        .select("offset_minutes")
        .eq("workspace_id", ws)
        .eq("enabled", true),
      supabaseAdmin
        .from("meeting_reminder_dispatches")
        .select("offset_minutes, status, meeting_at, error")
        .eq("activity_id", data.activityId)
        .eq("workspace_id", ws),
    ]);
    const { data: st } = await supabaseAdmin
      .from("meeting_reminder_settings")
      .select("enabled")
      .eq("workspace_id", ws)
      .maybeSingle();
    return {
      isMeeting: act?.type === "meeting",
      workspaceEnabled: Boolean(st?.enabled),
      disabled: Boolean(act?.wa_reminders_disabled),
      dueDate: (act?.due_date as string | null) ?? null,
      offsets: (rules ?? []).map((r) => r.offset_minutes as number),
      dispatches: (sends ?? []).filter(
        (x) => !act?.due_date || new Date(x.meeting_at).getTime() === new Date(act.due_date).getTime(),
      ),
    };
  });

export const setMeetingRemindersDisabled = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.meetings", "update")])
  .inputValidator((i) =>
    z.object({ activityId: z.string().uuid(), disabled: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { assertSalesRecord } = await import("@/lib/access-control/sales-core.server");
    await assertSalesRecord(context.supabase, "activities", data.activityId, "update");
    const { error } = await context.supabase
      .from("activities")
      .update({ wa_reminders_disabled: data.disabled })
      .eq("id", data.activityId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
