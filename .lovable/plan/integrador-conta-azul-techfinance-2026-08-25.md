# Integrador Conta Azul → TechFinance

Importar do Conta Azul: contas a receber/pagar, plano de contas (categorias e centros de custo) e contas bancárias com extratos. Conexão por OAuth (API oficial) com fallback de importação por arquivo CSV/Excel, execução sob demanda e sincronização incremental agendada.

## Passo 0 — corrigir o build antes de tudo

A fragmentação do `hubspot-steps.server.ts` feita na etapa anterior deixou 7 erros de typecheck: tipos `ItemRow` e `UpsertTask` sem `export` em `hubspot-steps-types.ts`, helpers `loadImportedHsIdsForStep` / `loadLocalMapForHsIds` sem `export` no módulo de estado e sem import no arquivo principal, e um parâmetro implícito `any`. São ajustes de export/import, sem mudança de comportamento, seguidos de `tsgo`, lint, testes e build. É o primeiro passo da implementação (não pode ser feito em modo de planejamento).

## Situação atual verificada

- O provider `contaazul` já existe no catálogo (`src/lib/integrations/registry.ts`), com `authMode: "oauth"` e categoria `finance`, mas sem nenhuma implementação: não há arquivos `contaazul-*` em `src/lib/integrations/`.
- Infraestrutura reutilizável já existente: tabela `integrations` (config + `oauth_tokens`), `enrichment_jobs` / `enrichment_job_items` (jobs por passos com `step_logs`), padrão de cron em `src/routes/api/public/hooks/*-tick.ts` e tela genérica `integrations.$slug.tsx`.
- Destino no TechFinance já existe: `financial_entries` (`external_ref`, `metadata`, `installment_number/total`, `legal_entity_id`), `financial_categories`, `financial_cost_centers`, `financial_bank_accounts` (`external_account_id`), `bank_statement_transactions` (`external_id`, `reconciliation_status`).
- `src/lib/finance-audit.functions.ts` já faz auditoria de importação (lançamentos sem categoria/centro de custo/empresa) e será reaproveitado como tela de qualidade pós-importação.

## O que será entregue

### 1. Conexão

- Tela dedicada `/integrations/contaazul` com estados: não configurado, conectando, conectado, erro, token expirado, desativado.
- Fluxo OAuth: rota pública de callback, troca de código por token, refresh automático e persistência em `integrations.oauth_tokens`; `client_id`/`client_secret` como segredos de servidor, nunca em código.
- Sem as credenciais do app Conta Azul, a tela mostra o estado "depende de credenciais" e o caminho por arquivo continua disponível.

### 2. Importação por API (OAuth)

Passos independentes, cada um em uma requisição com checkpoint (mesmo modelo do importador HubSpot, para respeitar o limite de tempo do runtime):

1. `plano-de-contas` → `financial_categories` (hierarquia por `parent_id`) e `financial_cost_centers`
2. `contas-bancarias` → `financial_bank_accounts` (casadas por `external_account_id`)
3. `contas-a-receber` e `contas-a-pagar` → `financial_entries` (`direction`, `status`, parcelas, vínculo com categoria/centro de custo/empresa)
4. `extratos` → `bank_statement_transactions` (com `reconciliation_status` pendente para a conciliação já existente)

Cada passo é idempotente por `external_ref` / `external_id`: reimportar atualiza em vez de duplicar. Progresso, contagens e logs aparecem na tela via `enrichment_jobs`.

### 3. Importação por arquivo (fallback já funcional)

- Upload de CSV/XLSX exportado do Conta Azul, pré-visualização das primeiras linhas, mapeamento de colunas com sugestão automática, validação (datas, valores em formato brasileiro, duplicidade) e relatório de linhas aceitas/rejeitadas antes de gravar.

### 4. Sincronização incremental agendada

- Rota de cron `/api/public/hooks/contaazul-tick` protegida por `CRON_SECRET`, agendada a cada 30 minutos, sincronizando apenas registros alterados desde o último marco por workspace.

### 5. Fluidez da importação (campos e tabelas)

- Mapeamento de contrapartes: casar cliente/fornecedor do Conta Azul com `companies`/`legal_entities` por CNPJ/CPF normalizado; sem correspondência, fica pendente com resolução em lote na tela, sem bloquear a importação.
- Campos novos, aditivos e opcionais, por migration dedicada (aprovada separadamente):
  - `financial_categories.external_ids` e `financial_cost_centers.external_ids` (jsonb) para casar plano de contas por id externo;
  - `contaazul_sync_state` (por workspace: último marco por entidade, cursor, contagens, erro) — com GRANT, RLS e políticas por workspace.
- `financial_entries` não precisa de coluna nova: `external_ref` + `metadata` cobrem rastreabilidade e payload original.
- Após a importação, atalho para o relatório de auditoria existente, para tratar lançamentos sem categoria, centro de custo ou empresa.

## Detalhes técnicos

- `src/lib/integrations/contaazul-api.server.ts` (cliente HTTP, refresh de token, paginação, retry/backoff), `contaazul-steps.server.ts` (execução por passo com checkpoint), `contaazul-map.ts` (puro, com testes de mapeamento e parsing de valores/datas), `contaazul.functions.ts` (RPC fino: conectar, desconectar, iniciar job, status, resolver pendências), `contaazul-file-import.server.ts` (CSV/XLSX).
- UI em `src/components/finance/contaazul/*` com os componentes oficiais (`PageHeader`, `SectionHeader`, `MetricCard`, `FilterBar`, `EmptyState`, `Skeletons`, `StatusBadge`, `FormSection`), loading/empty/error, foco visível, responsivo, dark mode, tudo em PT-BR.
- RBAC: ações protegidas por `<Can>` nas chaves de integrações/financeiro; nenhuma alteração em RLS existente além das tabelas novas.
- Validação ao final: `bunx tsgo --noEmit`, `bun run lint`, `bun run test` e `bun run build`.

## Pendências conhecidas

- A importação por API só funciona após o app OAuth do Conta Azul (client id/secret) estar disponível; até então a tela indica a pendência e o caminho por arquivo cobre o uso real.
