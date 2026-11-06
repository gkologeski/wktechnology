# Auditoria dos 35 artigos TechFinance

## Escopo e método
Revisão estática de `/tmp/help-finance-articles.json` contra o código local atual. Nenhuma edição do JSON ou do projeto. Este relatório foi efetivamente gravado em `/tmp/help-finance-audit.md`. Não executa integrações, não atesta credenciais, cron ativo, dados reais ou migrations aplicadas no banco. Fontes abaixo são caminhos relativos ao projeto, com linhas da versão inspecionada. Comentários no código não prevalecem sobre handlers executáveis.

## Conclusão e prioridades
- Confirmado: emissão NFS-e bloqueada incondicionalmente após autorização de leitura da fatura; não existe stub fiscal executado nesse handler.
- Confirmado: apenas Inter mock implementado; depende de habilitação e não realiza transferência real. A redação condicional de alguns artigos é permissiva demais.
- Confirmado: Centros de custo é somente leitura nesta rota; catálogo de permissões não equivale a CRUD na interface.
- Confirmado: baixa manual/estorno só registram/removem baixa financeira; não executam transferência/devolução bancária.
- Corrigir: semântica de exclusão de parcelas; explicitar limites e permissões de recorrências; tornar DRE mais precisa.
- Corrigir: artigos de serviços declaram leitura de entries como acesso suficiente, mas servidor exige techservice.services.view.
- Corrigir: min_permission é chave exata na Ajuda, não expressão OR nem hierarquia de escopo. Ver decisão abaixo; não substituir mecanicamente todos os mínimos de leitura por escrita.

## min_permission: decisão transversal necessária
`src/lib/help/help-access.ts:88-122` calcula chaves efetivas e testa `Set.has(article.min_permission)`. `view.workspace` NÃO implica automaticamente `view.own` nesse teste. Um artigo com mínimo own pode ocultar ajuda de quem só recebeu workspace/team. O inverso ocorre nos recursos com leitura por registro. Portanto os valores atuais são chaves plausíveis, mas vários não representam todos os leitores autorizados.

Correção compatível sem alterar código: definir `min_permission: null` para artigos de consulta transversal e de recursos com múltiplas chaves alternativas, mantendo no corpo os requisitos verdadeiros. Isso continua sujeito ao acesso ao módulo finance e à publicação/audience; amplia a leitura da documentação, não o acesso aos dados. Se a política exigir restrição fina por recurso, NÃO usar null: o mantenedor deve implementar OR de permissões em outra tarefa e só então publicar esse filtro. Para artigos operacionais, manter mínimo de leitura é legítimo se o objetivo é ensinar também leitores; ele não autoriza executar. Especificar sempre as permissões de escrita no corpo.

Aplicar a opção null, se aprovada, aos artigos baseados em entries/recurrences e aos recursos com alternativas own/team/workspace (empresas, grupos, NFS-e, faturas, régua e templates), e aos artigos gerais. Manter os mínimos workspace de reports, categories, cost_centers, bank_accounts e audit: são recursos sem responsável no autorizador atual. Banking e sales também exigem workspace. Serviços devem documentar techservice.services.view; uma única chave não cobre suas três alternativas e o módulo finance permanece uma fronteira adicional da Ajuda.

## Seções, links e apresentação
Os howtos são verificados individualmente abaixo contra as cinco seções exigidas em `tests/help-coverage/help-coverage.ts:20-26`: Passo a passo, Resultado esperado, Regras e limites, Erros comuns e Relacionados. Overview, quickstart e referências não precisam imitar esse esqueleto. “Para que serve”, “Quem pode fazer”, “Onde fica” e “Antes de começar” são blocos em negrito, não títulos Markdown; isso é apresentação, não ausência de seção obrigatória. “Campos e controles” só é necessário onde há campos concretos.

Correção editorial global em Onde fica: substituir o nome descritivo do artigo pelo rótulo real do menu (Dashboard, A receber, A pagar etc.), conforme `src/lib/menu-config-finance.ts:27-181`. Dashboard está em Visão geral, não em Financeiro. Criar/parcelar/baixar são ações dentro das telas, não itens de menu. Links internos devem apontar somente para slugs existentes; resultado da validação abaixo.

## Revisão por artigo

### 01. `visao-geral` — Visão geral do TechFinance
- Rota: `/finance`. Mínimo atual: `techfinance.entries.view.own`.
- Seções: estrutura de overview; sem exigência de esqueleto howto.
- min_permission: chave de leitura não é autorização da operação e não cobre as alternativas de escopo/recurso; aplicar a decisão transversal acima.
- Afirmações: sem divergência funcional adicional confirmada na revisão estática; preservar as ressalvas de autorização e disponibilidade.
- Fontes concretas:
  - `src/lib/menu-config-finance.ts:23` — `export const FINANCE_SIDEBAR_GROUPS: SidebarGroup[] = [`
  - `src/lib/menu-config-finance.ts:32` — `permissionAny: MENU_PERMISSIONS.financeOverview,`
  - `src/lib/menu-config-finance.ts:44` — `permissionAny: MENU_PERMISSIONS.financeReceivable,`
  - `src/lib/menu-config-finance.ts:51` — `permissionAny: MENU_PERMISSIONS.financePayable,`
  - `src/lib/menu-config-finance.ts:58` — `permissionAny: MENU_PERMISSIONS.financeRecurrences,`
  - `src/lib/nfse.functions.ts:1` — `import { authorizeFinanceBusiness } from "@/lib/access-control/finance-business.server";`
  - `src/lib/nfse.functions.ts:7` — `export const listNfse = createServerFn({ method: "POST" })`
  - `src/lib/nfse.functions.ts:18` — `await authorizeFinanceBusiness(context.supabase, "nfse", "view", undefined);`
  - `src/lib/nfse.functions.ts:30` — `if (error) throw new Error(error.message);`
  - `src/lib/nfse.functions.ts:38` — `export const issueNfse = createServerFn({ method: "POST" })`
  - `src/lib/finance.functions.ts:1` — `import { authorizeFinanceBusiness } from "@/lib/access-control/finance-business.server";`
  - `src/lib/finance.functions.ts:24` — `export const listFinancialEntries = createServerFn({ method: "POST" })`
  - `src/lib/finance.functions.ts:72` — `export const getFinancialEntry = createServerFn({ method: "POST" })`
  - `src/lib/finance.functions.ts:88` — `const paymentsVisible = await financeRpc<boolean>(supabase, "finance_payment_access", {`
  - `src/lib/finance.functions.ts:122` — `export const createFinancialEntry = createServerFn({ method: "POST" })`

### 02. `primeiros-15-minutos` — Primeiros 15 minutos no TechFinance
- Rota: `/finance`. Mínimo atual: `techfinance.entries.view.own`.
- Seções: estrutura de getting_started; sem exigência de esqueleto howto.
- min_permission: chave de leitura não é autorização da operação e não cobre as alternativas de escopo/recurso; aplicar a decisão transversal acima.
- Divergência / correção exata: **Precisar mock**. Substituir “Banco Inter pode apresentar operações mock, dependentes de habilitação.” por “O único adaptador Banco Inter implementado é mock, condicionado à habilitação de simulações; sandbox e produção não estão implementados.”
- Fontes concretas:
  - `src/lib/menu-config-finance.ts:23` — `export const FINANCE_SIDEBAR_GROUPS: SidebarGroup[] = [`
  - `src/lib/menu-config-finance.ts:32` — `permissionAny: MENU_PERMISSIONS.financeOverview,`
  - `src/lib/menu-config-finance.ts:44` — `permissionAny: MENU_PERMISSIONS.financeReceivable,`
  - `src/lib/menu-config-finance.ts:51` — `permissionAny: MENU_PERMISSIONS.financePayable,`
  - `src/lib/menu-config-finance.ts:58` — `permissionAny: MENU_PERMISSIONS.financeRecurrences,`
  - `src/components/finance/quick-create-entry-dialog.tsx:35` — `function addMonths(iso: string, n: number): string {`
  - `src/components/finance/quick-create-entry-dialog.tsx:45` — `function addDays(iso: string, n: number): string {`
  - `src/components/finance/quick-create-entry-dialog.tsx:52` — `export function QuickCreateEntryDialog({`
  - `src/components/finance/quick-create-entry-dialog.tsx:132` — `async function submit() {`
  - `src/components/finance/quick-create-entry-dialog.tsx:159` — `split_mode: splitMode,`
  - `src/lib/banking/providers/index.ts:6` — `export function resolveBankProvider(providerId: string, mode: string): BankProvider {`
  - `src/lib/banking/providers/index.ts:9` — `throw new Error("A simulação bancária está desativada neste ambiente.");`
  - `src/lib/banking/providers/index.ts:13` — `throw new Error(`

### 03. `consultar-dashboard` — Consultar o Dashboard
- Rota: `/finance`. Mínimo atual: `techfinance.entries.view.own`.
- Seções: completas para howto.
- min_permission: chave de leitura não é autorização da operação e não cobre as alternativas de escopo/recurso; aplicar a decisão transversal acima.
- Afirmações: sem divergência funcional adicional confirmada na revisão estática; preservar as ressalvas de autorização e disponibilidade.
- Fontes concretas:
  - `src/routes/_authenticated/finance.index.tsx:1` — `import { HrScreenAccess } from "@/components/hr-access";`
  - `src/routes/_authenticated/finance.index.tsx:3` — `import { createFileRoute, Link } from "@tanstack/react-router";`
  - `src/routes/_authenticated/finance.index.tsx:23` — `export const Route = createFileRoute("/_authenticated/finance/")({`
  - `src/routes/_authenticated/finance.index.tsx:38` — `<HrScreenAccess resources={["techfinance.entries"]}>`
  - `src/routes/_authenticated/finance.index.tsx:40` — `</HrScreenAccess>`
  - `src/components/finance/finance-alerts-panel.tsx:12` — `function daysUntil(dateIso: string): number {`
  - `src/components/finance/finance-alerts-panel.tsx:18` — `export function FinanceAlertsPanel() {`
  - `src/components/finance/finance-alerts-panel.tsx:187` — `function Section({`

### 04. `consultar-contas-a-receber` — Consultar contas a receber
- Rota: `/finance/receivable`. Mínimo atual: `techfinance.entries.view.own`.
- Seções: completas para howto.
- min_permission: chave de leitura não é autorização da operação e não cobre as alternativas de escopo/recurso; aplicar a decisão transversal acima.
- Afirmações: sem divergência funcional adicional confirmada na revisão estática; preservar as ressalvas de autorização e disponibilidade.
- Fontes concretas:
  - `src/components/finance/entries-list-page.tsx:1` — `import { HrScreenAccess } from "@/components/hr-access";`
  - `src/components/finance/entries-list-page.tsx:80` — `function EntriesListContent({`
  - `src/components/finance/entries-list-page.tsx:524` — `export function EntriesListPage(props: Parameters<typeof EntriesListContent>[0]) {`
  - `src/components/finance/entries-list-page.tsx:526` — `<HrScreenAccess resources={["techfinance.entries"]}>`
  - `src/components/finance/entries-list-page.tsx:528` — `</HrScreenAccess>`
  - `src/lib/finance.functions.ts:1` — `import { authorizeFinanceBusiness } from "@/lib/access-control/finance-business.server";`
  - `src/lib/finance.functions.ts:24` — `export const listFinancialEntries = createServerFn({ method: "POST" })`
  - `src/lib/finance.functions.ts:72` — `export const getFinancialEntry = createServerFn({ method: "POST" })`
  - `src/lib/finance.functions.ts:88` — `const paymentsVisible = await financeRpc<boolean>(supabase, "finance_payment_access", {`
  - `src/lib/finance.functions.ts:122` — `export const createFinancialEntry = createServerFn({ method: "POST" })`
  - `src/lib/access-control/finance-records.server.ts:3` — `export async function financeRpc<T>(`
  - `src/lib/access-control/finance-records.server.ts:14` — `if (result.error) throw new Error(result.error.message);`
  - `src/lib/access-control/finance-records.server.ts:18` — `export async function assertFinanceEntry(`
  - `src/lib/access-control/finance-records.server.ts:24` — `(await financeRpc(client, "finance_entry_access", { _entry: id, _action: action })) !== true`
  - `src/lib/access-control/finance-records.server.ts:26` — `throw new Error("Lançamento indisponível ou sem permissão para esta ação.");`
  - `drizzle/migrations/0210_finance_core_actions.sql:9` — `CREATE OR REPLACE FUNCTION public.finance_access_context()`
  - `drizzle/migrations/0210_finance_core_actions.sql:19` — `CREATE OR REPLACE FUNCTION public.finance_context_access(_ctx jsonb,_workspace uuid,_resource text,_action text,_responsible uuid DEFAULT NULL)`
  - `drizzle/migrations/0210_finance_core_actions.sql:29` — `CREATE OR REPLACE FUNCTION public.finance_scope_access(_workspace uuid,_resource text,_action text,_responsible uuid DEFAULT NULL)`
  - `drizzle/migrations/0210_finance_core_actions.sql:31` — `SELECT finance_context_access(finance_access_context(),_workspace,_resource,_action,_responsible)`
  - `drizzle/migrations/0210_finance_core_actions.sql:33` — `CREATE OR REPLACE FUNCTION public.finance_context_entry_access(_ctx jsonb,_workspace uuid,_action text,_responsible uuid)`

