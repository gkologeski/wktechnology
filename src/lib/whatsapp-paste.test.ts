import { describe, it, expect } from "vitest";
import {
  identifyWhatsAppUserSenders,
  modernizeLegacyWhatsAppHtml,
  parseWhatsAppPaste,
  maybeConvertWhatsAppPaste,
} from "./whatsapp-paste";

const sample = `[10:00, 17/06/2026] Guilherme Kologeski: Fala Gustavo
[10:00, 17/06/2026] Guilherme Kologeski: bom dia, tudo bem?
[11:38, 17/06/2026] +55 47 9786-9780: Opa bom dia guilherme
[11:38, 17/06/2026] +55 47 9786-9780: podemos sim`;

describe("whatsapp paste", () => {
  it("parses lines", () => {
    const r = parseWhatsAppPaste(sample);
    expect(r).not.toBeNull();
    expect(r!.length).toBe(4);
    expect(r![0].sender).toBe("Guilherme Kologeski");
    expect(r![2].sender).toBe("+55 47 9786-9780");
  });

  it("returns null for non-whatsapp text", () => {
    expect(parseWhatsAppPaste("oi tudo bem?")).toBeNull();
  });

  it("renders html with bubbles", () => {
    const html = maybeConvertWhatsAppPaste(sample, {
      currentUserName: "Guilherme Kologeski",
    });
    expect(html).toContain("Fala Gustavo");
    expect(html).toContain("Opa bom dia guilherme");
    expect(html).toContain("whatsapp-bubble--mine");
    expect(html).toContain("whatsapp-bubble--client");
    expect(html).toContain('data-whatsapp-chat="true"');
  });

  it("handles html-wrapped input from rich editor", () => {
    const wrapped = sample
      .split("\n")
      .map((l) => `<p>${l}</p>`)
      .join("");
    const html = maybeConvertWhatsAppPaste(wrapped);
    expect(html).not.toBeNull();
    expect(html).toContain("podemos sim");
  });

  it("identifies the current user by normalized name", () => {
    const messages = parseWhatsAppPaste(sample) ?? [];
    const mine = identifyWhatsAppUserSenders(messages, {
      currentUserName: "guilherme kologéski",
    });
    expect([...mine]).toEqual(["Guilherme Kologeski"]);
  });

  it("identifies the current user by a formatted phone", () => {
    const messages = parseWhatsAppPaste(sample) ?? [];
    const mine = identifyWhatsAppUserSenders(messages, {
      currentUserName: "Outro usuário",
      currentUserPhone: "(47) 9786-9780",
    });
    expect([...mine]).toEqual(["+55 47 9786-9780"]);
  });

  it("does not classify another workspace user without a phone suffix", () => {
    const messages = parseWhatsAppPaste(sample) ?? [];
    const mine = identifyWhatsAppUserSenders(messages, {
      workspaceUserNames: ["Guilherme Kologeski"],
    });
    expect(mine.has("Guilherme Kologeski")).toBe(false);
    expect(mine.has("+55 47 9786-9780")).toBe(false);
  });

  it("recognizes a workspace user followed by their phone", () => {
    const messages = [
      {
        time: "10:00",
        date: "17/06/2026",
        sender: "Guilherme Kologeski +55 47 9999-0000",
        text: "Olá",
      },
      { time: "10:01", date: "17/06/2026", sender: "Cliente", text: "Oi" },
    ];
    const mine = identifyWhatsAppUserSenders(messages, {
      workspaceUserNames: ["Guilherme Kologeski"],
    });
    expect([...mine]).toEqual(["Guilherme Kologeski +55 47 9999-0000"]);
  });

  it("escapes unsafe message content", () => {
    const unsafe = `${sample}\n[11:39, 17/06/2026] Guilherme Kologeski: <img src=x onerror=alert(1)>`;
    const html = maybeConvertWhatsAppPaste(unsafe, { currentUserName: "Guilherme Kologeski" });
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("<img src=x");
  });

  it("modernizes legacy html without changing message alignment", () => {
    const legacy = `<div style="background:#0B141A;border-radius:14px;padding:14px 12px;max-width:520px;margin:4px 0;border:1px solid #1f2c33;"><div style="font:11px -apple-system,Segoe UI,Roboto,sans-serif;color:#8696a0;margin-left:6px;">WhatsApp</div><table role="presentation" cellpadding="0" cellspacing="0" style="display:inline-table;max-width:78%;background:#075E54;color:#ffffff;border-radius:6px;"><tr><td align="right" style="padding:0;line-height:0;">Oi</td></tr></table></div>`;
    const modern = modernizeLegacyWhatsAppHtml(legacy);
    expect(modern).toContain("whatsapp-chat");
    expect(modern).toContain("whatsapp-bubble--mine");
    expect(modern).toContain('align="right"');
    expect(modern).not.toContain("#0B141A");
  });
});
