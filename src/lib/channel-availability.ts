// Catálogo client-safe dos canais de envio da timeline e suas telas de configuração.
export type SendChannel = "whatsapp" | "email" | "call" | "meeting";

export type ChannelStatus = { ready: boolean; reason?: string };
export type ChannelAvailability = Record<SendChannel, ChannelStatus>;

export const CHANNEL_SETUP: Record<SendChannel, { label: string; to: string }> = {
  whatsapp: { label: "WhatsApp", to: "/settings/whatsapp" },
  email: { label: "E-mail", to: "/settings/email" },
  call: { label: "Telefonia", to: "/settings/voice-agent" },
  meeting: { label: "Agenda", to: "/settings/calendars" },
};

export const SEND_CHANNELS: SendChannel[] = ["whatsapp", "email", "call", "meeting"];

export function isSendChannel(value: string): value is SendChannel {
  return (SEND_CHANNELS as string[]).includes(value);
}

/** Canal bloqueado apenas com status confirmado; carregando/erro = liberado. */
export function isChannelBlocked(
  availability: ChannelAvailability | undefined,
  channel: SendChannel,
): boolean {
  return availability ? !availability[channel].ready : false;
}

export function twilioEnvReady(env: {
  accountSid?: string;
  apiKeySid?: string;
  apiKeySecret?: string;
  twimlAppSid?: string;
}): boolean {
  return (
    !!env.accountSid?.startsWith("AC") &&
    !!env.apiKeySid?.startsWith("SK") &&
    !!env.apiKeySecret &&
    !!env.twimlAppSid?.startsWith("AP")
  );
}
