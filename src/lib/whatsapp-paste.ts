// Detecta texto colado de exportação do WhatsApp e converte para HTML
// estilizado que reproduz o visual da conversa (tema escuro).

const LINE_RE =
  /^\[(\d{1,2}:\d{2})(?::\d{2})?,\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\]\s+([^:]+?):\s?([\s\S]*)$/;

export type WhatsAppMessage = {
  time: string;
  date: string;
  sender: string;
  text: string;
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

export function renderWhatsAppHtml(messages: WhatsAppMessage[]): string {
  // Heurística: o "outro" é quem parece número de telefone, ou o segundo
  // remetente único. O "eu" (verde, à direita) é o primeiro nome não-telefone.
  const senders = Array.from(new Set(messages.map((m) => m.sender)));
  const phoneSender = senders.find(isPhoneLike);
  const nonPhone = senders.find((s) => !isPhoneLike(s));
  const me = nonPhone ?? senders[0];
  const other = phoneSender ?? senders.find((s) => s !== me) ?? "Contato";

  const bubbles = messages
    .map((m) => {
      const mine = m.sender === me;
      const align = mine ? "right" : "left";
      const bg = mine ? "#075E54" : "#202C33";
      const text = esc(m.text).replace(/\n/g, "<br/>");
      return `<tr><td align="${align}" style="padding:0;line-height:0;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="display:inline-table;max-width:78%;background:${bg};color:#ffffff;border-radius:6px;">
          <tr><td style="padding:1px 6px;font:12px/1 -apple-system,Segoe UI,Roboto,sans-serif;white-space:pre-wrap;word-break:break-word;">
            ${text}
            <span style="display:inline-block;margin-left:6px;font-size:8px;color:#b9c7ce;vertical-align:bottom;">${esc(m.time)}${mine ? ' <span style="color:#53bdeb;">✓✓</span>' : ""}</span>
          </td></tr>
        </table>
      </td></tr>`;
    })
    .join("");

  return `<div style="background:#0B141A;border-radius:14px;padding:14px 12px;max-width:520px;margin:4px 0;border:1px solid #1f2c33;">
    <div style="display:flex;align-items:center;gap:10px;padding:0 4px 10px 4px;border-bottom:1px solid #1f2c33;margin-bottom:8px;">
      <div style="width:32px;height:32px;border-radius:50%;background:#2a3942;display:inline-block;"></div>
      <div style="font:600 14px -apple-system,Segoe UI,Roboto,sans-serif;color:#e9edef;">${esc(other)}</div>
      <div style="font:11px -apple-system,Segoe UI,Roboto,sans-serif;color:#8696a0;margin-left:6px;">WhatsApp</div>
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">${bubbles}</table>
  </div>`;
}

export function maybeConvertWhatsAppPaste(input: string): string | null {
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
  return renderWhatsAppHtml(parsed);
}
