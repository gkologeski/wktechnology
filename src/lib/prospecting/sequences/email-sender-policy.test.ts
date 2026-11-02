import { expect, it } from "vitest";
import { applyEmailSenderPolicy } from "./drafts.server";
const steps = [
  { type: "email", accountId: "other" },
  { type: "whatsapp", accountId: "wa" },
];
it("não admin envia e-mail sempre pela própria conta", () => {
  const out = applyEmailSenderPolicy(steps, { isAdmin: false, ownAccountId: "mine" });
  expect(out[0].accountId).toBe("mine");
  expect(out[1].accountId).toBe("wa");
});
it("admin mantém a conta escolhida", () => {
  const out = applyEmailSenderPolicy(steps, { isAdmin: true, ownAccountId: "mine" });
  expect(out[0].accountId).toBe("other");
});
it("não admin sem conta própria não salva passo de e-mail", () => {
  expect(() => applyEmailSenderPolicy(steps, { isAdmin: false, ownAccountId: null })).toThrow(
    "Conecte sua conta",
  );
});
it("não admin sem conta pode salvar sequência sem e-mail", () => {
  expect(applyEmailSenderPolicy([steps[1]], { isAdmin: false, ownAccountId: null })).toHaveLength(
    1,
  );
});