### 05. `consultar-contas-a-pagar` — Consultar contas a pagar
- Rota: `/finance/payable`. Mínimo atual: `techfinance.entries.view.own`.
- Seções: completas para howto.
- min_permission: chave de leitura não é autorização da operação e não cobre as alternativas de escopo/recurso; aplicar a decisão transversal acima.
- Afirmações: sem divergência funcional adicional confirmada na revisão estática; preservar as ressalvas de autorização e disponibilidade.
- Fontes concretas:
  - `src/components/finance/entries-list-page.tsx:1` — `import { HrScreenAccess } from "@/components/hr-access";`
  - `src/components/finance/entries-list-page.tsx:80` — `function EntriesListContent({`
  - `src/components/finance/entries-list-page.tsx:524` — `export function EntriesListPage(props: Parameters<typeof EntriesListContent>[0]) {`
  - `src/components/finance/entries-list-page.tsx:526` — `<HrScreenAccess resources={["techfinance.entries"]}>`
  - `src/components/finance/entries-list-page.tsx:528` — `</HrScreenAccess>`
  - `src/lib/finance.functions.ts:1` — `import { authorizeFinanceBusiness } from "@/lib/access-control/finance-business.server";`
  - `src/lib/finance.functions.ts:24` — `export const listFinancialEntries = createServerFn({ method: "POST" })`
  - `src/lib/finance.functions.ts:72` — `export const getFinancialEntry = createServerFn({ method: "POST" })`
  - `src/lib/finance.functions.ts:88` — `const paymentsVisible = await financeRpc<boolean>(supabase, "finance_payment_access", {`
  - `src/lib/finance.functions.ts:122` — `export const createFinancialEntry = createServerFn({ method: "POST" })`
  - `src/lib/access-control/finance-records.server.ts:3` — `export async function financeRpc<T>(`
  - `src/lib/access-control/finance-records.server.ts:14` — `if (result.error) throw new Error(result.error.message);`
  - `src/lib/access-control/finance-records.server.ts:18` — `export async function assertFinanceEntry(`
  - `src/lib/access-control/finance-records.server.ts:24` — `(await financeRpc(client, "finance_entry_access", { _entry: id, _action: action })) !== true`
  - `src/lib/access-control/finance-records.server.ts:26` — `throw new Error("Lançamento indisponível ou sem permissão para esta ação.");`
  - `drizzle/migrations/0210_finance_core_actions.sql:9` — `CREATE OR REPLACE FUNCTION public.finance_access_context()`
  - `drizzle/migrations/0210_finance_core_actions.sql:19` — `CREATE OR REPLACE FUNCTION public.finance_context_access(_ctx jsonb,_workspace uuid,_resource text,_action text,_responsible uuid DEFAULT NULL)`
  - `drizzle/migrations/0210_finance_core_actions.sql:29` — `CREATE OR REPLACE FUNCTION public.finance_scope_access(_workspace uuid,_resource text,_action text,_responsible uuid DEFAULT NULL)`
  - `drizzle/migrations/0210_finance_core_actions.sql:31` — `SELECT finance_context_access(finance_access_context(),_workspace,_resource,_action,_responsible)`
  - `drizzle/migrations/0210_finance_core_actions.sql:33` — `CREATE OR REPLACE FUNCTION public.finance_context_entry_access(_ctx jsonb,_workspace uuid,_action text,_responsible uuid)`

### 06. `criar-lancamento` — Criar lançamento financeiro
- Rota: `/finance/receivable`. Mínimo atual: `techfinance.entries.view.own`.
- Seções: completas para howto.
- min_permission: chave de leitura não é autorização da operação e não cobre as alternativas de escopo/recurso; aplicar a decisão transversal acima.
- Afirmações: sem divergência funcional adicional confirmada na revisão estática; preservar as ressalvas de autorização e disponibilidade.
- Fontes concretas:
  - `src/components/finance/quick-create-entry-dialog.tsx:35` — `function addMonths(iso: string, n: number): string {`
  - `src/components/finance/quick-create-entry-dialog.tsx:45` — `function addDays(iso: string, n: number): string {`
  - `src/components/finance/quick-create-entry-dialog.tsx:52` — `export function QuickCreateEntryDialog({`
  - `src/components/finance/quick-create-entry-dialog.tsx:132` — `async function submit() {`
  - `src/components/finance/quick-create-entry-dialog.tsx:159` — `split_mode: splitMode,`
  - `src/lib/access-control/finance-records.server.ts:3` — `export async function financeRpc<T>(`
  - `src/lib/access-control/finance-records.server.ts:14` — `if (result.error) throw new Error(result.error.message);`
  - `src/lib/access-control/finance-records.server.ts:18` — `export async function assertFinanceEntry(`
  - `src/lib/access-control/finance-records.server.ts:24` — `(await financeRpc(client, "finance_entry_access", { _entry: id, _action: action })) !== true`
  - `src/lib/access-control/finance-records.server.ts:26` — `throw new Error("Lançamento indisponível ou sem permissão para esta ação.");`
  - `drizzle/migrations/0210_finance_core_actions.sql:9` — `CREATE OR REPLACE FUNCTION public.finance_access_context()`
  - `drizzle/migrations/0210_finance_core_actions.sql:19` — `CREATE OR REPLACE FUNCTION public.finance_context_access(_ctx jsonb,_workspace uuid,_resource text,_action text,_responsible uuid DEFAULT NULL)`
  - `drizzle/migrations/0210_finance_core_actions.sql:29` — `CREATE OR REPLACE FUNCTION public.finance_scope_access(_workspace uuid,_resource text,_action text,_responsible uuid DEFAULT NULL)`
  - `drizzle/migrations/0210_finance_core_actions.sql:31` — `SELECT finance_context_access(finance_access_context(),_workspace,_resource,_action,_responsible)`
  - `drizzle/migrations/0210_finance_core_actions.sql:33` — `CREATE OR REPLACE FUNCTION public.finance_context_entry_access(_ctx jsonb,_workspace uuid,_action text,_responsible uuid)`

### 07. `parcelar-lancamento` — Parcelar lançamento
- Rota: `/finance/payable`. Mínimo atual: `techfinance.entries.view.own`.
- Seções: completas para howto.
- min_permission: chave de leitura não é autorização da operação e não cobre as alternativas de escopo/recurso; aplicar a decisão transversal acima.
- Divergência / correção exata: **Corrigir exclusão de parcelas**. Substituir “A ficha oferece exclusão das parcelas em aberto conforme autorização, preservando parcelas que não podem ser excluídas.” por “A exclusão exige autorização de exclusão em todas as parcelas reais do grupo; sem essa autorização, toda a operação falha. No modo somente em aberto, parcelas fora de Em aberto/Vencido são mantidas; a âncora também pode ser mantida para preservar o grupo.”
- Fontes concretas:
  - `src/components/finance/quick-create-entry-dialog.tsx:35` — `function addMonths(iso: string, n: number): string {`
  - `src/components/finance/quick-create-entry-dialog.tsx:45` — `function addDays(iso: string, n: number): string {`
  - `src/components/finance/quick-create-entry-dialog.tsx:52` — `export function QuickCreateEntryDialog({`
  - `src/components/finance/quick-create-entry-dialog.tsx:132` — `async function submit() {`
  - `src/components/finance/quick-create-entry-dialog.tsx:159` — `split_mode: splitMode,`
  - `src/lib/finance.functions.ts:1` — `import { authorizeFinanceBusiness } from "@/lib/access-control/finance-business.server";`
  - `src/lib/finance.functions.ts:24` — `export const listFinancialEntries = createServerFn({ method: "POST" })`
  - `src/lib/finance.functions.ts:72` — `export const getFinancialEntry = createServerFn({ method: "POST" })`
  - `src/lib/finance.functions.ts:88` — `const paymentsVisible = await financeRpc<boolean>(supabase, "finance_payment_access", {`
  - `src/lib/finance.functions.ts:122` — `export const createFinancialEntry = createServerFn({ method: "POST" })`
  - `drizzle/migrations/0210_finance_core_actions.sql:9` — `CREATE OR REPLACE FUNCTION public.finance_access_context()`
  - `drizzle/migrations/0210_finance_core_actions.sql:19` — `CREATE OR REPLACE FUNCTION public.finance_context_access(_ctx jsonb,_workspace uuid,_resource text,_action text,_responsible uuid DEFAULT NULL)`
  - `drizzle/migrations/0210_finance_core_actions.sql:29` — `CREATE OR REPLACE FUNCTION public.finance_scope_access(_workspace uuid,_resource text,_action text,_responsible uuid DEFAULT NULL)`
  - `drizzle/migrations/0210_finance_core_actions.sql:31` — `SELECT finance_context_access(finance_access_context(),_workspace,_resource,_action,_responsible)`
  - `drizzle/migrations/0210_finance_core_actions.sql:33` — `CREATE OR REPLACE FUNCTION public.finance_context_entry_access(_ctx jsonb,_workspace uuid,_action text,_responsible uuid)`
  - `src/lib/access-control/finance-records.server.ts:3` — `export async function financeRpc<T>(`
  - `src/lib/access-control/finance-records.server.ts:14` — `if (result.error) throw new Error(result.error.message);`
  - `src/lib/access-control/finance-records.server.ts:18` — `export async function assertFinanceEntry(`
  - `src/lib/access-control/finance-records.server.ts:24` — `(await financeRpc(client, "finance_entry_access", { _entry: id, _action: action })) !== true`
  - `src/lib/access-control/finance-records.server.ts:26` — `throw new Error("Lançamento indisponível ou sem permissão para esta ação.");`

### 08. `consultar-lancamento` — Consultar lançamento e suas parcelas
- Rota: `/finance/entries/$id`. Mínimo atual: `techfinance.entries.view.own`.
- Seções: completas para howto.
- min_permission: chave de leitura não é autorização da operação e não cobre as alternativas de escopo/recurso; aplicar a decisão transversal acima.
- Afirmações: sem divergência funcional adicional confirmada na revisão estática; preservar as ressalvas de autorização e disponibilidade.
- Fontes concretas:
  - `src/routes/_authenticated/finance.entries.$id.tsx:2` — `import { HrScreenAccess } from "@/components/hr-access";`
  - `src/routes/_authenticated/finance.entries.$id.tsx:4` — `import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";`
  - `src/routes/_authenticated/finance.entries.$id.tsx:35` — `export const Route = createFileRoute("/_authenticated/finance/entries/$id")({`
  - `src/routes/_authenticated/finance.entries.$id.tsx:37` — `<HrScreenAccess resources={["techfinance.entries"]}>`
  - `src/routes/_authenticated/finance.entries.$id.tsx:39` — `</HrScreenAccess>`
  - `src/lib/access-control/finance-records.server.ts:3` — `export async function financeRpc<T>(`
  - `src/lib/access-control/finance-records.server.ts:14` — `if (result.error) throw new Error(result.error.message);`
  - `src/lib/access-control/finance-records.server.ts:18` — `export async function assertFinanceEntry(`
  - `src/lib/access-control/finance-records.server.ts:24` — `(await financeRpc(client, "finance_entry_access", { _entry: id, _action: action })) !== true`
  - `src/lib/access-control/finance-records.server.ts:26` — `throw new Error("Lançamento indisponível ou sem permissão para esta ação.");`
  - `drizzle/migrations/0210_finance_core_actions.sql:9` — `CREATE OR REPLACE FUNCTION public.finance_access_context()`
  - `drizzle/migrations/0210_finance_core_actions.sql:19` — `CREATE OR REPLACE FUNCTION public.finance_context_access(_ctx jsonb,_workspace uuid,_resource text,_action text,_responsible uuid DEFAULT NULL)`
  - `drizzle/migrations/0210_finance_core_actions.sql:29` — `CREATE OR REPLACE FUNCTION public.finance_scope_access(_workspace uuid,_resource text,_action text,_responsible uuid DEFAULT NULL)`
  - `drizzle/migrations/0210_finance_core_actions.sql:31` — `SELECT finance_context_access(finance_access_context(),_workspace,_resource,_action,_responsible)`
  - `drizzle/migrations/0210_finance_core_actions.sql:33` — `CREATE OR REPLACE FUNCTION public.finance_context_entry_access(_ctx jsonb,_workspace uuid,_action text,_responsible uuid)`

### 09. `registrar-baixa` — Registrar baixa parcial ou total
- Rota: `/finance/entries/$id`. Mínimo atual: `techfinance.entries.view.own`.
- Seções: completas para howto.
- min_permission: chave de leitura não é autorização da operação e não cobre as alternativas de escopo/recurso; aplicar a decisão transversal acima.
- Afirmações: sem divergência funcional adicional confirmada na revisão estática; preservar as ressalvas de autorização e disponibilidade.
- Acrescentar em Regras e limites: “Exige entries.view e payments.view + payments.create no escopo do responsável do título; não exige entries.update. O servidor recalcula a capacidade por registro.”
- Fontes concretas:
  - `src/components/finance/register-payment-dialog.tsx:40` — `export function RegisterPaymentDialog({`
  - `src/components/finance/register-payment-dialog.tsx:72` — `async function submit() {`
  - `src/lib/access-control/finance-records.server.ts:3` — `export async function financeRpc<T>(`
  - `src/lib/access-control/finance-records.server.ts:14` — `if (result.error) throw new Error(result.error.message);`
  - `src/lib/access-control/finance-records.server.ts:18` — `export async function assertFinanceEntry(`
  - `src/lib/access-control/finance-records.server.ts:24` — `(await financeRpc(client, "finance_entry_access", { _entry: id, _action: action })) !== true`
  - `src/lib/access-control/finance-records.server.ts:26` — `throw new Error("Lançamento indisponível ou sem permissão para esta ação.");`
  - `drizzle/migrations/0210_finance_core_actions.sql:9` — `CREATE OR REPLACE FUNCTION public.finance_access_context()`
  - `drizzle/migrations/0210_finance_core_actions.sql:19` — `CREATE OR REPLACE FUNCTION public.finance_context_access(_ctx jsonb,_workspace uuid,_resource text,_action text,_responsible uuid DEFAULT NULL)`
  - `drizzle/migrations/0210_finance_core_actions.sql:29` — `CREATE OR REPLACE FUNCTION public.finance_scope_access(_workspace uuid,_resource text,_action text,_responsible uuid DEFAULT NULL)`
  - `drizzle/migrations/0210_finance_core_actions.sql:31` — `SELECT finance_context_access(finance_access_context(),_workspace,_resource,_action,_responsible)`
  - `drizzle/migrations/0210_finance_core_actions.sql:33` — `CREATE OR REPLACE FUNCTION public.finance_context_entry_access(_ctx jsonb,_workspace uuid,_action text,_responsible uuid)`

