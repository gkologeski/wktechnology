import { afterEach, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));
import { openBankToken, sealBankToken } from "./tokens.server";
afterEach(() => vi.unstubAllEnvs());
it("encrypts bank credentials, authenticates ciphertext, and preserves null refresh tokens", async () => {
  vi.stubEnv("AI_KEYS_ENCRYPTION_KEY", "isolated-encryption-test-only");
  const token = "synthetic-access-token";
  const sealed = await sealBankToken(token);
  expect(sealed).not.toContain(token);
  expect(sealed).toMatch(/^enc:v1:/);
  expect(await openBankToken(sealed!)).toBe(token);
  expect(await sealBankToken(null)).toBeNull();
  const another = await sealBankToken(token);
  expect(another).not.toBe(sealed);
  await expect(openBankToken(sealed!.slice(0, 14) + "!" + sealed!.slice(15))).rejects.toThrow();
  vi.stubEnv("AI_KEYS_ENCRYPTION_KEY", "another-key");
  await expect(openBankToken(sealed!)).rejects.toThrow();
});
it("does not fall back to plaintext or write unencrypted tokens when key is missing", async () => {
  await expect(openBankToken("legacy-plaintext")).rejects.toThrow("reautorize");
  vi.stubEnv("AI_KEYS_ENCRYPTION_KEY", "");
  await expect(sealBankToken("synthetic")).rejects.toThrow("não configurada");
});
