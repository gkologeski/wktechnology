// Detecta texto colado de exportação do WhatsApp e converte para HTML
// estilizado que reproduz o visual claro da conversa.

const LINE_RE =
  /^\[(\d{1,2}:\d{2})(?::\d{2})?,\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\]\s+([^:]+?):\s?([\s\S]*)$/;

export type WhatsAppMessage = {
  time: string;
  date: string;
  sender: string;
  text: string;
};

export type WhatsAppIdentity = {
  currentUserName?: string | null;
  currentUserPhone?: string | null;
  workspaceUserNames?: string[];
};

export function parseWhatsAppPaste(input: string): WhatsAppMessage[] | null {
  const raw = (input || "").replace(/\u202f|\u00a0/g, " ").trim();
  if (!raw) return null;
  const lines = raw.split(/\r?\n/);
  const out: WhatsAppMessage[] = [];
  for (const line of lines) {
    const l = line.trim();
    if (!l) continue;
    const m = l.match(LINE_RE);
    if (m) {
      out.push({ time: m[1], date: m[2], sender: m[3].trim(), text: m[4].trim() });
    } else if (out.length > 0) {
      out[out.length - 1].text += "\n" + l;
    } else {
      return null;
    }
  }
  return out.length >= 2 ? out : null;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isPhoneLike(s: string): boolean {
  return /^\+?\d[\d\s\-()]{5,}$/.test(s.trim());
}

function normalizedName(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedPhone(value: string | null | undefined): string {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length >= 8 ? digits.slice(-11) : "";
}

function phonesMatch(left: string, right: string): boolean {
  if (!left || !right) return false;
  const comparableLength = Math.min(left.length, right.length);
  if (comparableLength < 8) return false;
  return left.slice(-comparableLength) === right.slice(-comparableLength);
}

export function identifyWhatsAppUserSenders(
  messages: WhatsAppMessage[],
  identity: WhatsAppIdentity = {},
): Set<string> {
  const senders = Array.from(new Set(messages.map((message) => message.sender)));
  const currentName = normalizedName(identity.currentUserName);
  const currentPhone = normalizedPhone(identity.currentUserPhone);
  const workspaceNames = new Set(
    (identity.workspaceUserNames ?? []).map(normalizedName).filter(Boolean),
  );

  const exactNameMatches = senders.filter(
    (sender) => currentName && normalizedName(sender) === currentName,
  );
  if (exactNameMatches.length > 0) return new Set(exactNameMatches);

  const phoneMatches = senders.filter(
    (sender) => currentPhone && phonesMatch(normalizedPhone(sender), currentPhone),
  );
  if (phoneMatches.length > 0) return new Set(phoneMatches);

  const workspaceMatches = senders.filter((sender) => {
    const normalizedSender = normalizedName(sender);
    return [...workspaceNames].some((name) => {
      if (!normalizedSender.startsWith(`${name} `)) return false;
      const suffix = normalizedSender.slice(name.length).trim();
      return isPhoneLike(suffix);
    });
  });
  if (workspaceMatches.length > 0) return new Set(workspaceMatches);

  // Sem uma correspondência segura, todas as mensagens permanecem como cliente.
  return new Set();
}

export function renderWhatsAppHtml(
  messages: WhatsAppMessage[],
  identity: WhatsAppIdentity = {},
): string {
  const senders = Array.from(new Set(messages.map((m) => m.sender)));
  const userSenders = identifyWhatsAppUserSenders(messages, identity);
  const other = senders.find((sender) => !userSenders.has(sender)) ?? "Contato";

  const bubbles = messages
    .map((m) => {
      const mine = userSenders.has(m.sender);
      const align = mine ? "right" : "left";
      const direction = mine ? "outbound" : "inbound";
      const text = esc(m.text).replace(/\n/g, "<br/>");
      return `<tr data-whatsapp-message="${direction}"><td align="${align}" class="whatsapp-message-cell">
        <table role="presentation" cellpadding="0" cellspacing="0" class="whatsapp-bubble whatsapp-bubble--${mine ? "mine" : "client"}">
          <tr><td class="whatsapp-bubble-content">
            ${text}
             <span class="whatsapp-message-time">${esc(m.time)}${mine ? ' <span class="whatsapp-read-check">✓✓</span>' : ""}</span>
          </td></tr>
        </table>
      </td></tr>`;
    })
    .join("");

  return `<div class="whatsapp-chat" data-whatsapp-chat="true">
    <div class="whatsapp-chat-header">
      <div class="whatsapp-chat-avatar" aria-hidden="true"></div>
      <div class="whatsapp-chat-contact">${esc(other)}</div>
      <div class="whatsapp-chat-label">WhatsApp</div>
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" class="whatsapp-messages">${bubbles}</table>
  </div>`;
}

export function maybeConvertWhatsAppPaste(
  input: string,
  identity: WhatsAppIdentity = {},
): string | null {
  // Aceita input já com tags HTML — converte qualquer bloco em quebra de linha
  // antes de remover as demais tags.
  const BLOCK_CLOSE = /<\/(p|div|li|ul|ol|h[1-6]|tr|table|section|article|blockquote|pre)>/gi;
  const text = (input || "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(BLOCK_CLOSE, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  const parsed = parseWhatsAppPaste(text);
  if (!parsed) return null;
  return renderWhatsAppHtml(parsed, identity);
}

/** Atualiza apenas o HTML legado que este módulo gerava, preservando a direção gravada. */
export function modernizeLegacyWhatsAppHtml(input: string): string {
  if (!input.includes("background:#0B141A") || !input.includes(">WhatsApp</div>")) return input;

  return input
    .replace(
      /<div style="background:#0B141A;border-radius:14px;padding:14px 12px;max-width:520px;margin:4px 0;border:1px solid #1f2c33;">/g,
      '<div class="whatsapp-chat" data-whatsapp-chat="true">',
    )
    .replace(
      /<div style="display:flex;align-items:center;gap:10px;padding:0 4px 10px 4px;border-bottom:1px solid #1f2c33;margin-bottom:8px;">/g,
      '<div class="whatsapp-chat-header">',
    )
    .replace(
      /<div style="width:32px;height:32px;border-radius:50%;background:#2a3942;display:inline-block;"><\/div>/g,
      '<div class="whatsapp-chat-avatar" aria-hidden="true"></div>',
    )
    .replace(
      /<div style="font:600 14px -apple-system,Segoe UI,Roboto,sans-serif;color:#e9edef;">/g,
      '<div class="whatsapp-chat-contact">',
    )
    .replace(
      /<div style="font:11px -apple-system,Segoe UI,Roboto,sans-serif;color:#8696a0;margin-left:6px;">/g,
      '<div class="whatsapp-chat-label">',
    )
    .replace(
      /<table role="presentation" cellpadding="0" cellspacing="0" width="100%">/g,
      '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" class="whatsapp-messages">',
    )
    .replace(
      /<td align="(right|left)" style="padding:0;line-height:0;">/g,
      (_match, align) => `<td align="${align}" class="whatsapp-message-cell">`,
    )
    .replace(
      /<table role="presentation" cellpadding="0" cellspacing="0" style="display:inline-table;max-width:78%;background:#075E54;color:#ffffff;border-radius:6px;">/g,
      '<table role="presentation" cellpadding="0" cellspacing="0" class="whatsapp-bubble whatsapp-bubble--mine">',
    )
    .replace(
      /<table role="presentation" cellpadding="0" cellspacing="0" style="display:inline-table;max-width:78%;background:#202C33;color:#ffffff;border-radius:6px;">/g,
      '<table role="presentation" cellpadding="0" cellspacing="0" class="whatsapp-bubble whatsapp-bubble--client">',
    )
    .replace(
      /<td style="padding:1px 6px;font:12px\/1 -apple-system,Segoe UI,Roboto,sans-serif;white-space:pre-wrap;word-break:break-word;">/g,
      '<td class="whatsapp-bubble-content">',
    )
    .replace(
      /<span style="display:inline-block;margin-left:6px;font-size:8px;color:#b9c7ce;vertical-align:bottom;">/g,
      '<span class="whatsapp-message-time">',
    )
    .replace(
      /<span style="color:#53bdeb;">✓✓<\/span>/g,
      '<span class="whatsapp-read-check">✓✓</span>',
    );
}