### 10. `estornar-baixa` — Estornar baixa
- Rota: `/finance/entries/$id`. Mínimo atual: `techfinance.entries.view.own`.
- Seções: completas para howto.
- min_permission: chave de leitura não é autorização da operação e não cobre as alternativas de escopo/recurso; aplicar a decisão transversal acima.
- Afirmações: sem divergência funcional adicional confirmada na revisão estática; preservar as ressalvas de autorização e disponibilidade.
- Acrescentar em Regras e limites: “Exige entries.view e payments.view + payments.delete no escopo do responsável do título; o estorno remove a baixa, não devolve dinheiro.”
- Fontes concretas:
  - `src/routes/_authenticated/finance.entries.$id.tsx:2` — `import { HrScreenAccess } from "@/components/hr-access";`
  - `src/routes/_authenticated/finance.entries.$id.tsx:4` — `import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";`
  - `src/routes/_authenticated/finance.entries.$id.tsx:35` — `export const Route = createFileRoute("/_authenticated/finance/entries/$id")({`
  - `src/routes/_authenticated/finance.entries.$id.tsx:37` — `<HrScreenAccess resources={["techfinance.entries"]}>`
  - `src/routes/_authenticated/finance.entries.$id.tsx:39` — `</HrScreenAccess>`
  - `src/lib/finance.functions.ts:1` — `import { authorizeFinanceBusiness } from "@/lib/access-control/finance-business.server";`
  - `src/lib/finance.functions.ts:24` — `export const listFinancialEntries = createServerFn({ method: "POST" })`
  - `src/lib/finance.functions.ts:72` — `export const getFinancialEntry = createServerFn({ method: "POST" })`
  - `src/lib/finance.functions.ts:88` — `const paymentsVisible = await financeRpc<boolean>(supabase, "finance_payment_access", {`
  - `src/lib/finance.functions.ts:122` — `export const createFinancialEntry = createServerFn({ method: "POST" })`
  - `src/lib/access-control/finance-records.server.ts:3` — `export async function financeRpc<T>(`
  - `src/lib/access-control/finance-records.server.ts:14` — `if (result.error) throw new Error(result.error.message);`
  - `src/lib/access-control/finance-records.server.ts:18` — `export async function assertFinanceEntry(`
  - `src/lib/access-control/finance-records.server.ts:24` — `(await financeRpc(client, "finance_entry_access", { _entry: id, _action: action })) !== true`
  - `src/lib/access-control/finance-records.server.ts:26` — `throw new Error("Lançamento indisponível ou sem permissão para esta ação.");`
  - `drizzle/migrations/0210_finance_core_actions.sql:9` — `CREATE OR REPLACE FUNCTION public.finance_access_context()`
  - `drizzle/migrations/0210_finance_core_actions.sql:19` — `CREATE OR REPLACE FUNCTION public.finance_context_access(_ctx jsonb,_workspace uuid,_resource text,_action text,_responsible uuid DEFAULT NULL)`
  - `drizzle/migrations/0210_finance_core_actions.sql:29` — `CREATE OR REPLACE FUNCTION public.finance_scope_access(_workspace uuid,_resource text,_action text,_responsible uuid DEFAULT NULL)`
  - `drizzle/migrations/0210_finance_core_actions.sql:31` — `SELECT finance_context_access(finance_access_context(),_workspace,_resource,_action,_responsible)`
  - `drizzle/migrations/0210_finance_core_actions.sql:33` — `CREATE OR REPLACE FUNCTION public.finance_context_entry_access(_ctx jsonb,_workspace uuid,_action text,_responsible uuid)`

### 11. `gerenciar-recorrencias` — Gerenciar recorrências financeiras
- Rota: `/finance/recurrences`. Mínimo atual: `techfinance.recurrences.view.own`.
- Seções: completas para howto.
- min_permission: chave de leitura não é autorização da operação e não cobre as alternativas de escopo/recurso; aplicar a decisão transversal acima.
- Divergência / correção exata: **Explicitar geração e exclusão**. Adicionar em Regras e limites: “Gerar exige leitura e atualização da recorrência e criação de lançamentos no escopo do responsável. Cada chamada avança no máximo 24 períodos por agenda; repita a consulta se houver atraso maior. A exclusão só é permitida antes da primeira ocorrência gerada. Pausar não apaga títulos já gerados.”
- Fontes concretas:
  - `src/routes/_authenticated/finance.recurrences.tsx:2` — `import { HrScreenAccess } from "@/components/hr-access";`
  - `src/routes/_authenticated/finance.recurrences.tsx:4` — `import { createFileRoute } from "@tanstack/react-router";`
  - `src/routes/_authenticated/finance.recurrences.tsx:62` — `export const Route = createFileRoute("/_authenticated/finance/recurrences")({`
  - `src/routes/_authenticated/finance.recurrences.tsx:65` — `<HrScreenAccess resources={["techfinance.recurrences"]}>`
  - `src/routes/_authenticated/finance.recurrences.tsx:67` — `</HrScreenAccess>`
  - `src/lib/finance-recurrences.functions.ts:37` — `export const listRecurrences = createServerFn({ method: "POST" })`
  - `src/lib/finance-recurrences.functions.ts:66` — `can_generate: boolean;`
  - `src/lib/finance-recurrences.functions.ts:79` — `export const getRecurrence = createServerFn({ method: "POST" })`
  - `src/lib/finance-recurrences.functions.ts:93` — `export const upsertRecurrence = createServerFn({ method: "POST" })`
  - `src/lib/finance-recurrences.functions.ts:140` — `export const toggleRecurrence = createServerFn({ method: "POST" })`
  - `src/lib/finance-recurrences.server.ts:27` — `function addDaysISO(iso: string, days: number): string {`
  - `src/lib/finance-recurrences.server.ts:33` — `function addMonthsISO(iso: string, months: number, dayOfMonth?: number | null): string {`
  - `src/lib/finance-recurrences.server.ts:45` — `export function computeNextRunDate(row: RecurrenceRow, from?: string): string {`
  - `src/lib/finance-recurrences.server.ts:62` — `export async function advanceRecurrenceOnce(`
  - `src/lib/finance-recurrences.server.ts:74` — `export async function runAllDueRecurrences(admin: SupabaseClient): Promise<{`
  - `drizzle/migrations/0210_finance_core_actions.sql:9` — `CREATE OR REPLACE FUNCTION public.finance_access_context()`
  - `drizzle/migrations/0210_finance_core_actions.sql:19` — `CREATE OR REPLACE FUNCTION public.finance_context_access(_ctx jsonb,_workspace uuid,_resource text,_action text,_responsible uuid DEFAULT NULL)`
  - `drizzle/migrations/0210_finance_core_actions.sql:29` — `CREATE OR REPLACE FUNCTION public.finance_scope_access(_workspace uuid,_resource text,_action text,_responsible uuid DEFAULT NULL)`
  - `drizzle/migrations/0210_finance_core_actions.sql:31` — `SELECT finance_context_access(finance_access_context(),_workspace,_resource,_action,_responsible)`
  - `drizzle/migrations/0210_finance_core_actions.sql:33` — `CREATE OR REPLACE FUNCTION public.finance_context_entry_access(_ctx jsonb,_workspace uuid,_action text,_responsible uuid)`

### 12. `consultar-dre` — Consultar e exportar a DRE gerencial
- Rota: `/finance/dre`. Mínimo atual: `techfinance.reports.view.workspace`.
- Seções: completas para howto.
- min_permission: leitura workspace coerente com o servidor; não concede escrita.
- Divergência / correção exata: **Precisar bases e eliminação**. Substituir “Competência usa competência; Caixa usa a data de pagamento.” por “Competência soma o valor integral dos títulos não cancelados por competence_date; Caixa soma as baixas por paid_at, desconsiderando títulos cancelados. Baixas parciais entram pelo valor pago. Ao selecionar dois ou mais CNPJs, elimina registros cuja contraparte pertence ao conjunto selecionado; no regime Caixa o contador de eliminações conta baixas, não necessariamente títulos distintos.”
- Fontes concretas:
  - `src/routes/_authenticated/finance.dre.tsx:1` — `import { authorizeFinanceBusinessExport } from "@/lib/access-control/finance-business.functions";`
  - `src/routes/_authenticated/finance.dre.tsx:3` — `import { HrScreenAccess } from "@/components/hr-access";`
  - `src/routes/_authenticated/finance.dre.tsx:4` — `import { createFileRoute } from "@tanstack/react-router";`
  - `src/routes/_authenticated/finance.dre.tsx:31` — `export const Route = createFileRoute("/_authenticated/finance/dre")({`
  - `src/routes/_authenticated/finance.dre.tsx:39` — `<HrScreenAccess resources={["techfinance.reports"]}>`
  - `src/lib/finance.functions.ts:1` — `import { authorizeFinanceBusiness } from "@/lib/access-control/finance-business.server";`
  - `src/lib/finance.functions.ts:24` — `export const listFinancialEntries = createServerFn({ method: "POST" })`
  - `src/lib/finance.functions.ts:72` — `export const getFinancialEntry = createServerFn({ method: "POST" })`
  - `src/lib/finance.functions.ts:88` — `const paymentsVisible = await financeRpc<boolean>(supabase, "finance_payment_access", {`
  - `src/lib/finance.functions.ts:122` — `export const createFinancialEntry = createServerFn({ method: "POST" })`
  - `drizzle/migrations/0214_finance_business_prepare.sql:7` — `CREATE OR REPLACE FUNCTION public.finance_business_access(_ctx jsonb,_workspace uuid,_resource text,_action text,_responsible uuid DEFAULT NULL)`
  - `drizzle/migrations/0214_finance_business_prepare.sql:20` — `DECLARE c jsonb:=finance_access_context();w uuid:=(c->>'workspace')::uuid;r uuid;t text;BEGIN`
  - `drizzle/migrations/0214_finance_business_prepare.sql:32` — `IF NOT finance_business_access(c,w,_resource,_action,r) OR (_action<>'view' AND NOT finance_business_access(c,w,_resource,'view',r)) THEN RAISE EXCEPTION 'Ação financeira não `
  - `drizzle/migrations/0214_finance_business_prepare.sql:38` — `DECLARE c jsonb:=finance_access_context();w uuid:=(c->>'workspace')::uuid;out_rows jsonb;BEGIN`
  - `drizzle/migrations/0214_finance_business_prepare.sql:68` — `FOREACH f IN ARRAY ARRAY['public.finance_business_access(jsonb,uuid,text,text,uuid)'::regprocedure,'public.finance_business_authorize(text,text,uuid)'::regprocedure,'public.fi`
  - `drizzle/migrations/0215_finance_business_activate.sql:9` — `EXECUTE format('CREATE POLICY finance_business_view ON %I FOR SELECT TO authenticated USING(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''view'',`
  - `drizzle/migrations/0215_finance_business_activate.sql:10` — `EXECUTE format('CREATE POLICY finance_business_create ON %I FOR INSERT TO authenticated WITH CHECK(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''`
  - `drizzle/migrations/0215_finance_business_activate.sql:11` — `EXECUTE format('CREATE POLICY finance_business_update ON %I FOR UPDATE TO authenticated USING(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''updat`
  - `drizzle/migrations/0215_finance_business_activate.sql:12` — `EXECUTE format('CREATE POLICY finance_business_delete ON %I FOR DELETE TO authenticated USING(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''delet`
  - `drizzle/migrations/0215_finance_business_activate.sql:17` — `SELECT coalesce((SELECT finance_business_access(finance_access_context(),workspace_id,'invoices','view',coalesce(assigned_to,owner_id)) FROM customer_invoices WHERE id=_id AND`

### 13. `simular-fluxo-caixa` — Simular fluxo de caixa
- Rota: `/finance/cash-flow`. Mínimo atual: `techfinance.reports.view.workspace`.
- Seções: completas para howto.
- min_permission: leitura workspace coerente com o servidor; não concede escrita.
- Afirmações: sem divergência funcional adicional confirmada na revisão estática; preservar as ressalvas de autorização e disponibilidade.
- Fontes concretas:
  - `src/routes/_authenticated/finance.cash-flow.tsx:2` — `import { HrScreenAccess } from "@/components/hr-access";`
  - `src/routes/_authenticated/finance.cash-flow.tsx:3` — `import { createFileRoute } from "@tanstack/react-router";`
  - `src/routes/_authenticated/finance.cash-flow.tsx:25` — `export const Route = createFileRoute("/_authenticated/finance/cash-flow")({`
  - `src/routes/_authenticated/finance.cash-flow.tsx:33` — `<HrScreenAccess resources={["techfinance.reports"]}>`
  - `src/routes/_authenticated/finance.cash-flow.tsx:35` — `</HrScreenAccess>`
  - `src/lib/finance.functions.ts:1` — `import { authorizeFinanceBusiness } from "@/lib/access-control/finance-business.server";`
  - `src/lib/finance.functions.ts:24` — `export const listFinancialEntries = createServerFn({ method: "POST" })`
  - `src/lib/finance.functions.ts:72` — `export const getFinancialEntry = createServerFn({ method: "POST" })`
  - `src/lib/finance.functions.ts:88` — `const paymentsVisible = await financeRpc<boolean>(supabase, "finance_payment_access", {`
  - `src/lib/finance.functions.ts:122` — `export const createFinancialEntry = createServerFn({ method: "POST" })`
  - `drizzle/migrations/0214_finance_business_prepare.sql:7` — `CREATE OR REPLACE FUNCTION public.finance_business_access(_ctx jsonb,_workspace uuid,_resource text,_action text,_responsible uuid DEFAULT NULL)`
  - `drizzle/migrations/0214_finance_business_prepare.sql:20` — `DECLARE c jsonb:=finance_access_context();w uuid:=(c->>'workspace')::uuid;r uuid;t text;BEGIN`
  - `drizzle/migrations/0214_finance_business_prepare.sql:32` — `IF NOT finance_business_access(c,w,_resource,_action,r) OR (_action<>'view' AND NOT finance_business_access(c,w,_resource,'view',r)) THEN RAISE EXCEPTION 'Ação financeira não `
  - `drizzle/migrations/0214_finance_business_prepare.sql:38` — `DECLARE c jsonb:=finance_access_context();w uuid:=(c->>'workspace')::uuid;out_rows jsonb;BEGIN`
  - `drizzle/migrations/0214_finance_business_prepare.sql:68` — `FOREACH f IN ARRAY ARRAY['public.finance_business_access(jsonb,uuid,text,text,uuid)'::regprocedure,'public.finance_business_authorize(text,text,uuid)'::regprocedure,'public.fi`
  - `drizzle/migrations/0215_finance_business_activate.sql:9` — `EXECUTE format('CREATE POLICY finance_business_view ON %I FOR SELECT TO authenticated USING(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''view'',`
  - `drizzle/migrations/0215_finance_business_activate.sql:10` — `EXECUTE format('CREATE POLICY finance_business_create ON %I FOR INSERT TO authenticated WITH CHECK(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''`
  - `drizzle/migrations/0215_finance_business_activate.sql:11` — `EXECUTE format('CREATE POLICY finance_business_update ON %I FOR UPDATE TO authenticated USING(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''updat`
  - `drizzle/migrations/0215_finance_business_activate.sql:12` — `EXECUTE format('CREATE POLICY finance_business_delete ON %I FOR DELETE TO authenticated USING(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''delet`
  - `drizzle/migrations/0215_finance_business_activate.sql:17` — `SELECT coalesce((SELECT finance_business_access(finance_access_context(),workspace_id,'invoices','view',coalesce(assigned_to,owner_id)) FROM customer_invoices WHERE id=_id AND`

