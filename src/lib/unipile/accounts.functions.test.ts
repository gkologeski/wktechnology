import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
it("account connection never adopts the latest account from a global listing", () => {
  const source = readFileSync(new URL("./accounts.functions.ts", import.meta.url), "utf8");
  expect(source).not.toContain("listUnipileAccounts");
  expect(source).toContain("finishPersonalLinkedin");
});
