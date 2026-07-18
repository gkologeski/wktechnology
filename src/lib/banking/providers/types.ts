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
    from: string; // ISO
    to: string; // ISO
    cursor?: string | null;
  }): Promise<BankStatementFetch>;

  fetchBalance(input: { access_token: string }): Promise<{ balance: number }>;
}
