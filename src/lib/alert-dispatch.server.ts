// Dispatcher de alertas da plataforma para canais reais (Slack/e-mail).
// Slack: POST direto no incoming webhook informado em `channels[].value`.
// E-mail: cria uma notificação in-app para cada platform_admin (fallback seguro
// sem depender do endpoint transacional que exige token de usuário).
import type { SupabaseClient } from "@supabase/supabase-js";

type Channel = { type: "slack" | "email"; value: string };

export type DispatchInput = {
  ruleId: string;
  ruleName: string;
  severity: string;
  message: string;
  context: unknown;
  channels: Channel[];
};

const SEVERITY_EMOJI: Record<string, string> = {
  info: "ℹ️",
  warning: "⚠️",
  critical: "🚨",
  error: "🔥",
};

export async function dispatchAlert(
  supabase: SupabaseClient,
  input: DispatchInput,
): Promise<{ slack: number; email: number; errors: string[] }> {
  const errors: string[] = [];
  let slack = 0;
  let email = 0;

  const emoji = SEVERITY_EMOJI[input.severity] ?? "🔔";
  const text = `${emoji} *[${input.severity.toUpperCase()}]* ${input.ruleName}\n${input.message}`;

  for (const ch of input.channels ?? []) {
    try {
      if (ch.type === "slack") {
        if (!ch.value?.startsWith("https://hooks.slack.com/")) {
          errors.push(`slack: URL inválida (${ch.value?.slice(0, 40)}…)`);
          continue;
        }
        const res = await fetch(ch.value, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, attachments: [{ text: JSON.stringify(input.context) }] }),
        });
        if (!res.ok) {
          errors.push(`slack: HTTP ${res.status}`);
        } else {
          slack++;
        }
      } else if (ch.type === "email") {
        // Fallback: cria notificação in-app para os platform_admins.
        const { data: admins } = await supabase.from("platform_admins").select("user_id");
        const rows = (admins ?? []).map((a: { user_id: string }) => ({
          owner_id: a.user_id,
          user_id: a.user_id,
          type: "platform_alert",
          title: `${emoji} ${input.ruleName}`,
          body: input.message,
          link: "/admin/status",
          entity: "platform_alert",
        }));
        if (rows.length) {
          const { error } = await (supabase.from("notifications") as any).insert(rows);
          if (error) errors.push(`email: ${error.message}`);
          else email += rows.length;
        }
      }
    } catch (e) {
      errors.push(`${ch.type}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { slack, email, errors };
}
