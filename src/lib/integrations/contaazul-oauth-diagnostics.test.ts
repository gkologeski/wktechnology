import { describe, expect, it } from "vitest";
import {
  inspectContaAzulAuthorizeParams,
  normalizeContaAzulOAuthError,
  sanitizeContaAzulAuthorizeUrl,
} from "./contaazul-oauth-diagnostics.server";
import { buildAuthorizeUrl } from "./contaazul-api.server";

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

  it("preserva parâmetros fixos da URL oficial e substitui callback/state dinâmicos", () => {
    const previousClientId = process.env["CONTAAZUL_CLIENT_ID"];
    const previousClientSecret = process.env["CONTAAZUL_CLIENT_SECRET"];
    const previousAuthUrl = process.env["CONTAAZUL_AUTHORIZATION_CODE_URL"];
    const previousRedirectUri = process.env["CONTAAZUL_REDIRECT_URI"];

    process.env["CONTAAZUL_CLIENT_ID"] = "client-env";
    process.env["CONTAAZUL_CLIENT_SECRET"] = "secret-env";
    process.env["CONTAAZUL_AUTHORIZATION_CODE_URL"] =
      "https://login.contaazul.com/#/oauth/authorize?response_type=code&client_id=client-url&scope=openid+profile+aws.cognito.signin.user.admin&redirect_uri=https%3A%2F%2Fwww.contaazul.com&prompt=login";
    process.env["CONTAAZUL_REDIRECT_URI"] =
      "https://app.wktechnology.com.br/api/public/oauth/contaazul-callback";

    try {
      const url = buildAuthorizeUrl({
        origin: "https://app.wktechnology.com.br",
        state: "state-1",
      });
      expect(url).toContain("prompt=login");
      expect(url).toContain("client_id=client-url");
      expect(url).toContain("state=state-1");
      expect(url).toContain(
        "redirect_uri=https%3A%2F%2Fapp.wktechnology.com.br%2Fapi%2Fpublic%2Foauth%2Fcontaazul-callback",
      );

      const checks = inspectContaAzulAuthorizeParams(url, {
        callback: "https://app.wktechnology.com.br/api/public/oauth/contaazul-callback",
        expectedClientId: "client-env",
      });
      expect(checks.responseType).toBe(true);
      expect(checks.scope).toBe(true);
      expect(checks.redirectMatchesCallback).toBe(true);
      expect(checks.clientIdConsistent).toBe(false);
    } finally {
      if (previousClientId === undefined) delete process.env["CONTAAZUL_CLIENT_ID"];
      else process.env["CONTAAZUL_CLIENT_ID"] = previousClientId;
      if (previousClientSecret === undefined) delete process.env["CONTAAZUL_CLIENT_SECRET"];
      else process.env["CONTAAZUL_CLIENT_SECRET"] = previousClientSecret;
      if (previousAuthUrl === undefined) delete process.env["CONTAAZUL_AUTHORIZATION_CODE_URL"];
      else process.env["CONTAAZUL_AUTHORIZATION_CODE_URL"] = previousAuthUrl;
      if (previousRedirectUri === undefined) delete process.env["CONTAAZUL_REDIRECT_URI"];
      else process.env["CONTAAZUL_REDIRECT_URI"] = previousRedirectUri;
    }
  });
});
