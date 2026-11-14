import { it, expect } from "vitest";
import { contractSignersSchema } from "./signers";
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
