# QA Manual — MVP Contratos / Serviços / PSA / Financeiro

Roteiro guiado para validar os 3 fluxos críticos dos novos módulos sem depender do Playwright. Cada passo tem **Ação → Resultado esperado**. Marque `[ ]` → `[x]` conforme executa.

## Pré-requisitos

- Usuário com role **Admin** ou permissão `finance.read` + `contracts.write` + `projects.write`.
- Workspace com pelo menos 1 empresa cliente cadastrada (ou crie durante o teste).
- Ambiente sugerido: `project--68dcfa85-b6da-4030-a825-b896ca621e0c-dev.lovable.app` (preview) ou produção.
- Aba do navegador com DevTools aberta (Network + Console) para capturar falhas silenciosas.
- Rodada limpa: opcionalmente, use um workspace de QA sem dados reais.

Registre em cada bloco: **Ambiente**, **Data/hora**, **Executor**, **Resultado (OK / Falha + evidência)**.

---

## Fluxo 1 — Ciclo de vida de Contrato + Billing recorrente

Valida: criação de contrato em rascunho, ativação, geração idempotente de cobrança pelo motor de billing, e reflexo no financeiro.

### 1.1. Criar contrato

- [ ] Acessar **/contracts** e clicar em **Novo contrato**.
  - Modal `QuickCreateContractDialog` abre com título, tipo (`provider`/`client`), empresa, valor total, moeda, data de início.
- [ ] Preencher: título único (ex.: `QA Contrato <YYYY-MM-DD>`), tipo `provider`, empresa existente, valor `1000`, moeda `BRL`, início hoje.
- [ ] Salvar.
  - Redireciona para **/contracts/<id>** (detalhe). Status = **Rascunho**. Título e valor conferem.

### 1.2. Adicionar serviço recorrente

- [ ] Na aba **Serviços** do contrato, clicar **Adicionar serviço**.
- [ ] Preencher: nome `QA Serviço Mensal`, tipo `recurring`, cadência `monthly`, quantidade `1`, preço unitário `500`, moeda `BRL`, `starts_at` = hoje, `next_billing_at` = **hoje** (chave para o tick disparar).
- [ ] Salvar.
  - Serviço aparece na lista com status `active` e o próximo faturamento = hoje.

### 1.3. Ativar contrato

- [ ] Clicar **Ativar contrato** no detalhe (ou trocar status para `active`).
  - Status muda para **Ativo**. Timeline exibe evento `contract_activated` (ou equivalente).
- [ ] Atualizar a página (F5). Status permanece **Ativo** (persistência OK).

### 1.4. Disparar billing tick

Opção A — via cron real (aguardar até 15 min pelo agendamento).
Opção B — via chamada manual (mais rápido):

- [ ] Como admin, acessar **/admin/status** (ou usar `curl` com `CRON_SECRET`) e clicar **Executar agora → services-billing**.
  - Resposta HTTP 200. Log em `cron_run_logs` com `status = success` e `processed >= 1`.

### 1.5. Verificar cobrança gerada

- [ ] Ir em **/finance/receivable**.
  - Aparece 1 lançamento com descrição contendo `QA Serviço Mensal`, valor `500`, status `open`, competência = hoje.
- [ ] Voltar ao detalhe do contrato → aba **Financeiro**. O mesmo lançamento é listado vinculado ao contrato.

### 1.6. Idempotência

- [ ] Disparar o tick novamente (mesmo dia).
  - Nenhum novo lançamento é criado para o mesmo `service_id` + `competence_date` (índice único parcial).
  - Log em `cron_run_logs` mostra `processed = 0` ou `skipped`. Nada quebrado.

### 1.7. Cleanup

- [ ] Marcar o serviço como `paused` ou o contrato como `terminated` para evitar novas cobranças na próxima janela de cron.

**Critério de aceite Fluxo 1:** todos os checkboxes acima marcados sem erros no console e sem duplicatas em `financial_entries`.

---

## Fluxo 2 — Projeto PSA (marcos, timesheet, financeiro)

Valida: criação de projeto, associação a contrato, marco faturável gerando `financial_entry`, timesheet contabilizando horas e custo.

### 2.1. Criar projeto

- [ ] Acessar **/projects** → **Novo projeto**.
- [ ] Preencher: nome `QA Projeto <data>`, empresa cliente, contrato criado no Fluxo 1 (opcional mas recomendado), tipo `provider`, status `active`, `starts_at` = hoje.
- [ ] Salvar.
  - Redireciona ao detalhe. Aparece nos filtros da listagem.

### 2.2. Adicionar membro com rate

- [ ] Aba **Equipe** → adicionar o próprio usuário com `cost_rate_hour = 100`, `bill_rate_hour = 200`.
  - Membro listado com as taxas exibidas.

### 2.3. Criar marco (milestone) faturável