### 14. `gerenciar-plano-contas` — Gerenciar plano de contas
- Rota: `/finance/categories`. Mínimo atual: `techfinance.categories.view.workspace`.
- Seções: completas para howto.
- min_permission: leitura workspace coerente com o servidor; não concede escrita.
- Afirmações: sem divergência funcional adicional confirmada na revisão estática; preservar as ressalvas de autorização e disponibilidade.
- Fontes concretas:
  - `src/routes/_authenticated/finance.categories.tsx:2` — `import { HrScreenAccess } from "@/components/hr-access";`
  - `src/routes/_authenticated/finance.categories.tsx:3` — `import { createFileRoute } from "@tanstack/react-router";`
  - `src/routes/_authenticated/finance.categories.tsx:40` — `export const Route = createFileRoute("/_authenticated/finance/categories")({`
  - `src/routes/_authenticated/finance.categories.tsx:43` — `<HrScreenAccess resources={["techfinance.categories"]}>`
  - `src/routes/_authenticated/finance.categories.tsx:45` — `</HrScreenAccess>`
  - `src/lib/finance.functions.ts:1` — `import { authorizeFinanceBusiness } from "@/lib/access-control/finance-business.server";`
  - `src/lib/finance.functions.ts:24` — `export const listFinancialEntries = createServerFn({ method: "POST" })`
  - `src/lib/finance.functions.ts:72` — `export const getFinancialEntry = createServerFn({ method: "POST" })`
  - `src/lib/finance.functions.ts:88` — `const paymentsVisible = await financeRpc<boolean>(supabase, "finance_payment_access", {`
  - `src/lib/finance.functions.ts:122` — `export const createFinancialEntry = createServerFn({ method: "POST" })`
  - `drizzle/migrations/0214_finance_business_prepare.sql:7` — `CREATE OR REPLACE FUNCTION public.finance_business_access(_ctx jsonb,_workspace uuid,_resource text,_action text,_responsible uuid DEFAULT NULL)`
  - `drizzle/migrations/0214_finance_business_prepare.sql:20` — `DECLARE c jsonb:=finance_access_context();w uuid:=(c->>'workspace')::uuid;r uuid;t text;BEGIN`
  - `drizzle/migrations/0214_finance_business_prepare.sql:32` — `IF NOT finance_business_access(c,w,_resource,_action,r) OR (_action<>'view' AND NOT finance_business_access(c,w,_resource,'view',r)) THEN RAISE EXCEPTION 'Ação financeira não `
  - `drizzle/migrations/0214_finance_business_prepare.sql:38` — `DECLARE c jsonb:=finance_access_context();w uuid:=(c->>'workspace')::uuid;out_rows jsonb;BEGIN`
  - `drizzle/migrations/0214_finance_business_prepare.sql:68` — `FOREACH f IN ARRAY ARRAY['public.finance_business_access(jsonb,uuid,text,text,uuid)'::regprocedure,'public.finance_business_authorize(text,text,uuid)'::regprocedure,'public.fi`
  - `drizzle/migrations/0215_finance_business_activate.sql:9` — `EXECUTE format('CREATE POLICY finance_business_view ON %I FOR SELECT TO authenticated USING(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''view'',`
  - `drizzle/migrations/0215_finance_business_activate.sql:10` — `EXECUTE format('CREATE POLICY finance_business_create ON %I FOR INSERT TO authenticated WITH CHECK(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''`
  - `drizzle/migrations/0215_finance_business_activate.sql:11` — `EXECUTE format('CREATE POLICY finance_business_update ON %I FOR UPDATE TO authenticated USING(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''updat`
  - `drizzle/migrations/0215_finance_business_activate.sql:12` — `EXECUTE format('CREATE POLICY finance_business_delete ON %I FOR DELETE TO authenticated USING(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''delet`
  - `drizzle/migrations/0215_finance_business_activate.sql:17` — `SELECT coalesce((SELECT finance_business_access(finance_access_context(),workspace_id,'invoices','view',coalesce(assigned_to,owner_id)) FROM customer_invoices WHERE id=_id AND`

### 15. `consultar-centros-custo` — Consultar centros de custo
- Rota: `/finance/cost-centers`. Mínimo atual: `techfinance.cost_centers.view.workspace`.
- Seções: completas para howto.
- min_permission: leitura workspace coerente com o servidor; não concede escrita.
- Afirmações: sem divergência funcional adicional confirmada na revisão estática; preservar as ressalvas de autorização e disponibilidade.
- Verificação especial: consulta inline de financial_cost_centers e totais, apresentação de árvore; sem ações CRUD. Não mudar para guia de cadastro.
- Fontes concretas:
  - `src/routes/_authenticated/finance.cost-centers.tsx:3` — `import { HrScreenAccess } from "@/components/hr-access";`
  - `src/routes/_authenticated/finance.cost-centers.tsx:4` — `import { createFileRoute } from "@tanstack/react-router";`
  - `src/routes/_authenticated/finance.cost-centers.tsx:34` — `const { authorizeFinanceBusiness } =`
  - `src/routes/_authenticated/finance.cost-centers.tsx:37` — `await authorizeFinanceBusiness(context.supabase, "cost_centers");`
  - `src/routes/_authenticated/finance.cost-centers.tsx:97` — `export const Route = createFileRoute("/_authenticated/finance/cost-centers")({`
  - `drizzle/migrations/0214_finance_business_prepare.sql:7` — `CREATE OR REPLACE FUNCTION public.finance_business_access(_ctx jsonb,_workspace uuid,_resource text,_action text,_responsible uuid DEFAULT NULL)`
  - `drizzle/migrations/0214_finance_business_prepare.sql:20` — `DECLARE c jsonb:=finance_access_context();w uuid:=(c->>'workspace')::uuid;r uuid;t text;BEGIN`
  - `drizzle/migrations/0214_finance_business_prepare.sql:32` — `IF NOT finance_business_access(c,w,_resource,_action,r) OR (_action<>'view' AND NOT finance_business_access(c,w,_resource,'view',r)) THEN RAISE EXCEPTION 'Ação financeira não `
  - `drizzle/migrations/0214_finance_business_prepare.sql:38` — `DECLARE c jsonb:=finance_access_context();w uuid:=(c->>'workspace')::uuid;out_rows jsonb;BEGIN`
  - `drizzle/migrations/0214_finance_business_prepare.sql:68` — `FOREACH f IN ARRAY ARRAY['public.finance_business_access(jsonb,uuid,text,text,uuid)'::regprocedure,'public.finance_business_authorize(text,text,uuid)'::regprocedure,'public.fi`
  - `drizzle/migrations/0215_finance_business_activate.sql:9` — `EXECUTE format('CREATE POLICY finance_business_view ON %I FOR SELECT TO authenticated USING(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''view'',`
  - `drizzle/migrations/0215_finance_business_activate.sql:10` — `EXECUTE format('CREATE POLICY finance_business_create ON %I FOR INSERT TO authenticated WITH CHECK(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''`
  - `drizzle/migrations/0215_finance_business_activate.sql:11` — `EXECUTE format('CREATE POLICY finance_business_update ON %I FOR UPDATE TO authenticated USING(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''updat`
  - `drizzle/migrations/0215_finance_business_activate.sql:12` — `EXECUTE format('CREATE POLICY finance_business_delete ON %I FOR DELETE TO authenticated USING(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''delet`
  - `drizzle/migrations/0215_finance_business_activate.sql:17` — `SELECT coalesce((SELECT finance_business_access(finance_access_context(),workspace_id,'invoices','view',coalesce(assigned_to,owner_id)) FROM customer_invoices WHERE id=_id AND`

### 16. `gerenciar-empresas` — Gerenciar empresas e CNPJs
- Rota: `/finance/legal-entities`. Mínimo atual: `techfinance.legal_entities.view.workspace`.
- Seções: completas para howto.
- min_permission: chave de leitura não é autorização da operação e não cobre as alternativas de escopo/recurso; aplicar a decisão transversal acima.
- Afirmações: sem divergência funcional adicional confirmada na revisão estática; preservar as ressalvas de autorização e disponibilidade.
- Fontes concretas:
  - `src/components/finance/legal-entities-page.tsx:45` — `export function LegalEntitiesPage() {`
  - `src/components/finance/legal-entities-page.tsx:81` — `function openCreate() {`
  - `src/components/finance/legal-entities-page.tsx:88` — `async function openEdit(row: LE) {`
  - `src/components/finance/legal-entities-page.tsx:110` — `async function submit() {`
  - `src/components/finance/legal-entities-page.tsx:136` — `async function makeDefault(id: string) {`
  - `src/components/finance/legal-entity-cnpj-fill-dialog.tsx:32` — `export function LegalEntityCnpjFillDialog({`
  - `src/components/finance/legal-entity-cnpj-fill-dialog.tsx:95` — `function applyAllSuggestions() {`
  - `drizzle/migrations/0214_finance_business_prepare.sql:7` — `CREATE OR REPLACE FUNCTION public.finance_business_access(_ctx jsonb,_workspace uuid,_resource text,_action text,_responsible uuid DEFAULT NULL)`
  - `drizzle/migrations/0214_finance_business_prepare.sql:20` — `DECLARE c jsonb:=finance_access_context();w uuid:=(c->>'workspace')::uuid;r uuid;t text;BEGIN`
  - `drizzle/migrations/0214_finance_business_prepare.sql:32` — `IF NOT finance_business_access(c,w,_resource,_action,r) OR (_action<>'view' AND NOT finance_business_access(c,w,_resource,'view',r)) THEN RAISE EXCEPTION 'Ação financeira não `
  - `drizzle/migrations/0214_finance_business_prepare.sql:38` — `DECLARE c jsonb:=finance_access_context();w uuid:=(c->>'workspace')::uuid;out_rows jsonb;BEGIN`
  - `drizzle/migrations/0214_finance_business_prepare.sql:68` — `FOREACH f IN ARRAY ARRAY['public.finance_business_access(jsonb,uuid,text,text,uuid)'::regprocedure,'public.finance_business_authorize(text,text,uuid)'::regprocedure,'public.fi`
  - `drizzle/migrations/0215_finance_business_activate.sql:9` — `EXECUTE format('CREATE POLICY finance_business_view ON %I FOR SELECT TO authenticated USING(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''view'',`
  - `drizzle/migrations/0215_finance_business_activate.sql:10` — `EXECUTE format('CREATE POLICY finance_business_create ON %I FOR INSERT TO authenticated WITH CHECK(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''`
  - `drizzle/migrations/0215_finance_business_activate.sql:11` — `EXECUTE format('CREATE POLICY finance_business_update ON %I FOR UPDATE TO authenticated USING(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''updat`
  - `drizzle/migrations/0215_finance_business_activate.sql:12` — `EXECUTE format('CREATE POLICY finance_business_delete ON %I FOR DELETE TO authenticated USING(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''delet`
  - `drizzle/migrations/0215_finance_business_activate.sql:17` — `SELECT coalesce((SELECT finance_business_access(finance_access_context(),workspace_id,'invoices','view',coalesce(assigned_to,owner_id)) FROM customer_invoices WHERE id=_id AND`

### 17. `gerenciar-grupos` — Gerenciar grupos empresariais
- Rota: `/finance/legal-entity-groups`. Mínimo atual: `techfinance.legal_entity_groups.view.workspace`.
- Seções: completas para howto.
- min_permission: chave de leitura não é autorização da operação e não cobre as alternativas de escopo/recurso; aplicar a decisão transversal acima.
- Afirmações: sem divergência funcional adicional confirmada na revisão estática; preservar as ressalvas de autorização e disponibilidade.
- Fontes concretas:
  - `src/components/finance/legal-entity-groups-page.tsx:47` — `export function LegalEntityGroupsPage() {`
  - `src/components/finance/legal-entity-groups-page.tsx:89` — `function openCreate() {`
  - `src/components/finance/legal-entity-groups-page.tsx:93` — `function openEdit(g: Group) {`
  - `src/components/finance/legal-entity-groups-page.tsx:105` — `async function submit() {`
  - `src/components/finance/legal-entity-groups-page.tsx:127` — `async function remove(g: Group) {`
  - `src/components/finance/legal-entity-select.tsx:31` — `export const ALL_LEGAL_ENTITIES = "all";`
  - `src/components/finance/legal-entity-select.tsx:32` — `export const GROUP_PREFIX = "g:";`
  - `src/components/finance/legal-entity-select.tsx:36` — `function readInitial(): string {`
  - `src/components/finance/legal-entity-select.tsx:50` — `export function useLegalEntityFilter(): [string, (v: string) => void] {`
  - `src/components/finance/legal-entity-select.tsx:91` — `export function useLegalEntities() {`
  - `drizzle/migrations/0214_finance_business_prepare.sql:7` — `CREATE OR REPLACE FUNCTION public.finance_business_access(_ctx jsonb,_workspace uuid,_resource text,_action text,_responsible uuid DEFAULT NULL)`
  - `drizzle/migrations/0214_finance_business_prepare.sql:20` — `DECLARE c jsonb:=finance_access_context();w uuid:=(c->>'workspace')::uuid;r uuid;t text;BEGIN`
  - `drizzle/migrations/0214_finance_business_prepare.sql:32` — `IF NOT finance_business_access(c,w,_resource,_action,r) OR (_action<>'view' AND NOT finance_business_access(c,w,_resource,'view',r)) THEN RAISE EXCEPTION 'Ação financeira não `
  - `drizzle/migrations/0214_finance_business_prepare.sql:38` — `DECLARE c jsonb:=finance_access_context();w uuid:=(c->>'workspace')::uuid;out_rows jsonb;BEGIN`
  - `drizzle/migrations/0214_finance_business_prepare.sql:68` — `FOREACH f IN ARRAY ARRAY['public.finance_business_access(jsonb,uuid,text,text,uuid)'::regprocedure,'public.finance_business_authorize(text,text,uuid)'::regprocedure,'public.fi`
  - `drizzle/migrations/0215_finance_business_activate.sql:9` — `EXECUTE format('CREATE POLICY finance_business_view ON %I FOR SELECT TO authenticated USING(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''view'',`
  - `drizzle/migrations/0215_finance_business_activate.sql:10` — `EXECUTE format('CREATE POLICY finance_business_create ON %I FOR INSERT TO authenticated WITH CHECK(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''`
  - `drizzle/migrations/0215_finance_business_activate.sql:11` — `EXECUTE format('CREATE POLICY finance_business_update ON %I FOR UPDATE TO authenticated USING(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''updat`
  - `drizzle/migrations/0215_finance_business_activate.sql:12` — `EXECUTE format('CREATE POLICY finance_business_delete ON %I FOR DELETE TO authenticated USING(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''delet`
  - `drizzle/migrations/0215_finance_business_activate.sql:17` — `SELECT coalesce((SELECT finance_business_access(finance_access_context(),workspace_id,'invoices','view',coalesce(assigned_to,owner_id)) FROM customer_invoices WHERE id=_id AND`

