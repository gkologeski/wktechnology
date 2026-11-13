// Agendamento durante a ligação (regras puras, sem rede).
// A assistente de voz chama duas funções: consultar_horarios e marcar_reuniao.
import type { Schedule } from "@/lib/prospecting/sdr/tools/scheduling";
import { DEFAULT_TIME_ZONE } from "@/lib/time-zone";

export const VOICE_TOOL_AVAILABILITY = "consultar_horarios";
export const VOICE_TOOL_BOOK = "marcar_reuniao";

/** Expediente comercial usado para sugerir horários na ligação (seg–sex). */
const BUSINESS_DAY = [
  { start: "09:00", end: "12:00" },
  { start: "13:30", end: "18:00" },
];

export function voiceSchedule(durationMinutes: number, horizonDays: number): Schedule {
  return {
    timezone: DEFAULT_TIME_ZONE,
    duration_minutes: durationMinutes,
    buffer_before_minutes: 0,
    buffer_after_minutes: 0,
    // Antecedência mínima para o especialista se preparar.
    min_notice_hours: 2,
    horizon_days: horizonDays,
    working_hours: {
      mon: BUSINESS_DAY,
      tue: BUSINESS_DAY,
      wed: BUSINESS_DAY,
      thu: BUSINESS_DAY,
      fri: BUSINESS_DAY,
    },
    holidays: [],
  };
}

export type MeetingMode = "auto" | "member" | "round_robin" | "unassigned";

/**
 * Escolhe quem recebe a reunião. `hosts` = membros ativos com agenda conectada.
 * Rodízio usa o cursor da campanha e pula quem não tem agenda.
 */
export function chooseHost(opts: {
  mode: MeetingMode;
  memberIds: string[];
  cursor: number;
  recordOwnerId: string | null;
  hosts: Set<string>;
}): { hostId: string | null; nextCursor: number } {
  const { mode, memberIds, cursor, hosts } = opts;
  if (mode === "auto") {
    const id = opts.recordOwnerId && hosts.has(opts.recordOwnerId) ? opts.recordOwnerId : null;
    return { hostId: id, nextCursor: cursor };
  }
  if (mode === "member") {
    const id = memberIds[0] && hosts.has(memberIds[0]) ? memberIds[0] : null;
    return { hostId: id, nextCursor: cursor };
  }
  if (mode === "round_robin" && memberIds.length) {
    for (let i = 0; i < memberIds.length; i++) {
      const idx = (cursor + i) % memberIds.length;
      if (hosts.has(memberIds[idx]!)) return { hostId: memberIds[idx]!, nextCursor: idx + 1 };
    }
  }
  return { hostId: null, nextCursor: cursor };
}

export type VoiceToolCall = { id: string; name: string; args: Record<string, unknown> };

/** Lê as chamadas de função do formato da Vapi (tool-calls). */
export function parseVoiceToolCalls(msg: Record<string, unknown>): VoiceToolCall[] {
  const list = (msg.toolCallList ?? msg.toolCalls ?? []) as unknown[];
  const out: VoiceToolCall[] = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const r = raw as { id?: string; function?: { name?: string; arguments?: unknown } };
    if (!r?.id || !r.function?.name) continue;
    let args: Record<string, unknown> = {};
    const a = r.function.arguments;
    if (typeof a === "string") {
      try {
        args = JSON.parse(a) as Record<string, unknown>;
      } catch {
        args = {};
      }
    } else if (a && typeof a === "object") args = a as Record<string, unknown>;
    out.push({ id: r.id, name: r.function.name, args });
  }
  return out;
}

export type Offer = { option: number; start: number; end: number };

/** Só marca horário que foi oferecido nesta ligação (opção 1, 2 ou 3). */
export function matchOffer(offers: Offer[], option: unknown): Offer | null {
  const n = typeof option === "string" ? Number(option) : option;
  if (typeof n !== "number" || !Number.isInteger(n)) return null;
  return offers.find((o) => o.option === n) ?? null;
}

/** Variáveis do modelo de WhatsApp na ordem {{1}} nome, {{2}} data/hora, {{3}} link. */
export function meetingTemplateVariables(
  count: number,
  v: { firstName: string; when: string; link: string },
): string[] {
  return [v.firstName, v.when, v.link].slice(0, Math.max(0, count));
}

/** Conta {{n}} no corpo do modelo aprovado. */
export function countBodyParams(components: unknown[]): number {
  const body = (components ?? []).find(
    (c) => String((c as { type?: string })?.type ?? "").toUpperCase() === "BODY",
  ) as { text?: string } | undefined;
  const found = new Set((body?.text ?? "").match(/\{\{\d+\}\}/g) ?? []);
  return found.size;
}

export const VOICE_BOOKING_PROMPT = `

## Agendamento durante a ligação
Quando o cliente aceitar conversar com o especialista, chame a função ${VOICE_TOOL_AVAILABILITY} e leia as opções devolvidas, uma por vez, de forma natural. Nunca invente horários.
Quando o cliente escolher, repita a data e a hora em voz alta, peça confirmação e só então chame ${VOICE_TOOL_BOOK} com o número da opção. Marque no máximo uma reunião.
Diga que o link da reunião vai pelo WhatsApp neste mesmo número. Não peça nem soletre e-mail.
Se nenhuma opção servir, chame ${VOICE_TOOL_AVAILABILITY} de novo para outras opções. Se a função disser que a agenda não está disponível, diga que vai mandar os horários pelo WhatsApp.`;

export function voiceBookingTools(serverUrl: string, secret: string | undefined) {
  const server = secret ? { url: serverUrl, secret } : { url: serverUrl };
  return [
    {
      type: "function",
      function: {
        name: VOICE_TOOL_AVAILABILITY,
        description: "Consulta a agenda real do especialista e devolve até 3 horários livres.",
        parameters: { type: "object", properties: {} },
      },
      server,
    },
    {
      type: "function",
      function: {
        name: VOICE_TOOL_BOOK,
        description: "Marca a reunião no horário escolhido pelo cliente (número da opção).",
        parameters: {
          type: "object",
          properties: { opcao: { type: "integer", description: "1, 2 ou 3" } },
          required: ["opcao"],
        },
      },
      server,
    },
  ];
}
