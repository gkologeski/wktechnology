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

  async exchangeCode({
    code,
  }): Promise<BankTokens & { external_account_id?: string; display_name?: string }> {
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
      {
        dir: "credit",
        amount: 8500,
        desc: "PIX recebido — Cliente A",
        counterparty: "CLIENTE A LTDA",
        category: "receita",
      },
      {
        dir: "debit",
        amount: 1200.5,
        desc: "Pagamento fornecedor",
        counterparty: "FORN SERVIÇOS SA",
        category: "despesa",
      },
      {
        dir: "credit",
        amount: 3200,
        desc: "Boleto liquidado",
        counterparty: "CLIENTE B ME",
        category: "receita",
      },
      {
        dir: "debit",
        amount: 480.9,
        desc: "Tarifa bancária",
        counterparty: "BANCO INTER",
        category: "tarifa",
      },
      {
        dir: "debit",
        amount: 2750,
        desc: "Folha de pagamento",
        counterparty: "FOLHA",
        category: "folha",
      },
      {
        dir: "credit",
        amount: 1500,
        desc: "PIX recebido — Cliente C",
        counterparty: "CLIENTE C EIRELI",
        category: "receita",
      },
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

  async createPixCharge({ charge_id, amount, description }) {
    const txid = `TXID${charge_id.replace(/-/g, "").slice(0, 22).toUpperCase()}`;
    const copyPaste = `00020126360014BR.GOV.BCB.PIX0114+55MOCK${txid}5204000053039865802BR5910MOCK INTER6009SAO PAULO62070503***6304MOCK`;
    return {
      external_id: `mock_pix_${randomBytes(6).toString("hex")}`,
      pix_qr_code: `data:image/svg+xml;utf8,${encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><rect width='200' height='200' fill='#fff'/><text x='50%' y='50%' text-anchor='middle' font-family='monospace' font-size='10' fill='#000'>PIX MOCK ${txid.slice(-8)} - R$ ${amount.toFixed(2)}</text></svg>`,
      )}`,
      pix_copy_paste: copyPaste,
      boleto_barcode: null,
      boleto_digitable_line: null,
      boleto_url: null,
      raw: { txid, description, source: "mock" },
    };
  },

  async createBoletoCharge({ charge_id, amount, due_date }) {
    const nossoNum = charge_id.replace(/\D/g, "").slice(0, 10).padStart(10, "0");
    const centavos = Math.round(amount * 100)
      .toString()
      .padStart(10, "0");
    const dueCode = new Date(due_date).getTime().toString().slice(-4);
    const digitable = `07790.00000 ${nossoNum.slice(0, 5)}.${nossoNum.slice(5)}0 00000.000000 1 ${dueCode}${centavos.slice(0, 6)}`;
    const barcode = `07791${dueCode}${centavos}0000000000${nossoNum}`;
    return {
      external_id: `mock_bol_${randomBytes(6).toString("hex")}`,
      pix_qr_code: null,
      pix_copy_paste: null,
      boleto_barcode: barcode,
      boleto_digitable_line: digitable,
      boleto_url: `https://mock.inter.example/boleto/${charge_id}.pdf`,
      raw: { nosso_numero: nossoNum, source: "mock" },
    };
  },

  async createPixPayment({ payment_id, amount, favored_name }) {
    // Mock: 90% dos pagamentos entram como "processing" e 10% falham para simular erro.
    const shouldFail = payment_id.charCodeAt(0) % 10 === 0;
    return {
      external_id: `mock_pixout_${randomBytes(6).toString("hex")}`,
      status: shouldFail ? "failed" : "processing",
      failure_reason: shouldFail ? "Chave Pix não encontrada (mock)" : null,
      raw: { favored_name, amount, source: "mock" },
    };
  },

  async createBoletoPayment({ payment_id, amount, barcode }) {
    return {
      external_id: `mock_bolout_${randomBytes(6).toString("hex")}`,
      status: "processing",
      raw: { payment_id, amount, barcode, source: "mock" },
    };
  },

  async getPaymentStatus({ external_id }) {
    return {
      external_id,
      status: "paid",
      paid_at: new Date().toISOString(),
    };
  },
};