### 18. `cadastrar-conta-bancaria` — Cadastrar e consultar contas bancárias
- Rota: `/finance/bank-accounts`. Mínimo atual: `techfinance.bank_accounts.view.workspace`.
- Seções: completas para howto.
- min_permission: leitura workspace coerente com o servidor; não concede escrita.
- Afirmações: sem divergência funcional adicional confirmada na revisão estática; preservar as ressalvas de autorização e disponibilidade.
- Fontes concretas:
  - `src/routes/_authenticated/finance.bank-accounts.tsx:1` — `import { authorizeFinanceBusinessExport } from "@/lib/access-control/finance-business.functions";`
  - `src/routes/_authenticated/finance.bank-accounts.tsx:3` — `import { HrScreenAccess } from "@/components/hr-access";`
  - `src/routes/_authenticated/finance.bank-accounts.tsx:4` — `import { createFileRoute } from "@tanstack/react-router";`
  - `src/routes/_authenticated/finance.bank-accounts.tsx:59` — `export const Route = createFileRoute("/_authenticated/finance/bank-accounts")({`
  - `src/routes/_authenticated/finance.bank-accounts.tsx:62` — `<HrScreenAccess resources={["techfinance.bank_accounts"]}>`
  - `drizzle/migrations/0214_finance_business_prepare.sql:7` — `CREATE OR REPLACE FUNCTION public.finance_business_access(_ctx jsonb,_workspace uuid,_resource text,_action text,_responsible uuid DEFAULT NULL)`
  - `drizzle/migrations/0214_finance_business_prepare.sql:20` — `DECLARE c jsonb:=finance_access_context();w uuid:=(c->>'workspace')::uuid;r uuid;t text;BEGIN`
  - `drizzle/migrations/0214_finance_business_prepare.sql:32` — `IF NOT finance_business_access(c,w,_resource,_action,r) OR (_action<>'view' AND NOT finance_business_access(c,w,_resource,'view',r)) THEN RAISE EXCEPTION 'Ação financeira não `
  - `drizzle/migrations/0214_finance_business_prepare.sql:38` — `DECLARE c jsonb:=finance_access_context();w uuid:=(c->>'workspace')::uuid;out_rows jsonb;BEGIN`
  - `drizzle/migrations/0214_finance_business_prepare.sql:68` — `FOREACH f IN ARRAY ARRAY['public.finance_business_access(jsonb,uuid,text,text,uuid)'::regprocedure,'public.finance_business_authorize(text,text,uuid)'::regprocedure,'public.fi`
  - `drizzle/migrations/0215_finance_business_activate.sql:9` — `EXECUTE format('CREATE POLICY finance_business_view ON %I FOR SELECT TO authenticated USING(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''view'',`
  - `drizzle/migrations/0215_finance_business_activate.sql:10` — `EXECUTE format('CREATE POLICY finance_business_create ON %I FOR INSERT TO authenticated WITH CHECK(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''`
  - `drizzle/migrations/0215_finance_business_activate.sql:11` — `EXECUTE format('CREATE POLICY finance_business_update ON %I FOR UPDATE TO authenticated USING(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''updat`
  - `drizzle/migrations/0215_finance_business_activate.sql:12` — `EXECUTE format('CREATE POLICY finance_business_delete ON %I FOR DELETE TO authenticated USING(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''delet`
  - `drizzle/migrations/0215_finance_business_activate.sql:17` — `SELECT coalesce((SELECT finance_business_access(finance_access_context(),workspace_id,'invoices','view',coalesce(assigned_to,owner_id)) FROM customer_invoices WHERE id=_id AND`

### 19. `operar-banco-inter` — Consultar conexão e extrato do Banco Inter
- Rota: `/finance/banking`. Mínimo atual: `techfinance.banking.view.workspace`.
- Seções: completas para howto.
- min_permission: leitura workspace coerente com o servidor; não concede escrita.
- Divergência / correção exata: **Precisar adaptador e conexão**. Substituir “A interface contém conexão e liquidações mock: simulação não é operação bancária real.” por “O resolvedor atual só implementa Inter mock e exige simulação habilitada; sandbox e production são rejeitados. Conectar e desconectar exigem techfinance.banking.manage.workspace além de techfinance.banking.view.workspace. Simulação não é operação bancária real.”
- Fontes concretas:
  - `src/routes/_authenticated/finance.banking.tsx:1` — `import { HrScreenAccess } from "@/components/hr-access";`
  - `src/routes/_authenticated/finance.banking.tsx:4` — `import { createFileRoute } from "@tanstack/react-router";`
  - `src/routes/_authenticated/finance.banking.tsx:85` — `export const Route = createFileRoute("/_authenticated/finance/banking")({`
  - `src/routes/_authenticated/finance.banking.tsx:87` — `<HrScreenAccess resources={["techfinance.banking"]}>`
  - `src/routes/_authenticated/finance.banking.tsx:89` — `</HrScreenAccess>`
  - `src/lib/banking.functions.ts:18` — `export const getBankConnection = createServerFn({ method: "GET" })`
  - `src/lib/banking.functions.ts:36` — `if (error) throw new Error(error.message);`
  - `src/lib/banking.functions.ts:57` — `export const startBankAuthorization = createServerFn({ method: "POST" })`
  - `src/lib/banking.functions.ts:63` — `mode: z.enum(["mock", "sandbox", "production"]).default("mock"),`
  - `src/lib/banking.functions.ts:83` — `mode: provider.mode,`
  - `src/lib/banking/providers/index.ts:6` — `export function resolveBankProvider(providerId: string, mode: string): BankProvider {`
  - `src/lib/banking/providers/index.ts:9` — `throw new Error("A simulação bancária está desativada neste ambiente.");`
  - `src/lib/banking/providers/index.ts:13` — `throw new Error(`
  - `drizzle/migrations/0212_banking_action_preparation.sql:18` — `DECLARE c jsonb:=finance_access_context();k text;BEGIN`
  - `drizzle/migrations/0212_banking_action_preparation.sql:22` — `CREATE OR REPLACE FUNCTION public.banking_authorize(_action text)`
  - `drizzle/migrations/0212_banking_action_preparation.sql:28` — `REVOKE ALL ON FUNCTION public.banking_access(uuid,text),public.banking_authorize(text) FROM PUBLIC,anon;`
  - `drizzle/migrations/0212_banking_action_preparation.sql:29` — `GRANT EXECUTE ON FUNCTION public.banking_access(uuid,text),public.banking_authorize(text) TO authenticated;`
  - `drizzle/migrations/0212_banking_action_preparation.sql:33` — `DECLARE w uuid:=banking_authorize('create_payment');c bank_connections;e financial_entries;v numeric:=(_data->>'amount')::numeric;out_id uuid;BEGIN`

### 20. `gerenciar-cobrancas-bancarias` — Gerenciar cobranças bancárias
- Rota: `/finance/banking`. Mínimo atual: `techfinance.banking.view.workspace`.
- Seções: completas para howto.
- min_permission: leitura workspace coerente com o servidor; não concede escrita.
- Divergência / correção exata: **Evitar interpretação de emissão real**. Substituir “Cobrança registrada conforme o modo e adaptador; não comprova recebimento real.” por “Quando habilitado, o único adaptador atual gera cobranças simuladas Inter mock. Não há emissão bancária real implementada, nem comprovação de recebimento real.”
- Fontes concretas:
  - `src/routes/_authenticated/finance.banking.tsx:1` — `import { HrScreenAccess } from "@/components/hr-access";`
  - `src/routes/_authenticated/finance.banking.tsx:4` — `import { createFileRoute } from "@tanstack/react-router";`
  - `src/routes/_authenticated/finance.banking.tsx:85` — `export const Route = createFileRoute("/_authenticated/finance/banking")({`
  - `src/routes/_authenticated/finance.banking.tsx:87` — `<HrScreenAccess resources={["techfinance.banking"]}>`
  - `src/routes/_authenticated/finance.banking.tsx:89` — `</HrScreenAccess>`
  - `src/lib/banking/providers/index.ts:6` — `export function resolveBankProvider(providerId: string, mode: string): BankProvider {`
  - `src/lib/banking/providers/index.ts:9` — `throw new Error("A simulação bancária está desativada neste ambiente.");`
  - `src/lib/banking/providers/index.ts:13` — `throw new Error(`
  - `drizzle/migrations/0212_banking_action_preparation.sql:18` — `DECLARE c jsonb:=finance_access_context();k text;BEGIN`
  - `drizzle/migrations/0212_banking_action_preparation.sql:22` — `CREATE OR REPLACE FUNCTION public.banking_authorize(_action text)`
  - `drizzle/migrations/0212_banking_action_preparation.sql:28` — `REVOKE ALL ON FUNCTION public.banking_access(uuid,text),public.banking_authorize(text) FROM PUBLIC,anon;`
  - `drizzle/migrations/0212_banking_action_preparation.sql:29` — `GRANT EXECUTE ON FUNCTION public.banking_access(uuid,text),public.banking_authorize(text) TO authenticated;`
  - `drizzle/migrations/0212_banking_action_preparation.sql:33` — `DECLARE w uuid:=banking_authorize('create_payment');c bank_connections;e financial_entries;v numeric:=(_data->>'amount')::numeric;out_id uuid;BEGIN`
  - `src/lib/banking.functions.ts:18` — `export const getBankConnection = createServerFn({ method: "GET" })`
  - `src/lib/banking.functions.ts:36` — `if (error) throw new Error(error.message);`
  - `src/lib/banking.functions.ts:57` — `export const startBankAuthorization = createServerFn({ method: "POST" })`
  - `src/lib/banking.functions.ts:63` — `mode: z.enum(["mock", "sandbox", "production"]).default("mock"),`
  - `src/lib/banking.functions.ts:83` — `mode: provider.mode,`

### 21. `gerenciar-pagamentos-bancarios` — Gerenciar rascunhos, aprovação e execução bancária
- Rota: `/finance/banking`. Mínimo atual: `techfinance.banking.view.workspace`.
- Seções: completas para howto.
- min_permission: leitura workspace coerente com o servidor; não concede escrita.
- Divergência / correção exata: **Evitar interpretação de transferência real**. Substituir “Pagamento percorre os estados permitidos; aprovação não equivale a execução e execução registrada não garante liquidação.” por “No único adaptador atual (Inter mock habilitado), o pagamento percorre estados simulados, sem transferência bancária real. Aprovação, execução e liquidação são etapas distintas.”
- Fontes concretas:
  - `src/routes/_authenticated/finance.banking.tsx:1` — `import { HrScreenAccess } from "@/components/hr-access";`
  - `src/routes/_authenticated/finance.banking.tsx:4` — `import { createFileRoute } from "@tanstack/react-router";`
  - `src/routes/_authenticated/finance.banking.tsx:85` — `export const Route = createFileRoute("/_authenticated/finance/banking")({`
  - `src/routes/_authenticated/finance.banking.tsx:87` — `<HrScreenAccess resources={["techfinance.banking"]}>`
  - `src/routes/_authenticated/finance.banking.tsx:89` — `</HrScreenAccess>`
  - `src/lib/banking.functions.ts:18` — `export const getBankConnection = createServerFn({ method: "GET" })`
  - `src/lib/banking.functions.ts:36` — `if (error) throw new Error(error.message);`
  - `src/lib/banking.functions.ts:57` — `export const startBankAuthorization = createServerFn({ method: "POST" })`
  - `src/lib/banking.functions.ts:63` — `mode: z.enum(["mock", "sandbox", "production"]).default("mock"),`
  - `src/lib/banking.functions.ts:83` — `mode: provider.mode,`
  - `src/lib/banking/providers/index.ts:6` — `export function resolveBankProvider(providerId: string, mode: string): BankProvider {`
  - `src/lib/banking/providers/index.ts:9` — `throw new Error("A simulação bancária está desativada neste ambiente.");`
  - `src/lib/banking/providers/index.ts:13` — `throw new Error(`
  - `drizzle/migrations/0212_banking_action_preparation.sql:18` — `DECLARE c jsonb:=finance_access_context();k text;BEGIN`
  - `drizzle/migrations/0212_banking_action_preparation.sql:22` — `CREATE OR REPLACE FUNCTION public.banking_authorize(_action text)`
  - `drizzle/migrations/0212_banking_action_preparation.sql:28` — `REVOKE ALL ON FUNCTION public.banking_access(uuid,text),public.banking_authorize(text) FROM PUBLIC,anon;`
  - `drizzle/migrations/0212_banking_action_preparation.sql:29` — `GRANT EXECUTE ON FUNCTION public.banking_access(uuid,text),public.banking_authorize(text) TO authenticated;`
  - `drizzle/migrations/0212_banking_action_preparation.sql:33` — `DECLARE w uuid:=banking_authorize('create_payment');c bank_connections;e financial_entries;v numeric:=(_data->>'amount')::numeric;out_id uuid;BEGIN`

