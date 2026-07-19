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

  async fetchBalance(): Promise<{ balance: number }> {
    // saldo simulado com pequena variação para parecer real
    const base = 42580.35;
    const jitter = Math.sin(Date.now() / 3600_000) * 250;
    return { balance: Number((base + jitter).toFixed(2)) };
  },

  async fetchStatement({ from, to }): Promise<{
    transactions: {
      external_id: string;
      posted_at: string;
      amount: number;
      direction: "credit" | "debit";
      description: string | null;
      counterparty: string | null;
      category: string | null;
      balance_after: number | null;
      raw?: Record<string, unknown>;
    }[];
    balance: number | null;
    cursor: string | null;
  }> {
    const start = new Date(from).getTime();
    const end = new Date(to).getTime();
    const days = Math.max(1, Math.min(60, Math.ceil((end - start) / 86_400_000)));

    const samples: Array<{
      dir: "credit" | "debit";
      amount: number;
      desc: string;
      counterparty: string;
      category: string;
    }> = [
      { dir: "credit", amount: 8500, desc: "PIX recebido — Cliente A", counterparty: "CLIENTE A LTDA", category: "receita" },
      { dir: "debit", amount: 1200.5, desc: "Pagamento fornecedor", counterparty: "FORN SERVIÇOS SA", category: "despesa" },
      { dir: "credit", amount: 3200, desc: "Boleto liquidado", counterparty: "CLIENTE B ME", category: "receita" },
      { dir: "debit", amount: 480.9, desc: "Tarifa bancária", counterparty: "BANCO INTER", category: "tarifa" },
      { dir: "debit", amount: 2750, desc: "Folha de pagamento", counterparty: "FOLHA", category: "folha" },
      { dir: "credit", amount: 1500, desc: "PIX recebido — Cliente C", counterparty: "CLIENTE C EIRELI", category: "receita" },
    ];

    let running = 40000;
    const txs = Array.from({ length: Math.min(days * 2, 40) }).map((_, i) => {
      const s = samples[i % samples.length];
      const ts = new Date(start + (i * (end - start)) / Math.max(1, days * 2)).toISOString();
      const signed = s.dir === "credit" ? s.amount : -s.amount;
      running = Number((running + signed).toFixed(2));
      return {
        external_id: `mock-tx-${start}-${i}`,
        posted_at: ts,
        amount: s.amount,
        direction: s.dir,
        description: s.desc,
        counterparty: s.counterparty,
        category: s.category,
        balance_after: running,
        raw: { source: "mock" },
      };
    });

    return { transactions: txs, balance: running, cursor: null };
  },
};
