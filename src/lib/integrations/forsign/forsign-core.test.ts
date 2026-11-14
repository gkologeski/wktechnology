import { describe, expect, it } from "vitest";
import {
  buildMembers,
  htmlToBlocks,
  mapOperationStatus,
  timestampFresh,
  toWinAnsi,
  verifyForsignSignature,
} from "./forsign-core";

async function sign(body: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return "sha256=" + [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

describe("ForSign", () => {
  it("aceita só aviso com HMAC correto do corpo cru", async () => {
    const body = '{"Action":2,"OperationId":10}';
    const h = await sign(body, "segredo-do-webhook-123");
    expect(await verifyForsignSignature(body, h, "segredo-do-webhook-123")).toBe(true);
    expect(await verifyForsignSignature(body + " ", h, "segredo-do-webhook-123")).toBe(false);
    expect(await verifyForsignSignature(body, h, "outro-segredo-qualquer")).toBe(false);
    expect(await verifyForsignSignature(body, null, "segredo-do-webhook-123")).toBe(false);
  });
  it("recusa aviso com horário de mais de 1 hora", () => {
    const now = 1_800_000_000_000;
    expect(timestampFresh(String(now / 1000 - 60), now)).toBe(true);
    expect(timestampFresh(String(now / 1000 - 7200), now)).toBe(false);
    expect(timestampFresh(null, now)).toBe(false);
  });
  it("mapeia a situação da operação", () => {
    expect(mapOperationStatus("Completed", { current: 2, total: 2 })).toBe("completed");
    expect(mapOperationStatus("Canceled", { current: 0, total: 2 })).toBe("canceled");
    expect(mapOperationStatus("Expired", { current: 1, total: 2 })).toBe("expired");
    expect(mapOperationStatus("InProgress", { current: 1, total: 2 })).toBe("partially_signed");
    expect(mapOperationStatus("WaitingSignatures", { current: 0, total: 2 })).toBe("sent");
  });
  it("recusa assinantes com o mesmo e-mail e só envia CPF com 11 dígitos", () => {
    expect(() =>
      buildMembers([
        { name: "A B", email: "x@y.com", role: "Contratante" },
        { name: "C D", email: "X@y.com", role: "Contratada" },
      ]),
    ).toThrow();
    const [m] = buildMembers([{ name: "A B", email: "x@y.com", cpf: "123.456.789-09", role: "C" }]);
    expect(m.cpf).toBe("12345678909");
    expect(
      buildMembers([{ name: "A B", email: "x@y.com", cpf: "123", role: "C" }])[0],
    ).not.toHaveProperty("cpf");
  });
  it("converte o HTML formatado em blocos e mantém acentos", () => {
    const b = htmlToBlocks(
      "<!--techerp:html--><h1>Aditivo</h1><p><strong>Cláusula 1</strong></p><ul><li>111 horas</li></ul><p>Valor &amp; prazo</p>",
    );
    expect(b).toEqual([
      { kind: "h1", text: "Aditivo" },
      { kind: "p", text: "Cláusula 1", bold: true },
      { kind: "li", text: "111 horas" },
      { kind: "p", text: "Valor & prazo" },
    ]);
    expect(toWinAnsi("“ação” — ok…")).toBe('"ação" - ok...');
  });
});

describe("ForSign — webhook público", () => {
  const body = '{"Action":1,"OperationId":42}';
  const secret = "segredo-do-workspace-A-0001";
  const now = Date.now();
  it("forsign webhook allows signed fresh event", async () => {
    expect(timestampFresh(String(Math.floor(now / 1000)), now)).toBe(true);
    expect(await verifyForsignSignature(body, await sign(body, secret), secret)).toBe(true);
  });
  it("forsign webhook rejects missing signature", async () => {
    expect(await verifyForsignSignature(body, null, secret)).toBe(false);
    expect(await verifyForsignSignature(body, "", secret)).toBe(false);
  });
  it("forsign webhook rejects tampered body", async () => {
    expect(
      await verifyForsignSignature(body.replace("42", "43"), await sign(body, secret), secret),
    ).toBe(false);
  });
  it("forsign webhook rejects foreign workspace secret", async () => {
    const other = "segredo-do-workspace-B-0002";
    expect(await verifyForsignSignature(body, await sign(body, other), secret)).toBe(false);
  });
  it("forsign webhook rejects stale timestamp", () => {
    expect(timestampFresh(String(Math.floor(now / 1000) - 86400), now)).toBe(false);
  });
});

it("requires all originally requested signers including witnesses", async () => {
  const { allRequestedSignersCompleted } = await import("./forsign-core");
  const roster = [
    { email: "client@example.test" },
    { email: "issuer@example.test" },
    { email: "w1@example.test" },
    { email: "w2@example.test" },
  ];
  const signed = roster.map((r) => ({ ...r, status: "Completed" }));
  expect(allRequestedSignersCompleted(roster, signed)).toBe(true);
  expect(allRequestedSignersCompleted(roster, signed.slice(0, 2))).toBe(false);
  expect(
    allRequestedSignersCompleted(roster, [
      ...signed.slice(0, 3),
      { ...signed[3], status: "InProgress" },
    ]),
  ).toBe(false);
  expect(
    allRequestedSignersCompleted(roster, [
      ...signed.slice(0, 3),
      { email: "other@example.test", status: "Completed" },
    ]),
  ).toBe(false);
  expect(allRequestedSignersCompleted(roster, [...signed.slice(0, 3), signed[0]])).toBe(false);
  expect(allRequestedSignersCompleted(roster.slice(0, 2), signed.slice(0, 2))).toBe(true);
});

it("forsign parallel send puts every signer in the same position", () => {
  const ms = buildMembers([
    { name: "A", email: "a@x.com", role: "CONTRATANTE" },
    { name: "B", email: "b@x.com", role: "CONTRATADO" },
    { name: "C", email: "c@x.com", role: "TESTEMUNHA 1" },
  ]);
  expect(ms.map((m) => m.orderPosition)).toEqual([1, 1, 1]);
});