### 22. `conciliar-transacoes` — Conciliar transações bancárias
- Rota: `/finance/banking/reconciliation`. Mínimo atual: `techfinance.banking.view.workspace`.
- Seções: completas para howto.
- min_permission: leitura workspace coerente com o servidor; não concede escrita.
- Afirmações: sem divergência funcional adicional confirmada na revisão estática; preservar as ressalvas de autorização e disponibilidade.
- Fontes concretas:
  - `src/routes/_authenticated/finance.banking.reconciliation.tsx:1` — `import { HrScreenAccess } from "@/components/hr-access";`
  - `src/routes/_authenticated/finance.banking.reconciliation.tsx:6` — `import { createFileRoute } from "@tanstack/react-router";`
  - `src/routes/_authenticated/finance.banking.reconciliation.tsx:54` — `export const Route = createFileRoute("/_authenticated/finance/banking/reconciliation")({`
  - `src/routes/_authenticated/finance.banking.reconciliation.tsx:56` — `<HrScreenAccess resources={["techfinance.banking"]}>`
  - `src/routes/_authenticated/finance.banking.reconciliation.tsx:58` — `</HrScreenAccess>`
  - `src/lib/banking/providers/index.ts:6` — `export function resolveBankProvider(providerId: string, mode: string): BankProvider {`
  - `src/lib/banking/providers/index.ts:9` — `throw new Error("A simulação bancária está desativada neste ambiente.");`
  - `src/lib/banking/providers/index.ts:13` — `throw new Error(`
  - `drizzle/migrations/0212_banking_action_preparation.sql:18` — `DECLARE c jsonb:=finance_access_context();k text;BEGIN`
  - `drizzle/migrations/0212_banking_action_preparation.sql:22` — `CREATE OR REPLACE FUNCTION public.banking_authorize(_action text)`
  - `drizzle/migrations/0212_banking_action_preparation.sql:28` — `REVOKE ALL ON FUNCTION public.banking_access(uuid,text),public.banking_authorize(text) FROM PUBLIC,anon;`
  - `drizzle/migrations/0212_banking_action_preparation.sql:29` — `GRANT EXECUTE ON FUNCTION public.banking_access(uuid,text),public.banking_authorize(text) TO authenticated;`
  - `drizzle/migrations/0212_banking_action_preparation.sql:33` — `DECLARE w uuid:=banking_authorize('create_payment');c bank_connections;e financial_entries;v numeric:=(_data->>'amount')::numeric;out_id uuid;BEGIN`
  - `src/lib/banking.functions.ts:18` — `export const getBankConnection = createServerFn({ method: "GET" })`
  - `src/lib/banking.functions.ts:36` — `if (error) throw new Error(error.message);`
  - `src/lib/banking.functions.ts:57` — `export const startBankAuthorization = createServerFn({ method: "POST" })`
  - `src/lib/banking.functions.ts:63` — `mode: z.enum(["mock", "sandbox", "production"]).default("mock"),`
  - `src/lib/banking.functions.ts:83` — `mode: provider.mode,`

### 23. `consultar-vendas-importadas` — Consultar vendas importadas
- Rota: `/finance/sales`. Mínimo atual: `techfinance.sales.view.workspace`.
- Seções: completas para howto.
- min_permission: leitura workspace coerente com o servidor; não concede escrita.
- Afirmações: sem divergência funcional adicional confirmada na revisão estática; preservar as ressalvas de autorização e disponibilidade.
- Fontes concretas:
  - `src/routes/_authenticated/finance.sales.tsx:2` — `import { createFileRoute, Link } from "@tanstack/react-router";`
  - `src/routes/_authenticated/finance.sales.tsx:7` — `import { HrScreenAccess } from "@/components/hr-access";`
  - `src/routes/_authenticated/finance.sales.tsx:25` — `export const Route = createFileRoute("/_authenticated/finance/sales")({`
  - `src/routes/_authenticated/finance.sales.tsx:43` — `<HrScreenAccess resources={["techfinance.sales"]}>`
  - `src/routes/_authenticated/finance.sales.tsx:45` — `</HrScreenAccess>`
  - `src/lib/finance-sales.functions.ts:7` — `export const listFinanceSales = createServerFn({ method: "POST" })`

### 24. `consultar-notas-fiscais` — Consultar NFS-e e arquivos disponíveis
- Rota: `/finance/nfse`. Mínimo atual: `techfinance.nfse.view.workspace`.
- Seções: completas para howto.
- min_permission: chave de leitura não é autorização da operação e não cobre as alternativas de escopo/recurso; aplicar a decisão transversal acima.
- Afirmações: sem divergência funcional adicional confirmada na revisão estática; preservar as ressalvas de autorização e disponibilidade.
- Verificação especial: listNfse limita 200; issueNfse autoriza invoices.view e lança erro antes de emitir/gravar. Não atribuir emissão habilitada a nfse_issuance nem ao comentário antigo sobre sandbox.
- Fontes concretas:
  - `src/routes/_authenticated/finance.nfse.tsx:1` — `import { authorizeFinanceBusinessExport } from "@/lib/access-control/finance-business.functions";`
  - `src/routes/_authenticated/finance.nfse.tsx:3` — `import { HrScreenAccess } from "@/components/hr-access";`
  - `src/routes/_authenticated/finance.nfse.tsx:4` — `import { createFileRoute, Link } from "@tanstack/react-router";`
  - `src/routes/_authenticated/finance.nfse.tsx:44` — `export const Route = createFileRoute("/_authenticated/finance/nfse")({`
  - `src/routes/_authenticated/finance.nfse.tsx:55` — `<HrScreenAccess resources={["techfinance.nfse"]}>`
  - `src/lib/nfse.functions.ts:1` — `import { authorizeFinanceBusiness } from "@/lib/access-control/finance-business.server";`
  - `src/lib/nfse.functions.ts:7` — `export const listNfse = createServerFn({ method: "POST" })`
  - `src/lib/nfse.functions.ts:18` — `await authorizeFinanceBusiness(context.supabase, "nfse", "view", undefined);`
  - `src/lib/nfse.functions.ts:30` — `if (error) throw new Error(error.message);`
  - `src/lib/nfse.functions.ts:38` — `export const issueNfse = createServerFn({ method: "POST" })`
  - `drizzle/migrations/0214_finance_business_prepare.sql:7` — `CREATE OR REPLACE FUNCTION public.finance_business_access(_ctx jsonb,_workspace uuid,_resource text,_action text,_responsible uuid DEFAULT NULL)`
  - `drizzle/migrations/0214_finance_business_prepare.sql:20` — `DECLARE c jsonb:=finance_access_context();w uuid:=(c->>'workspace')::uuid;r uuid;t text;BEGIN`
  - `drizzle/migrations/0214_finance_business_prepare.sql:32` — `IF NOT finance_business_access(c,w,_resource,_action,r) OR (_action<>'view' AND NOT finance_business_access(c,w,_resource,'view',r)) THEN RAISE EXCEPTION 'Ação financeira não `
  - `drizzle/migrations/0214_finance_business_prepare.sql:38` — `DECLARE c jsonb:=finance_access_context();w uuid:=(c->>'workspace')::uuid;out_rows jsonb;BEGIN`
  - `drizzle/migrations/0214_finance_business_prepare.sql:68` — `FOREACH f IN ARRAY ARRAY['public.finance_business_access(jsonb,uuid,text,text,uuid)'::regprocedure,'public.finance_business_authorize(text,text,uuid)'::regprocedure,'public.fi`
  - `drizzle/migrations/0215_finance_business_activate.sql:9` — `EXECUTE format('CREATE POLICY finance_business_view ON %I FOR SELECT TO authenticated USING(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''view'',`
  - `drizzle/migrations/0215_finance_business_activate.sql:10` — `EXECUTE format('CREATE POLICY finance_business_create ON %I FOR INSERT TO authenticated WITH CHECK(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''`
  - `drizzle/migrations/0215_finance_business_activate.sql:11` — `EXECUTE format('CREATE POLICY finance_business_update ON %I FOR UPDATE TO authenticated USING(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''updat`
  - `drizzle/migrations/0215_finance_business_activate.sql:12` — `EXECUTE format('CREATE POLICY finance_business_delete ON %I FOR DELETE TO authenticated USING(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''delet`
  - `drizzle/migrations/0215_finance_business_activate.sql:17` — `SELECT coalesce((SELECT finance_business_access(finance_access_context(),workspace_id,'invoices','view',coalesce(assigned_to,owner_id)) FROM customer_invoices WHERE id=_id AND`

### 25. `consultar-auditoria` — Consultar auditoria financeira
- Rota: `/finance/audit`. Mínimo atual: `techfinance.audit.view.workspace`.
- Seções: completas para howto.
- min_permission: leitura workspace coerente com o servidor; não concede escrita.
- Afirmações: sem divergência funcional adicional confirmada na revisão estática; preservar as ressalvas de autorização e disponibilidade.
- Fontes concretas:
  - `src/routes/_authenticated/finance.audit.tsx:2` — `import { HrScreenAccess } from "@/components/hr-access";`
  - `src/routes/_authenticated/finance.audit.tsx:3` — `import { createFileRoute } from "@tanstack/react-router";`
  - `src/routes/_authenticated/finance.audit.tsx:25` — `export const Route = createFileRoute("/_authenticated/finance/audit")({`
  - `src/routes/_authenticated/finance.audit.tsx:36` — `<HrScreenAccess resources={["techfinance.audit"]}>`
  - `src/routes/_authenticated/finance.audit.tsx:38` — `</HrScreenAccess>`
  - `src/lib/finance-audit.functions.ts:1` — `import { authorizeFinanceBusiness } from "@/lib/access-control/finance-business.server";`
  - `src/lib/finance-audit.functions.ts:9` — `export const financeAuditReport = createServerFn({ method: "POST" })`
  - `src/lib/finance-audit.functions.ts:20` — `await authorizeFinanceBusiness(context.supabase, "audit", "view", undefined);`
  - `src/lib/finance-audit.functions.ts:39` — `if (error) throw new Error(error.message);`
  - `drizzle/migrations/0214_finance_business_prepare.sql:7` — `CREATE OR REPLACE FUNCTION public.finance_business_access(_ctx jsonb,_workspace uuid,_resource text,_action text,_responsible uuid DEFAULT NULL)`
  - `drizzle/migrations/0214_finance_business_prepare.sql:20` — `DECLARE c jsonb:=finance_access_context();w uuid:=(c->>'workspace')::uuid;r uuid;t text;BEGIN`
  - `drizzle/migrations/0214_finance_business_prepare.sql:32` — `IF NOT finance_business_access(c,w,_resource,_action,r) OR (_action<>'view' AND NOT finance_business_access(c,w,_resource,'view',r)) THEN RAISE EXCEPTION 'Ação financeira não `
  - `drizzle/migrations/0214_finance_business_prepare.sql:38` — `DECLARE c jsonb:=finance_access_context();w uuid:=(c->>'workspace')::uuid;out_rows jsonb;BEGIN`
  - `drizzle/migrations/0214_finance_business_prepare.sql:68` — `FOREACH f IN ARRAY ARRAY['public.finance_business_access(jsonb,uuid,text,text,uuid)'::regprocedure,'public.finance_business_authorize(text,text,uuid)'::regprocedure,'public.fi`
  - `drizzle/migrations/0215_finance_business_activate.sql:9` — `EXECUTE format('CREATE POLICY finance_business_view ON %I FOR SELECT TO authenticated USING(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''view'',`
  - `drizzle/migrations/0215_finance_business_activate.sql:10` — `EXECUTE format('CREATE POLICY finance_business_create ON %I FOR INSERT TO authenticated WITH CHECK(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''`
  - `drizzle/migrations/0215_finance_business_activate.sql:11` — `EXECUTE format('CREATE POLICY finance_business_update ON %I FOR UPDATE TO authenticated USING(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''updat`
  - `drizzle/migrations/0215_finance_business_activate.sql:12` — `EXECUTE format('CREATE POLICY finance_business_delete ON %I FOR DELETE TO authenticated USING(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''delet`
  - `drizzle/migrations/0215_finance_business_activate.sql:17` — `SELECT coalesce((SELECT finance_business_access(finance_access_context(),workspace_id,'invoices','view',coalesce(assigned_to,owner_id)) FROM customer_invoices WHERE id=_id AND`

### 26. `gerenciar-faturas` — Gerenciar faturas
- Rota: `/invoices`. Mínimo atual: `techfinance.invoices.view.workspace`.
- Seções: completas para howto.
- min_permission: chave de leitura não é autorização da operação e não cobre as alternativas de escopo/recurso; aplicar a decisão transversal acima.
- Afirmações: sem divergência funcional adicional confirmada na revisão estática; preservar as ressalvas de autorização e disponibilidade.
- Fontes concretas:
  - `src/routes/_authenticated/invoices.tsx:2` — `import { authorizeFinanceBusinessExport } from "@/lib/access-control/finance-business.functions";`
  - `src/routes/_authenticated/invoices.tsx:3` — `import { HrScreenAccess } from "@/components/hr-access";`
  - `src/routes/_authenticated/invoices.tsx:12` — `import { createFileRoute } from "@tanstack/react-router";`
  - `src/routes/_authenticated/invoices.tsx:96` — `export const Route = createFileRoute("/_authenticated/invoices")({`
  - `src/routes/_authenticated/invoices.tsx:101` — `<HrScreenAccess resources={["techfinance.invoices", "techsales.invoices"]}>`
  - `src/lib/access-control/use-finance-business-capabilities.ts:12` — `export function useFinanceBusinessCapabilities(`
  - `drizzle/migrations/0214_finance_business_prepare.sql:7` — `CREATE OR REPLACE FUNCTION public.finance_business_access(_ctx jsonb,_workspace uuid,_resource text,_action text,_responsible uuid DEFAULT NULL)`
  - `drizzle/migrations/0214_finance_business_prepare.sql:20` — `DECLARE c jsonb:=finance_access_context();w uuid:=(c->>'workspace')::uuid;r uuid;t text;BEGIN`
  - `drizzle/migrations/0214_finance_business_prepare.sql:32` — `IF NOT finance_business_access(c,w,_resource,_action,r) OR (_action<>'view' AND NOT finance_business_access(c,w,_resource,'view',r)) THEN RAISE EXCEPTION 'Ação financeira não `
  - `drizzle/migrations/0214_finance_business_prepare.sql:38` — `DECLARE c jsonb:=finance_access_context();w uuid:=(c->>'workspace')::uuid;out_rows jsonb;BEGIN`
  - `drizzle/migrations/0214_finance_business_prepare.sql:68` — `FOREACH f IN ARRAY ARRAY['public.finance_business_access(jsonb,uuid,text,text,uuid)'::regprocedure,'public.finance_business_authorize(text,text,uuid)'::regprocedure,'public.fi`
  - `drizzle/migrations/0215_finance_business_activate.sql:9` — `EXECUTE format('CREATE POLICY finance_business_view ON %I FOR SELECT TO authenticated USING(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''view'',`
  - `drizzle/migrations/0215_finance_business_activate.sql:10` — `EXECUTE format('CREATE POLICY finance_business_create ON %I FOR INSERT TO authenticated WITH CHECK(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''`
  - `drizzle/migrations/0215_finance_business_activate.sql:11` — `EXECUTE format('CREATE POLICY finance_business_update ON %I FOR UPDATE TO authenticated USING(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''updat`
  - `drizzle/migrations/0215_finance_business_activate.sql:12` — `EXECUTE format('CREATE POLICY finance_business_delete ON %I FOR DELETE TO authenticated USING(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''delet`
  - `drizzle/migrations/0215_finance_business_activate.sql:17` — `SELECT coalesce((SELECT finance_business_access(finance_access_context(),workspace_id,'invoices','view',coalesce(assigned_to,owner_id)) FROM customer_invoices WHERE id=_id AND`

