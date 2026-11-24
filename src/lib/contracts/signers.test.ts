import { it, expect } from "vitest";
import {
  applySignerSuggestions,
  contractSignersSchema,
  type ContractSignerSuggestions,
  type SignerSlot,
} from "./signers";
const ids = [
  "10000000-0000-4000-8000-000000000001",
  "10000000-0000-4000-8000-000000000002",
  "10000000-0000-4000-8000-000000000003",
];
const parties = () => [
  { role: "CONTRATANTE", contactId: ids[0] },
  { role: "CONTRATADO", contactId: ids[1] },
];
it("permits parties without witnesses", () =>
  expect(contractSignersSchema.safeParse(parties()).success).toBe(true));
it("permits an included witness and another document role", () =>
  expect(
    contractSignersSchema.safeParse([...parties(), { role: "TESTEMUNHA 1", contactId: ids[2] }])
      .success,
  ).toBe(true));
it("requires both parties and real contact selections", () => {
  expect(contractSignersSchema.safeParse(parties().slice(0, 1)).success).toBe(false);
  expect(
    contractSignersSchema.safeParse([{ role: "CONTRATANTE", contactId: "" }, parties()[1]]).success,
  ).toBe(false);
});
it("rejects duplicate roles or contacts", () => {
  expect(
    contractSignersSchema.safeParse([...parties(), { role: "TESTEMUNHA 1", contactId: ids[0] }])
      .success,
  ).toBe(false);
  expect(
    contractSignersSchema.safeParse([...parties(), { role: "CONTRATADO", contactId: ids[2] }])
      .success,
  ).toBe(false);
});

it("prefills empty party slots without overwriting manual selections", () => {
  const suggestions: ContractSignerSuggestions = {
    isPurchase: true,
    contratante: {
      partyName: "GM Kologeski & Cia Ltda ME",
      partyKind: "company",
      contact: { id: ids[0]!, name: "Guilherme Kologeski", email: "guilherme@wk.test" },
      cpf: "111.222.333-44",
    },
    contratado: {
      partyName: "Am It Serviços Em Informática",
      partyKind: "company",
      contact: { id: ids[1]!, name: "Anderson Caldas", email: "anderson@amit.test" },
      cpf: null,
    },
  };
  const emptySlots: SignerSlot[] = [
    { role: "CONTRATANTE", contact: null },
    { role: "CONTRATADO", contact: null },
  ];
  const filled = applySignerSuggestions(emptySlots, suggestions, true);
  expect(filled[0]?.contact?.id).toBe(ids[0]);
  expect(filled[0]?.cpf).toBe("111.222.333-44");
  expect(filled[1]?.contact?.id).toBe(ids[1]);

  const manual = { id: ids[2]!, name: "Outro Representante", email: "outro@wk.test" };
  const partialSlots: SignerSlot[] = [
    { role: "CONTRATANTE", contact: manual, cpf: "999.888.777-66" },
    { role: "CONTRATADO", contact: null },
  ];
  const preserved = applySignerSuggestions(partialSlots, suggestions, true);
  expect(preserved[0]?.contact).toEqual(manual);
  expect(preserved[0]?.cpf).toBe("999.888.777-66");
  expect(preserved[1]?.contact?.id).toBe(ids[1]);
});
