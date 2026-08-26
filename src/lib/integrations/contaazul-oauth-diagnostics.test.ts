import { describe, expect, it } from "vitest";
import {
  normalizeContaAzulOAuthError,
  sanitizeContaAzulAuthorizeUrl,
} from "./contaazul-oauth-diagnostics.server";

describe("diagnóstico OAuth do Conta Azul", () => {
  it("remove parâmetros sensíveis da URL de autorização com hash", () => {
    const result = sanitizeContaAzulAuthorizeUrl(
      "https://login.contaazul.com/#/oauth/authorize?client_id=abc&state=secret&code=code&scope=openid",
    );

    expect(result).toContain("client_id=%5Bmascarado%5D");
    expect(result).toContain("scope=openid");
    expect(result).not.toContain("secret");
    expect(result).not.toContain("code=code");
  });

  it("sanitiza credenciais na mensagem de erro", () => {
    const result = normalizeContaAzulOAuthError({
      stage: "troca_token",
      code: "invalid_client",
      message: "Basic abc123 access_token=xyz",
    });

    expect(result.code).toBe("invalid_client");
    expect(result.message).not.toContain("abc123");
    expect(result.message).not.toContain("xyz");
  });
});
