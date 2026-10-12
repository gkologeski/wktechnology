import { describe, expect, it } from "vitest";
import { computeRestoreKeys, keysRemovedByReplacements } from "./restore-default-keys";

const BANK = "techfinance.bank_accounts.view.workspace";
const PAY = "techfinance.payments.view.workspace";

describe("restaurar padrões com substituição local de conjunto", () => {
  const reps = [{ original: [BANK, PAY, "crm.deals.view.workspace"], local: [PAY] }];

  it("não recoloca chave retirada pelo pacote local", () => {
    expect(computeRestoreKeys([BANK, PAY], new Set(), reps)).toEqual([PAY]);
  });

  it("mantém chaves da baseline removidas fora", () => {
    expect(computeRestoreKeys([PAY, "x.y.z"], new Set(["x.y.z"]), reps)).toEqual([PAY]);
  });

  it("sem substituição, defaults ficam íntegros", () => {
    expect(computeRestoreKeys([BANK, PAY], new Set(), [])).toEqual([BANK, PAY]);
  });

  it("deriva as chaves removidas do conjunto original menos o local", () => {
    expect([...keysRemovedByReplacements(reps)].sort()).toEqual(
      [BANK, "crm.deals.view.workspace"].sort(),
    );
  });
});
