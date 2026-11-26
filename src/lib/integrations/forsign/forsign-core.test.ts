import { describe, expect, it } from "vitest";
import {
  buildMembers,
  htmlToBlocks,
  mapOperationStatus,
  memberStatusInfo,
  opStatusTone,
  planSignaturePlacements,
  signerTagPair,
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

it("member status tone separates who signed, who waits and who is still in line", () => {
  expect(memberStatusInfo({ status: "Completed", stage: "Signed" }).tone).toBe("signed");
  expect(memberStatusInfo({ status: "Create", stage: "Sent" }).tone).toBe("waiting");
  expect(memberStatusInfo({ status: "Create", stage: "WaitingToSend" }).tone).toBe("queued");
  expect(memberStatusInfo({ status: "InProgress" }).tone).toBe("waiting");
  expect(memberStatusInfo({ status: "Canceled" }).tone).toBe("failed");
  expect(memberStatusInfo({ status: "AlgoNovo" }).tone).toBe("neutral");
});

it("member status labels stay exactly as before the tone split", () => {
  expect(memberStatusInfo({ status: "Create", stage: "WaitingToSend" }).label).toBe(
    "Na fila — recebe o convite após o anterior assinar",
  );
  expect(memberStatusInfo({ status: "Create", stage: "Sent" }).label).toBe(
    "Convite enviado — aguardando assinatura",
  );
  expect(memberStatusInfo({ status: "Completed" }).label).toBe("Assinou");
});

it("operation tone keeps a signed document apart from a partial or broken sending", () => {
  expect(opStatusTone("evidence_recorded")).toBe("signed");
  expect(opStatusTone("completed")).toBe("signed");
  expect(opStatusTone("partially_signed")).toBe("partial");
  expect(opStatusTone("sent")).toBe("waiting");
  expect(opStatusTone("creating")).toBe("sending");
  expect(opStatusTone("failed")).toBe("failed");
  expect(opStatusTone("expired")).toBe("failed");
  expect(opStatusTone("stale")).toBe("neutral");
});

describe("activeForsignProgress", () => {
  it("counts signed members of the newest active operation", async () => {
    const { activeForsignProgress } = await import("./forsign-core");
    expect(
      activeForsignProgress([
        { status: "canceled", members: [] },
        {
          status: "partially_signed",
          members: [
            { status: "Completed" },
            { status: "Completed" },
            { status: "Create" },
            { status: "Create" },
          ],
        },
      ]),
    ).toEqual({ signed: 2, total: 4 });
    expect(activeForsignProgress([{ status: "completed", members: [] }])).toBeNull();
  });
});

describe("ForSign — posicionamento de assinaturas e rubricas por tag", () => {
  it("associa linhas _________ seguidas de CONTRATANTE, CONTRATADA e testemunhas", () => {
    const html = `
      <h1>Contrato de Serviços</h1>
      <p>Cláusula 1. Objeto contratado pelas partes.</p>
      <p>____________________________________</p>
      <p>CONTRATANTE</p>
      <p>____________________________________</p>
      <p>CONTRATADA</p>
      <p>____________________________________</p>
      <p>TESTEMUNHA 1</p>
      <p>____________________________________</p>
      <p>TESTEMUNHA 2</p>
    `;
    const plan = planSignaturePlacements(htmlToBlocks(html), [
      { role: "CONTRATANTE" },
      { role: "CONTRATADO" },
      { role: "TESTEMUNHA 1" },
      { role: "TESTEMUNHA 2" },
    ]);
    expect(plan.hasFallbackPage).toBe(false);
    expect(plan.placements.map((p) => p.source)).toEqual([
      "identified",
      "identified",
      "identified",
      "identified",
    ]);
    expect(plan.placements.map((p) => p.signatureTag)).toEqual([
      "#TE-ASSINA-1",
      "#TE-ASSINA-2",
      "#TE-ASSINA-3",
      "#TE-ASSINA-4",
    ]);
    expect(plan.placements.map((p) => p.rubricTag)).toEqual([
      "#TE-RUBRICA-1",
      "#TE-RUBRICA-2",
      "#TE-RUBRICA-3",
      "#TE-RUBRICA-4",
    ]);
  });

  it("identifica blocos com cabeçalho acima e (assinatura eletrônica) inclusive tabela de testemunhas", () => {
    const html = `
      <p><strong>CONTRATANTE:</strong></p>
      <p>(assinatura eletrônica)<br>Brooks</p>
      <p><strong>CONTRATADA:</strong></p>
      <p>(assinatura eletrônica)<br>CMK KOLOGESKI LTDA</p>
      <p><strong>Testemunhas:</strong></p>
      <table><tbody><tr>
        <td><p>(assinatura eletrônica)</p></td>
        <td><p><br></p></td>
        <td><p>(assinatura eletrônica)</p></td>
      </tr></tbody></table>
    `;
    const plan = planSignaturePlacements(htmlToBlocks(html), [
      { role: "CONTRATANTE" },
      { role: "CONTRATADO" },
      { role: "TESTEMUNHA 1" },
      { role: "TESTEMUNHA 2" },
    ]);
    expect(plan.hasFallbackPage).toBe(false);
    expect(plan.placements.every((p) => p.source === "identified")).toBe(true);
    expect(new Set(plan.placements.map((p) => p.slot?.blockIndex)).size).toBe(4);
  });

  it("identifica Representante: ____ e testemunhas lado a lado ignorando data, Nome e CPF", () => {
    const html = `
      <p>Florianópolis/SC, _____ de ____________________ de ________.</p>
      <p><strong>CONTRATANTE:</strong></p>
      <p><strong>GM Kologeski</strong></p>
      <p>Representante: ____________________________________</p>
      <p><strong>CONTRATADA:</strong></p>
      <p><strong>Am It</strong></p>
      <p>Representante: ____________________________________</p>
      <p><strong>TESTEMUNHAS</strong></p>
      <p>1. Assinatura: ____________________ 2. Assinatura: ____________________</p>
      <p>Nome: __________________________ Nome: __________________________</p>
      <p>CPF: ___________________________ CPF: ___________________________</p>
    `;
    const plan = planSignaturePlacements(htmlToBlocks(html), [
      { role: "CONTRATANTE" },
      { role: "CONTRATADO" },
      { role: "TESTEMUNHA 1" },
      { role: "TESTEMUNHA 2" },
    ]);
    expect(plan.hasFallbackPage).toBe(false);
    expect(plan.placements.map((p) => [p.role, p.source, p.slot?.column])).toEqual([
      ["CONTRATANTE", "identified", "full"],
      ["CONTRATADO", "identified", "full"],
      ["TESTEMUNHA 1", "identified", "left"],
      ["TESTEMUNHA 2", "identified", "right"],
    ]);
  });

  it("encaminha para página de assinaturas quando há ambiguidade ou falta de espaço", () => {
    // Dois espaços CONTRATANTE = ambiguidade para 1 signatário CONTRATANTE -> fallback seguro.
    const ambiguous = `
      <p>________________________</p><p>CONTRATANTE</p>
      <p>________________________</p><p>CONTRATANTE</p>
      <p>________________________</p><p>CONTRATADA</p>
    `;
    const p1 = planSignaturePlacements(htmlToBlocks(ambiguous), [
      { role: "CONTRATANTE" },
      { role: "CONTRATADO" },
    ]);
    expect(p1.hasFallbackPage).toBe(true);
    expect(p1.placements[0]?.source).toBe("signature_page");
    expect(p1.placements[1]?.source).toBe("identified");

    // Linhas sem rótulo de papel nunca chutam quem assina onde -> fallback seguro.
    const unlabeled = `<p>________________________</p><p>________________________</p>`;
    const p2 = planSignaturePlacements(htmlToBlocks(unlabeled), [
      { role: "CONTRATANTE" },
      { role: "CONTRATADO" },
    ]);
    expect(p2.hasFallbackPage).toBe(true);
    expect(p2.placements.map((p) => p.source)).toEqual(["signature_page", "signature_page"]);

    // Contrato com 2 partes mas envio com testemunha adicional: partes identificadas, testemunha na página extra.
    const twoOnly = `
      <p>CONTRATANTE:</p><p>(assinatura eletrônica)</p>
      <p>CONTRATADA:</p><p>(assinatura eletrônica)</p>
    `;
    const p3 = planSignaturePlacements(htmlToBlocks(twoOnly), [
      { role: "CONTRATANTE" },
      { role: "CONTRATADO" },
      { role: "TESTEMUNHA 1" },
    ]);
    expect(p3.hasFallbackPage).toBe(true);
    expect(p3.placements.map((p) => p.source)).toEqual([
      "identified",
      "identified",
      "signature_page",
    ]);
  });

  it("envia tags únicas de assinatura, rubrica e vínculo ao documento no payload de membros", () => {
    const members = buildMembers(
      [
        { name: "Alice", email: "alice@example.test", role: "CONTRATANTE" },
        { name: "Bruno", email: "bruno@example.test", role: "CONTRATADO" },
      ],
      { documentId: "doc-123" },
    );
    expect(members[0]).toMatchObject({
      hasSignatureTag: true,
      signPositionTag: signerTagPair(0).signatureTag,
      hasRubricTag: true,
      rubricTag: signerTagPair(0).rubricTag,
      signatures: [{ documentId: "doc-123", printSignature: true, positions: [] }],
    });
    expect(members[1]?.signPositionTag).not.toBe(members[0]?.signPositionTag);
    expect(members[1]?.rubricTag).not.toBe(members[0]?.rubricTag);
  });
});
