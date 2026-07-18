// Provider MOCK do Banco Inter — apenas para testes internos até termos credenciais reais.
// Simula latência mínima e emite tokens fake. NÃO USAR EM PRODUÇÃO.
import { randomBytes } from "crypto";
import type { BankProvider, BankAuthorizationInit, BankTokens } from "./types";

function randomToken(prefix: string): string {
  return `${prefix}_${randomBytes(24).toString("hex")}`;
}

export const interMockProvider: BankProvider = {
  id: "inter",
  mode: "mock",
  defaultScopes: [
    "boleto-cobranca.read",
    "boleto-cobranca.write",
    "pix.read",
    "pix.write",
    "extrato.read",
    "conta-corrente.read",
  ],

  async initiateAuthorization({ connectionId }): Promise<BankAuthorizationInit> {
    const state = randomBytes(16).toString("hex");
    return {
      state,
      // URL fictícia — a UI trata como mock e simula o consentimento internamente.
      authorize_url: `mock://inter/authorize?connection_id=${connectionId}&state=${state}`,
      requires_external_redirect: false,
      message:
        "Modo mock: nenhuma requisição real ao Banco Inter foi feita. Ao aprovar, tokens simulados serão gerados.",
    };
  },

  async exchangeCode({ code }): Promise<
    BankTokens & { external_account_id?: string; display_name?: string }
  > {
    if (!code) throw new Error("Código de autorização ausente");
    return {
      access_token: randomToken("mock_at"),
      refresh_token: randomToken("mock_rt"),
      token_type: "Bearer",
      scope: interMockProvider.defaultScopes.join(" "),
      expires_in: 3600,
      external_account_id: "mock-conta-corrente-0001",
      display_name: "Banco Inter (mock)",
    };
  },

  async refreshTokens({ refresh_token }): Promise<BankTokens> {
    if (!refresh_token) throw new Error("Refresh token ausente");
    return {
      access_token: randomToken("mock_at"),
      refresh_token: randomToken("mock_rt"),
      token_type: "Bearer",
      scope: interMockProvider.defaultScopes.join(" "),
      expires_in: 3600,
    };
  },

  async revoke(): Promise<void> {
    // no-op no mock
  },
};