### 27. `consultar-faturamento-servicos` — Consultar faturamento de serviços
- Rota: `/services`. Mínimo atual: `techfinance.entries.view.own`.
- Seções: completas para howto.
- min_permission: chave de leitura não é autorização da operação e não cobre as alternativas de escopo/recurso; aplicar a decisão transversal acima.
- Divergência / correção exata: **Corrigir acesso do recurso compartilhado**. Substituir o parágrafo Quem pode fazer por “Membro autorizado a consultar techservice.services (view.own, view.team ou view.workspace), sujeito ao módulo e às políticas próprias de serviços. A permissão techfinance.entries.view controla o atalho financeiro, mas não autoriza esta consulta.”
- Fontes concretas:
  - `src/routes/_authenticated/services.index.tsx:1` — `import { HrScreenAccess as Order3ScreenAccess } from "@/components/hr-access";`
  - `src/routes/_authenticated/services.index.tsx:2` — `import { createFileRoute, Link } from "@tanstack/react-router";`
  - `src/routes/_authenticated/services.index.tsx:49` — `export const Route = createFileRoute("/_authenticated/services/")({`
  - `src/routes/_authenticated/services.index.tsx:107` — `function ServicesPage() {`
  - `src/routes/_authenticated/services.index.tsx:465` — `function Order3RouteAccess() {`
  - `src/lib/menu-config-finance.ts:23` — `export const FINANCE_SIDEBAR_GROUPS: SidebarGroup[] = [`
  - `src/lib/menu-config-finance.ts:32` — `permissionAny: MENU_PERMISSIONS.financeOverview,`
  - `src/lib/menu-config-finance.ts:44` — `permissionAny: MENU_PERMISSIONS.financeReceivable,`
  - `src/lib/menu-config-finance.ts:51` — `permissionAny: MENU_PERMISSIONS.financePayable,`
  - `src/lib/menu-config-finance.ts:58` — `permissionAny: MENU_PERMISSIONS.financeRecurrences,`
  - `src/lib/services.functions.ts:16` — `export const listServices = createServerFn({ method: "POST" })`
  - `src/lib/services.functions.ts:94` — `export const listServiceIds = createServerFn({ method: "POST" })`
  - `src/lib/services.functions.ts:125` — `export const getService = createServerFn({ method: "POST" })`
  - `src/lib/services.functions.ts:168` — `export const createService = createServerFn({ method: "POST" })`
  - `src/lib/services.functions.ts:183` — `if (!contract) throw new Error("Contrato não encontrado");`

### 28. `operar-servico` — Consultar e operar serviço faturável
- Rota: `/services/$id`. Mínimo atual: `techfinance.entries.view.own`.
- Seções: completas para howto.
- min_permission: chave de leitura não é autorização da operação e não cobre as alternativas de escopo/recurso; aplicar a decisão transversal acima.
- Divergência / correção exata: **Corrigir acesso e retirar pendência editorial**. Substituir Quem pode fazer pelo mesmo texto do artigo consultar-faturamento-servicos. Substituir “[CONFIRMAR] cron de faturamento e configuração efetivamente habilitados no ambiente.” por “A existência da ação não comprova que o agendamento automático esteja configurado no ambiente; confirme-o com a administração.”
- Fontes concretas:
  - `src/routes/_authenticated/services.$id.tsx:4` — `import { HrScreenAccess as Order3ScreenAccess } from "@/components/hr-access";`
  - `src/routes/_authenticated/services.$id.tsx:5` — `import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";`
  - `src/routes/_authenticated/services.$id.tsx:38` — `export const Route = createFileRoute("/_authenticated/services/$id")({`
  - `src/routes/_authenticated/services.$id.tsx:59` — `function ServiceDetail() {`
  - `src/routes/_authenticated/services.$id.tsx:61` — `const canBill =`
  - `src/lib/services.functions.ts:16` — `export const listServices = createServerFn({ method: "POST" })`
  - `src/lib/services.functions.ts:94` — `export const listServiceIds = createServerFn({ method: "POST" })`
  - `src/lib/services.functions.ts:125` — `export const getService = createServerFn({ method: "POST" })`
  - `src/lib/services.functions.ts:168` — `export const createService = createServerFn({ method: "POST" })`
  - `src/lib/services.functions.ts:183` — `if (!contract) throw new Error("Contrato não encontrado");`

### 29. `configurar-regua-cobranca` — Configurar régua de cobrança
- Rota: `/settings/dunning`. Mínimo atual: `techfinance.dunning.view.workspace`.
- Seções: completas para howto.
- min_permission: chave de leitura não é autorização da operação e não cobre as alternativas de escopo/recurso; aplicar a decisão transversal acima.
- Divergência / correção exata: **Retirar pendência editorial**. Substituir “[CONFIRMAR] agendamento, credenciais e execução dos canais no ambiente.” por “Salvar a régua não garante agendamento nem entrega: confirme com a administração a configuração e disponibilidade de cada canal.”
- Fontes concretas:
  - `src/routes/_authenticated/settings.dunning.tsx:3` — `import { HrScreenAccess } from "@/components/hr-access";`
  - `src/routes/_authenticated/settings.dunning.tsx:4` — `import { createFileRoute } from "@tanstack/react-router";`
  - `src/routes/_authenticated/settings.dunning.tsx:34` — `export const Route = createFileRoute("/_authenticated/settings/dunning")({`
  - `src/routes/_authenticated/settings.dunning.tsx:36` — `<HrScreenAccess resources={["techfinance.dunning"]}>`
  - `src/routes/_authenticated/settings.dunning.tsx:38` — `</HrScreenAccess>`
  - `src/lib/dunning.functions.ts:2` — `import { authorizeFinanceBusiness } from "@/lib/access-control/finance-business.server";`
  - `src/lib/dunning.functions.ts:17` — `export const listDunningRuns = createServerFn({ method: "GET" })`
  - `src/lib/dunning.functions.ts:20` — `await authorizeFinanceBusiness(context.supabase, "dunning", "view", undefined);`
  - `src/lib/dunning.functions.ts:28` — `if (error) throw new Error(error.message);`
  - `src/lib/dunning.functions.ts:32` — `export const listDunningPolicies = createServerFn({ method: "GET" })`
  - `drizzle/migrations/0214_finance_business_prepare.sql:7` — `CREATE OR REPLACE FUNCTION public.finance_business_access(_ctx jsonb,_workspace uuid,_resource text,_action text,_responsible uuid DEFAULT NULL)`
  - `drizzle/migrations/0214_finance_business_prepare.sql:20` — `DECLARE c jsonb:=finance_access_context();w uuid:=(c->>'workspace')::uuid;r uuid;t text;BEGIN`
  - `drizzle/migrations/0214_finance_business_prepare.sql:32` — `IF NOT finance_business_access(c,w,_resource,_action,r) OR (_action<>'view' AND NOT finance_business_access(c,w,_resource,'view',r)) THEN RAISE EXCEPTION 'Ação financeira não `
  - `drizzle/migrations/0214_finance_business_prepare.sql:38` — `DECLARE c jsonb:=finance_access_context();w uuid:=(c->>'workspace')::uuid;out_rows jsonb;BEGIN`
  - `drizzle/migrations/0214_finance_business_prepare.sql:68` — `FOREACH f IN ARRAY ARRAY['public.finance_business_access(jsonb,uuid,text,text,uuid)'::regprocedure,'public.finance_business_authorize(text,text,uuid)'::regprocedure,'public.fi`
  - `drizzle/migrations/0215_finance_business_activate.sql:9` — `EXECUTE format('CREATE POLICY finance_business_view ON %I FOR SELECT TO authenticated USING(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''view'',`
  - `drizzle/migrations/0215_finance_business_activate.sql:10` — `EXECUTE format('CREATE POLICY finance_business_create ON %I FOR INSERT TO authenticated WITH CHECK(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''`
  - `drizzle/migrations/0215_finance_business_activate.sql:11` — `EXECUTE format('CREATE POLICY finance_business_update ON %I FOR UPDATE TO authenticated USING(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''updat`
  - `drizzle/migrations/0215_finance_business_activate.sql:12` — `EXECUTE format('CREATE POLICY finance_business_delete ON %I FOR DELETE TO authenticated USING(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''delet`
  - `drizzle/migrations/0215_finance_business_activate.sql:17` — `SELECT coalesce((SELECT finance_business_access(finance_access_context(),workspace_id,'invoices','view',coalesce(assigned_to,owner_id)) FROM customer_invoices WHERE id=_id AND`

### 30. `gerenciar-templates-cobranca` — Gerenciar templates de cobrança
- Rota: `/settings/charging-templates`. Mínimo atual: `techfinance.charging_templates.view.workspace`.
- Seções: completas para howto.
- min_permission: chave de leitura não é autorização da operação e não cobre as alternativas de escopo/recurso; aplicar a decisão transversal acima.
- Afirmações: sem divergência funcional adicional confirmada na revisão estática; preservar as ressalvas de autorização e disponibilidade.
- Fontes concretas:
  - `src/routes/_authenticated/settings.charging-templates.tsx:3` — `import { HrScreenAccess } from "@/components/hr-access";`
  - `src/routes/_authenticated/settings.charging-templates.tsx:4` — `import { createFileRoute } from "@tanstack/react-router";`
  - `src/routes/_authenticated/settings.charging-templates.tsx:32` — `export const Route = createFileRoute("/_authenticated/settings/charging-templates")({`
  - `src/routes/_authenticated/settings.charging-templates.tsx:34` — `<HrScreenAccess resources={["techfinance.charging_templates"]}>`
  - `src/routes/_authenticated/settings.charging-templates.tsx:36` — `</HrScreenAccess>`
  - `src/lib/charging-templates.functions.ts:1` — `import { authorizeFinanceBusiness } from "@/lib/access-control/finance-business.server";`
  - `src/lib/charging-templates.functions.ts:17` — `export const listChargingTemplates = createServerFn({ method: "GET" })`
  - `src/lib/charging-templates.functions.ts:20` — `await authorizeFinanceBusiness(context.supabase, "charging_templates", "view", undefined);`
  - `src/lib/charging-templates.functions.ts:25` — `if (error) throw new Error(error.message);`
  - `src/lib/charging-templates.functions.ts:29` — `export const upsertChargingTemplate = createServerFn({ method: "POST" })`
  - `drizzle/migrations/0214_finance_business_prepare.sql:7` — `CREATE OR REPLACE FUNCTION public.finance_business_access(_ctx jsonb,_workspace uuid,_resource text,_action text,_responsible uuid DEFAULT NULL)`
  - `drizzle/migrations/0214_finance_business_prepare.sql:20` — `DECLARE c jsonb:=finance_access_context();w uuid:=(c->>'workspace')::uuid;r uuid;t text;BEGIN`
  - `drizzle/migrations/0214_finance_business_prepare.sql:32` — `IF NOT finance_business_access(c,w,_resource,_action,r) OR (_action<>'view' AND NOT finance_business_access(c,w,_resource,'view',r)) THEN RAISE EXCEPTION 'Ação financeira não `
  - `drizzle/migrations/0214_finance_business_prepare.sql:38` — `DECLARE c jsonb:=finance_access_context();w uuid:=(c->>'workspace')::uuid;out_rows jsonb;BEGIN`
  - `drizzle/migrations/0214_finance_business_prepare.sql:68` — `FOREACH f IN ARRAY ARRAY['public.finance_business_access(jsonb,uuid,text,text,uuid)'::regprocedure,'public.finance_business_authorize(text,text,uuid)'::regprocedure,'public.fi`
  - `drizzle/migrations/0215_finance_business_activate.sql:9` — `EXECUTE format('CREATE POLICY finance_business_view ON %I FOR SELECT TO authenticated USING(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''view'',`
  - `drizzle/migrations/0215_finance_business_activate.sql:10` — `EXECUTE format('CREATE POLICY finance_business_create ON %I FOR INSERT TO authenticated WITH CHECK(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''`
  - `drizzle/migrations/0215_finance_business_activate.sql:11` — `EXECUTE format('CREATE POLICY finance_business_update ON %I FOR UPDATE TO authenticated USING(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''updat`
  - `drizzle/migrations/0215_finance_business_activate.sql:12` — `EXECUTE format('CREATE POLICY finance_business_delete ON %I FOR DELETE TO authenticated USING(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''delet`
  - `drizzle/migrations/0215_finance_business_activate.sql:17` — `SELECT coalesce((SELECT finance_business_access(finance_access_context(),workspace_id,'invoices','view',coalesce(assigned_to,owner_id)) FROM customer_invoices WHERE id=_id AND`

