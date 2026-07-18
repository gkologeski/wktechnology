# Plano — Testes e2e (Playwright) dos módulos novos

Adicionar 3 specs Playwright que exercitam ponta-a-ponta os fluxos críticos dos módulos entregues nas Sprints 1-6. Alinhados à infra Playwright já existente em `tests/e2e/` (helper `auth.ts`, config apontando para `crm.wktechnology.com.br`, exige `E2E_USER_EMAIL`/`E2E_USER_PASSWORD` no `.env.test.local`).

Escopo estritamente de testes — **nenhuma alteração no código dos módulos**. Se algum spec falhar por bug real, o achado vira uma tarefa separada.

## Fluxos cobertos

### 1. `tests/e2e/contracts-lifecycle.spec.ts`
Fluxo: criar → aprovar → ativar → gerar cobrança.
- Login (helper).
- Navega para `/contracts`, cria contrato de venda (empresa + valor + cadência mensal).
- Verifica cadeia default de aprovação criada (Legal → Finance) em `contract_approvals`.
- Aprova cada etapa como admin.
- Ativa o contrato; confirma `status=active` e `next_billing_at` populado.
- Dispara `/api/public/hooks/services-billing-tick` (ou avança `next_billing_at`) e verifica geração de `financial_entries` sem duplicar em segunda execução (idempotência).

### 2. `tests/e2e/projects-psa.spec.ts`
Fluxo PSA básico com timesheet e marco.
- Login.
- Cria projeto ligado a contrato ativo (reusa o seed do spec anterior ou cria contrato inline).
- Cria tarefa, marco billable e lança 2 time entries (uma billable, outra não).
- Abre detalhe do projeto e valida cards de custo, receita billable e margem batendo com a lógica de `src/lib/projects/financials.ts`.
- Marca marco como concluído e confere lançamento em Financeiro.

### 3. `tests/e2e/finance-flow.spec.ts`
Fluxo financeiro: recebível → pagamento → conciliação.
- Login.
- Em `/finance/receivable`, abre um `financial_entry` gerado pelo contrato.
- Registra pagamento parcial; valida saldo e status intermediário.
- Registra pagamento final; valida `status=paid` e histórico em `financial_payments`.
- Confere que o entry desaparece da lista de "em aberto" e aparece em "pagos".

## Alterações estruturais

- Novo helper `tests/e2e/helpers/modules-seed.ts` com funções utilitárias reutilizáveis: `createCompanyIfMissing`, `createContract`, `approveContract`, `triggerBillingTick`. Todas via UI (clicks reais) ou via chamada autenticada ao endpoint público de cron para o billing tick.
- Cada spec limpa seus próprios dados no `afterEach` (arquiva contrato / cancela projeto / estorna pagamento) para não vazar entre execuções — mesmo padrão dos specs `deals-crud` e `contacts-crud` atuais.

## Execução

- Rodar localmente com `bun run test:e2e` (usa `crm.wktechnology.com.br` + credenciais em `.env.test.local`).
- Em CI sem credenciais, os specs continuam existindo mas serão pulados pelo `test.skip(!process.env.E2E_USER_EMAIL, …)` já usado em outros specs.
- Não configurar CI novo — apenas deixar os specs prontos para execução manual, como os demais.

## Fora de escopo (explícito)

- Nenhuma mudança em `src/lib/contracts.functions.ts`, `services.functions.ts`, `projects.functions.ts`, `finance.functions.ts` ou nas migrations.
- Nenhuma mudança em RLS.
- Nenhum novo cron ou endpoint.
- Se um spec expuser um bug, paro e reporto — a correção entra como próxima tarefa.

## Entregáveis

- `tests/e2e/contracts-lifecycle.spec.ts`
- `tests/e2e/projects-psa.spec.ts`
- `tests/e2e/finance-flow.spec.ts`
- `tests/e2e/helpers/modules-seed.ts`

## Validação

- `bunx tsgo` verde após adicionar os arquivos.
- Execução manual local dos 3 specs; se algum falhar por bug real, reporto o achado sem alterar código de produção.
