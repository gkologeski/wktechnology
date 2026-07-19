// Contrato genérico para providers Open Finance.
// Todos os providers (mock, inter-sandbox, inter-production) implementam esta interface.

export type BankTokens = {
  access_token: string;
  refresh_token: string | null;
  token_type: string;
  scope: string | null;
  expires_in: number; // segundos
};

export type BankAuthorizationInit = {
  state: string;
  authorize_url: string;
  requires_external_redirect: boolean; // true para OAuth real, false para mock
  message?: string;
};

export type BankStatementTx = {
  external_id: string;
  posted_at: string; // ISO
  amount: number; // positivo; direção controla o sinal
  direction: "credit" | "debit";
  description: string | null;
  counterparty: string | null;
  category: string | null;
  balance_after: number | null;
  raw?: Record<string, unknown>;
};

export type BankStatementFetch = {
  transactions: BankStatementTx[];
  balance: number | null;
  cursor: string | null;
};

export type BankChargeCreated = {
  external_id: string;
  pix_qr_code: string | null;
  pix_copy_paste: string | null;
  boleto_barcode: string | null;
  boleto_digitable_line: string | null;
  boleto_url: string | null;
  raw?: Record<string, unknown>;
};

export type BankPaymentCreated = {
  external_id: string;
  status: "processing" | "paid" | "failed";
  failure_reason?: string | null;
  raw?: Record<string, unknown>;
};

export type BankPaymentStatus = {
  external_id: string;
  status: "processing" | "paid" | "failed" | "canceled";
  paid_at?: string | null;
  failure_reason?: string | null;
};

export interface BankProvider {
  id: string; // 'inter'
  mode: "mock" | "sandbox" | "production";
  defaultScopes: string[];

  initiateAuthorization(input: {
    workspaceId: string;
    connectionId: string;
    scopes: string[];
  }): Promise<BankAuthorizationInit>;

  exchangeCode(input: {
    code: string;
    state: string;
  }): Promise<BankTokens & { external_account_id?: string; display_name?: string }>;

  refreshTokens(input: { refresh_token: string }): Promise<BankTokens>;

  revoke(input: { access_token: string; refresh_token?: string | null }): Promise<void>;

  fetchStatement(input: {
    access_token: string;
    from: string;
    to: string;
    cursor?: string | null;
  }): Promise<BankStatementFetch>;

  fetchBalance(input: { access_token: string }): Promise<{ balance: number }>;

  createPixCharge?(input: {
    access_token: string;
    charge_id: string;
    amount: number;
    due_date: string;
    payer_name?: string | null;
    payer_document?: string | null;
    description?: string | null;
  }): Promise<BankChargeCreated>;

  createBoletoCharge?(input: {
    access_token: string;
    charge_id: string;
    amount: number;
    due_date: string;
    payer_name?: string | null;
    payer_document?: string | null;
    description?: string | null;
  }): Promise<BankChargeCreated>;

  // Pagamentos a fornecedores (Fase 5)
  createPixPayment?(input: {
    access_token: string;
    payment_id: string;
    amount: number;
    favored_name: string;
    favored_document: string;
    pix_key: string;
    pix_key_type: string;
    description?: string | null;
  }): Promise<BankPaymentCreated>;

  createBoletoPayment?(input: {
    access_token: string;
    payment_id: string;
    amount: number;
    barcode: string;
    favored_name?: string | null;
    description?: string | null;
  }): Promise<BankPaymentCreated>;

  getPaymentStatus?(input: {
    access_token: string;
    external_id: string;
  }): Promise<BankPaymentStatus>;
}