### 31. `integracoes` — Integrações e limites operacionais
- Rota: `/settings/integrations/contaazul`. Mínimo atual: ``.
- Seções: estrutura de reference; sem exigência de esqueleto howto.
- min_permission: chave de leitura não é autorização da operação e não cobre as alternativas de escopo/recurso; aplicar a decisão transversal acima.
- Afirmações: sem divergência funcional adicional confirmada na revisão estática; preservar as ressalvas de autorização e disponibilidade.
- Fontes concretas:
  - `src/lib/finance.functions.ts:1` — `import { authorizeFinanceBusiness } from "@/lib/access-control/finance-business.server";`
  - `src/lib/finance.functions.ts:24` — `export const listFinancialEntries = createServerFn({ method: "POST" })`
  - `src/lib/finance.functions.ts:72` — `export const getFinancialEntry = createServerFn({ method: "POST" })`
  - `src/lib/finance.functions.ts:88` — `const paymentsVisible = await financeRpc<boolean>(supabase, "finance_payment_access", {`
  - `src/lib/finance.functions.ts:122` — `export const createFinancialEntry = createServerFn({ method: "POST" })`
  - `src/lib/menu-config-finance.ts:23` — `export const FINANCE_SIDEBAR_GROUPS: SidebarGroup[] = [`
  - `src/lib/menu-config-finance.ts:32` — `permissionAny: MENU_PERMISSIONS.financeOverview,`
  - `src/lib/menu-config-finance.ts:44` — `permissionAny: MENU_PERMISSIONS.financeReceivable,`
  - `src/lib/menu-config-finance.ts:51` — `permissionAny: MENU_PERMISSIONS.financePayable,`
  - `src/lib/menu-config-finance.ts:58` — `permissionAny: MENU_PERMISSIONS.financeRecurrences,`

### 32. `campos-e-status` — Referência de campos e status
- Rota: `/finance/entries/$id`. Mínimo atual: `techfinance.entries.view.own`.
- Seções: estrutura de reference; sem exigência de esqueleto howto.
- min_permission: chave de leitura não é autorização da operação e não cobre as alternativas de escopo/recurso; aplicar a decisão transversal acima.
- Afirmações: sem divergência funcional adicional confirmada na revisão estática; preservar as ressalvas de autorização e disponibilidade.
- Fontes concretas:
  - `src/components/finance/register-payment-dialog.tsx:40` — `export function RegisterPaymentDialog({`
  - `src/components/finance/register-payment-dialog.tsx:72` — `async function submit() {`
  - `src/components/finance/quick-create-entry-dialog.tsx:35` — `function addMonths(iso: string, n: number): string {`
  - `src/components/finance/quick-create-entry-dialog.tsx:45` — `function addDays(iso: string, n: number): string {`
  - `src/components/finance/quick-create-entry-dialog.tsx:52` — `export function QuickCreateEntryDialog({`
  - `src/components/finance/quick-create-entry-dialog.tsx:132` — `async function submit() {`
  - `src/components/finance/quick-create-entry-dialog.tsx:159` — `split_mode: splitMode,`
  - `src/lib/finance.functions.ts:1` — `import { authorizeFinanceBusiness } from "@/lib/access-control/finance-business.server";`
  - `src/lib/finance.functions.ts:24` — `export const listFinancialEntries = createServerFn({ method: "POST" })`
  - `src/lib/finance.functions.ts:72` — `export const getFinancialEntry = createServerFn({ method: "POST" })`
  - `src/lib/finance.functions.ts:88` — `const paymentsVisible = await financeRpc<boolean>(supabase, "finance_payment_access", {`
  - `src/lib/finance.functions.ts:122` — `export const createFinancialEntry = createServerFn({ method: "POST" })`

### 33. `permissoes` — Permissões do TechFinance
- Rota: `/finance`. Mínimo atual: ``.
- Seções: estrutura de reference; sem exigência de esqueleto howto.
- min_permission: chave de leitura não é autorização da operação e não cobre as alternativas de escopo/recurso; aplicar a decisão transversal acima.
- Afirmações: sem divergência funcional adicional confirmada na revisão estática; preservar as ressalvas de autorização e disponibilidade.
- Fontes concretas:
  - `drizzle/migrations/0210_finance_core_actions.sql:9` — `CREATE OR REPLACE FUNCTION public.finance_access_context()`
  - `drizzle/migrations/0210_finance_core_actions.sql:19` — `CREATE OR REPLACE FUNCTION public.finance_context_access(_ctx jsonb,_workspace uuid,_resource text,_action text,_responsible uuid DEFAULT NULL)`
  - `drizzle/migrations/0210_finance_core_actions.sql:29` — `CREATE OR REPLACE FUNCTION public.finance_scope_access(_workspace uuid,_resource text,_action text,_responsible uuid DEFAULT NULL)`
  - `drizzle/migrations/0210_finance_core_actions.sql:31` — `SELECT finance_context_access(finance_access_context(),_workspace,_resource,_action,_responsible)`
  - `drizzle/migrations/0210_finance_core_actions.sql:33` — `CREATE OR REPLACE FUNCTION public.finance_context_entry_access(_ctx jsonb,_workspace uuid,_action text,_responsible uuid)`
  - `drizzle/migrations/0212_banking_action_preparation.sql:18` — `DECLARE c jsonb:=finance_access_context();k text;BEGIN`
  - `drizzle/migrations/0212_banking_action_preparation.sql:22` — `CREATE OR REPLACE FUNCTION public.banking_authorize(_action text)`
  - `drizzle/migrations/0212_banking_action_preparation.sql:28` — `REVOKE ALL ON FUNCTION public.banking_access(uuid,text),public.banking_authorize(text) FROM PUBLIC,anon;`
  - `drizzle/migrations/0212_banking_action_preparation.sql:29` — `GRANT EXECUTE ON FUNCTION public.banking_access(uuid,text),public.banking_authorize(text) TO authenticated;`
  - `drizzle/migrations/0212_banking_action_preparation.sql:33` — `DECLARE w uuid:=banking_authorize('create_payment');c bank_connections;e financial_entries;v numeric:=(_data->>'amount')::numeric;out_id uuid;BEGIN`
  - `drizzle/migrations/0214_finance_business_prepare.sql:7` — `CREATE OR REPLACE FUNCTION public.finance_business_access(_ctx jsonb,_workspace uuid,_resource text,_action text,_responsible uuid DEFAULT NULL)`
  - `drizzle/migrations/0214_finance_business_prepare.sql:20` — `DECLARE c jsonb:=finance_access_context();w uuid:=(c->>'workspace')::uuid;r uuid;t text;BEGIN`
  - `drizzle/migrations/0214_finance_business_prepare.sql:32` — `IF NOT finance_business_access(c,w,_resource,_action,r) OR (_action<>'view' AND NOT finance_business_access(c,w,_resource,'view',r)) THEN RAISE EXCEPTION 'Ação financeira não `
  - `drizzle/migrations/0214_finance_business_prepare.sql:38` — `DECLARE c jsonb:=finance_access_context();w uuid:=(c->>'workspace')::uuid;out_rows jsonb;BEGIN`
  - `drizzle/migrations/0214_finance_business_prepare.sql:68` — `FOREACH f IN ARRAY ARRAY['public.finance_business_access(jsonb,uuid,text,text,uuid)'::regprocedure,'public.finance_business_authorize(text,text,uuid)'::regprocedure,'public.fi`
  - `src/lib/help/help-access.ts:6` — `export const HELP_MODULE_KEYS = [`
  - `src/lib/help/help-access.ts:18` — `export const HELP_MODULE_LABELS: Record<HelpModuleKey, { name: string; description: string }> = {`
  - `src/lib/help/help-access.ts:41` — `export const HELP_ARTICLE_TYPES = [`
  - `src/lib/help/help-access.ts:51` — `export const HELP_ARTICLE_TYPE_LABELS: Record<HelpArticleType, string> = {`
  - `src/lib/help/help-access.ts:61` — `export const HELP_EDIT_KEYS = [`

### 34. `erros-comuns` — Erros comuns do TechFinance
- Rota: `/finance`. Mínimo atual: ``.
- Seções: estrutura de troubleshooting; sem exigência de esqueleto howto.
- min_permission: chave de leitura não é autorização da operação e não cobre as alternativas de escopo/recurso; aplicar a decisão transversal acima.
- Afirmações: sem divergência funcional adicional confirmada na revisão estática; preservar as ressalvas de autorização e disponibilidade.
- Fontes concretas:
  - `src/lib/nfse.functions.ts:1` — `import { authorizeFinanceBusiness } from "@/lib/access-control/finance-business.server";`
  - `src/lib/nfse.functions.ts:7` — `export const listNfse = createServerFn({ method: "POST" })`
  - `src/lib/nfse.functions.ts:18` — `await authorizeFinanceBusiness(context.supabase, "nfse", "view", undefined);`
  - `src/lib/nfse.functions.ts:30` — `if (error) throw new Error(error.message);`
  - `src/lib/nfse.functions.ts:38` — `export const issueNfse = createServerFn({ method: "POST" })`
  - `src/lib/banking/providers/index.ts:6` — `export function resolveBankProvider(providerId: string, mode: string): BankProvider {`
  - `src/lib/banking/providers/index.ts:9` — `throw new Error("A simulação bancária está desativada neste ambiente.");`
  - `src/lib/banking/providers/index.ts:13` — `throw new Error(`
  - `src/lib/access-control/finance-records.server.ts:3` — `export async function financeRpc<T>(`
  - `src/lib/access-control/finance-records.server.ts:14` — `if (result.error) throw new Error(result.error.message);`
  - `src/lib/access-control/finance-records.server.ts:18` — `export async function assertFinanceEntry(`
  - `src/lib/access-control/finance-records.server.ts:24` — `(await financeRpc(client, "finance_entry_access", { _entry: id, _action: action })) !== true`
  - `src/lib/access-control/finance-records.server.ts:26` — `throw new Error("Lançamento indisponível ou sem permissão para esta ação.");`

### 35. `perguntas-frequentes` — Perguntas frequentes do TechFinance
- Rota: `/finance`. Mínimo atual: ``.
- Seções: estrutura de faq; sem exigência de esqueleto howto.
- min_permission: chave de leitura não é autorização da operação e não cobre as alternativas de escopo/recurso; aplicar a decisão transversal acima.
- Afirmações: sem divergência funcional adicional confirmada na revisão estática; preservar as ressalvas de autorização e disponibilidade.
- Fontes concretas:
  - `src/lib/nfse.functions.ts:1` — `import { authorizeFinanceBusiness } from "@/lib/access-control/finance-business.server";`
  - `src/lib/nfse.functions.ts:7` — `export const listNfse = createServerFn({ method: "POST" })`
  - `src/lib/nfse.functions.ts:18` — `await authorizeFinanceBusiness(context.supabase, "nfse", "view", undefined);`
  - `src/lib/nfse.functions.ts:30` — `if (error) throw new Error(error.message);`
  - `src/lib/nfse.functions.ts:38` — `export const issueNfse = createServerFn({ method: "POST" })`
  - `src/lib/banking/providers/index.ts:6` — `export function resolveBankProvider(providerId: string, mode: string): BankProvider {`
  - `src/lib/banking/providers/index.ts:9` — `throw new Error("A simulação bancária está desativada neste ambiente.");`
  - `src/lib/banking/providers/index.ts:13` — `throw new Error(`
  - `src/lib/finance-recurrences.functions.ts:37` — `export const listRecurrences = createServerFn({ method: "POST" })`
  - `src/lib/finance-recurrences.functions.ts:66` — `can_generate: boolean;`
  - `src/lib/finance-recurrences.functions.ts:79` — `export const getRecurrence = createServerFn({ method: "POST" })`
  - `src/lib/finance-recurrences.functions.ts:93` — `export const upsertRecurrence = createServerFn({ method: "POST" })`
  - `src/lib/finance-recurrences.functions.ts:140` — `export const toggleRecurrence = createServerFn({ method: "POST" })`

## Validações finais
- Artigos lidos: 35; slugs únicos: 35.
- Links locais para slugs ausentes: nenhum.
- Não foram executados testes, builds, importações, chamadas bancárias/fiscais ou consultas ao banco: tarefa documental e somente leitura.
- Evidência de autorização é a implementação + migrations versionadas; configuração real de licença, implantação e agendamento exige validação no ambiente.
- Correções propostas são somente conteúdo/metadados no JSON; nenhuma foi aplicada.

## Âncoras decisivas adicionais (prevalecem sobre comentários e boilerplate)
- Baixas, artigos 9–10: `src/lib/finance.functions.ts:224-281` (registerPayment/deletePayment); `drizzle/migrations/0210_finance_core_actions.sql:44-63` (finance_context_payment_access e capacidades). Pagamentos usam permissões próprias combinadas com leitura do título.
- Parcelas, artigos 7–8: `drizzle/migrations/0210_finance_core_actions.sql:102-120`, finance_delete_installments: ausência de delete em qualquer parcela aborta o grupo; não significa simplesmente “pular as sem autorização”.
- Recorrências, artigo 11: `src/lib/finance-recurrences.functions.ts:192-249` (capacidade can_generate, até 24 avanços e retorno generated/skipped/errors); `drizzle/migrations/0210_finance_core_actions.sql:125-175` (lock, permissões, avanço atômico, exclusão condicionada nas capacidades).
- DRE, artigo 12: `src/lib/finance.functions.ts:547-710`, especialmente 609–684: >=2 CNPJs ativa eliminação; caixa soma financial_payments.amount por paid_at e competência soma financial_entries.amount por competence_date; ambos excluem cancelados.
- Inter, artigos 19–22: `src/lib/banking/providers/index.ts:1-16` (apenas inter/mock e chave de habilitação); `drizzle/migrations/0212_banking_action_preparation.sql:3-20` (mapeamento de cada ação). Não prometer sandbox/produção a partir dos valores do enum da API.
- NFS-e, artigos 24 e 26: `src/lib/nfse.functions.ts:38-54`: issueNfse verifica leitura da fatura e sempre lança indisponibilidade. O comentário imediatamente anterior sobre stub não descreve o handler atual.
- Serviços, artigos 27–28: `src/lib/services.functions.ts:16-38` exige techservice.services.view em middleware e assertAnyPermission; `src/routes/_authenticated/services.$id.tsx:59-68` exige billing.manage.workspace + entries.create.(own|workspace) + entries.view.(own|workspace) para canBill. Informar essas combinações em vez de dizer somente “chaves financeiras”.
- Ajuda, todos os artigos: `src/lib/help/help-access.ts:109-122`: min_permission é filtro de leitura do artigo por igualdade exata, nunca autorização para executar a operação descrita.

### Esclarecimento sobre a classificação dos mínimos
Os mínimos dos artigos 27 e 28 não são apenas incompletos por escopo: apontam para o recurso errado para consultar /services. Sem suporte a OR no metadado, a recomendação de null é uma opção editorial explícita para permitir ler a documentação, não uma afirmação de que a rota é pública. Se for obrigatório manter uma chave não nula, escolher uma chave techservice.services.view do público pretendido, reconhecendo que isso ocultará o artigo de outros escopos legítimos. O mesmo cuidado se aplica a techsales.invoices no artigo 26.