- [ ] Aba **Marcos** → **Novo marco**.
- [ ] Preencher: título `QA Marco 1`, valor `1500`, `billable = true`, status inicial `planned`.
- [ ] Salvar.
  - Marco aparece com badge `Planejado`.
- [ ] Mudar status para **Concluído (done)**.
  - Sistema cria automaticamente um lançamento em `financial_entries` (origem = milestone). Verificar em **/finance/receivable**.
  - Aba **Financeiro** do projeto lista o mesmo entry.

### 2.4. Registrar horas (timesheet)

- [ ] Aba **Timesheet** → **Novo lançamento**.
- [ ] Preencher: data = hoje, horas = `4`, `billable = true`, descrição livre.
- [ ] Salvar.
- [ ] Repetir com `billable = false`, `horas = 2` (para validar segregação).
  - Ambos aparecem na lista.

### 2.5. Verificar financeiro agregado do projeto

- [ ] Aba **Financeiro** ou card de KPIs:
  - **Horas logadas** = `6h`.
  - **Custo realizado** = `6 * 100 = R$ 600`.
  - **Receita faturável (horas)** = `4 * 200 = R$ 800`.
  - **Receita de marcos** = `R$ 1.500` (só o marco `done`).
  - **Receita total** = `R$ 2.300`.
  - **Margem** = `2.300 - 600 = R$ 1.700`.
- [ ] Confirmar que valores conferem com `computeProjectFinancials` (ver `src/lib/projects/financials.ts`).

### 2.6. Cleanup

- [ ] Opcional: marcar projeto como `archived` para não poluir a listagem.

**Critério de aceite Fluxo 2:** KPIs financeiros do projeto batem com a fórmula, marco `done` gerou entry único, timesheet respeita flag `billable`.

---

## Fluxo 3 — Pagamentos e reconciliação financeira

Valida: registro de pagamento parcial e total, mudança de status do lançamento, exportação CSV.

### 3.1. Pagamento parcial

- [ ] Em **/finance/receivable**, abrir o lançamento gerado no Fluxo 1 (`QA Serviço Mensal`, R$ 500).
- [ ] Clicar **Registrar pagamento**.
- [ ] Preencher: valor `200`, data hoje, método `pix` (ou o disponível).
- [ ] Salvar.
  - `paid_amount = 200`, `status = partially_paid`, saldo em aberto = `300`.
  - Histórico do lançamento exibe o pagamento.

### 3.2. Pagamento final

- [ ] No mesmo lançamento, registrar segundo pagamento de `300`.
  - `paid_amount = 500`, `status = paid`, saldo = `0`.
  - Lançamento sai do filtro padrão "em aberto".

### 3.3. Estorno / edição (opcional)

- [ ] Se a UI oferecer, excluir o último pagamento.
  - Status volta para `partially_paid` e o total pago recalculado.

### 3.4. Exportação CSV

- [ ] Em **/finance/receivable**, clicar **Exportar CSV** com filtro por período que inclua o lançamento.
  - Download inicia. Arquivo abre no Excel/LibreOffice com colunas: descrição, valor, pago, saldo, status, competência, vencimento.
  - Acentuação preservada (UTF-8).

### 3.5. Alertas

- [ ] Criar um lançamento com `due_date` = ontem, `status = open`.
- [ ] Aguardar o cron `platform-alerts-tick` (ou disparar em **/admin/status**).
  - Alerta operacional aparece em **/admin/alerts** ou notifica via canal configurado (Slack/e-mail).
- [ ] Marcar como resolvido/silenciado; alerta some.

**Critério de aceite Fluxo 3:** transições de status corretas, CSV íntegro, alerta de vencimento disparado uma única vez por lançamento vencido.

---

## Checklist final de release

- [ ] Nenhum erro `Unauthorized` no console durante os 3 fluxos.
- [ ] Nenhuma requisição `4xx/5xx` em Network que não seja esperada.
- [ ] Dados criados por QA foram limpos ou marcados como arquivados.
- [ ] Achados registrados no board de bugs (`/admin/bug-reports`) com prioridade e evidência.
- [ ] Logs `cron_run_logs` inspecionados após execução: 0 falhas nos crons `services-billing`, `platform-alerts-tick`.

## Anexos

- Testes unitários que cobrem a lógica destes fluxos: `tests/unit/billing.test.ts`, `tests/unit/project-financials.test.ts`, `tests/unit/contract-approvals.test.ts` (16 casos, todos verdes).
- Server functions envolvidas: `src/lib/contracts.functions.ts`, `src/lib/services.functions.ts`, `src/lib/projects/*.functions.ts`, `src/lib/finance.functions.ts`, `src/lib/billing.server.ts`.
- Especificações Playwright equivalentes (rodam quando as credenciais E2E forem restauradas): `tests/e2e/contracts-lifecycle.spec.ts`, `tests/e2e/projects-psa.spec.ts`, `tests/e2e/finance-flow.spec.ts`.
