
# Home unificada do ERP

Criar uma tela principal que funcione como **home da aplicação** ao entrar no sistema (host neutro / workspace), aglutinando:

1. **Módulos contratados** (TechSales/CRM, TechHire/ATS e futuros) — cada um como cartão de entrada premium, com status (ativo, disponível, bloqueado), KPIs curtos e ação "Entrar".
2. **Configurações do workspace** — todas as configurações comuns a todos os módulos (membros, papéis, billing, branding, API keys, idioma, webhooks, audit log, módulos contratados).
3. **Identidade do workspace** — nome, logo, plano vigente, ambiente (produção/sandbox) e atalhos rápidos.

## Escopo

- Nova rota `/_authenticated/home` como **home oficial da aplicação em host neutro** (workspace).
- Redirecionar `/` (raiz autenticada) para `/home` quando o usuário estiver em host neutro/workspace. Em hosts de módulo (crm.*, ats.*) continua indo para o `defaultRoute` do módulo — não altera comportamento existente.
- Reaproveitar e ampliar o conteúdo de `/workspace` (hoje `workspace.index.tsx`), tornando-o parte da nova home. Manter `/workspace` como alias que redireciona para `/home` para não quebrar links.
- Não altera RLS, schema, autenticação, server functions nem regras de negócio.

## Estrutura da tela

```text
┌─────────────────────────────────────────────────────────────┐
│ HERO: logo + nome workspace | plano | ambiente | ações      │
├─────────────────────────────────────────────────────────────┤
│ MÓDULOS                                                     │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐               │
│  │ TechSales  │ │ TechHire   │ │ + Explorar │               │
│  │ CRM        │ │ ATS        │ │ marketplace│               │
│  │ [Entrar]   │ │ [Entrar]   │ │            │               │
│  └────────────┘ └────────────┘ └────────────┘               │
├─────────────────────────────────────────────────────────────┤
│ CONFIGURAÇÕES DO WORKSPACE (grid por grupos)                │
│  Pessoas       Faturamento     Identidade    Segurança      │
│  · Membros     · Plano         · Branding    · Papéis       │
│  · Times       · Faturas       · Idioma      · API Keys     │
│  · Convites    · Uso           · Domínio     · Audit Log    │
│                                              · Webhooks     │
│  Integrações   Dados                                        │
│  · Módulos     · Importação                                 │
│  · Marketplace · Exportação                                 │
│                · Residência                                 │
├─────────────────────────────────────────────────────────────┤
│ ATIVIDADE RECENTE (opcional, leve): últimos convites,       │
│ últimas faturas, últimas alterações de configuração         │
└─────────────────────────────────────────────────────────────┘
```

## Componentes (design system TechHire / quiet premium)

Usar apenas componentes oficiais e tokens semânticos de `src/styles.css`:

- `PageHeader` (ou `ProductPageHeader` neutro do workspace) para o hero.
- `SectionHeader` para "Módulos", "Configurações", "Atividade recente".
- `MetricCard` para KPIs opcionais do workspace (membros ativos, módulos ativos, plano).
- Cartões de módulo com `StatusBadge` (Ativo / Disponível / Não contratado).
- Grid responsivo (1 / 2 / 4 colunas) para configurações agrupadas.
- `EmptyState`, `LoadingSkeleton` fiel ao layout e `ErrorState` com próxima ação.
- `Link` do TanStack Router com `to` tipado (sem `<a href>`).

## Fonte de dados (apenas leitura, sem novas mutações)

Reutilizar server functions já existentes; nada de queries em componente presentacional:

- Módulos contratados: `src/lib/modules/workspace-modules.functions.ts`.
- Branding e nome do workspace: `src/lib/modules/module-branding.functions.ts` + hook/service já usado por `ProductPageHeader`.
- Plano/uso: server functions já usadas em `/settings/billing` (só leitura resumida).
- Membros: contagem via server function usada em `/settings/workspace-team`.

Se algum resumo ainda não tiver server function pronta, o cartão entra com `EmptyState` ("Configurar") apontando para a tela responsável — sem criar backend novo neste escopo.

## Roteamento

- Novo arquivo: `src/routes/_authenticated/home.tsx` → `createFileRoute("/_authenticated/home")`.
- Ajustar `src/routes/_authenticated/index.tsx` (ou criar, se ausente) para redirecionar `/` autenticado para `/home` **apenas em host neutro**; em hosts de módulo, redirecionar para `MODULES[id].defaultRoute` (lógica já existente em `src/lib/modules/active-module.ts` / `src/lib/hosts.ts`).
- `src/routes/_authenticated/workspace.index.tsx` passa a redirecionar para `/home` (mantém URL antiga funcionando).
- Atualizar `ModuleSwitcher` e sidebar para incluir link "Home" apontando para `/home` no shell neutro.

## Detalhes técnicos

- **Host-aware**: usar `src/lib/hosts.ts` para decidir se é workspace neutro. Não quebrar deep links de módulos.
- **Permissões**: cartões de configuração sensíveis (Billing, Papéis, API Keys, Audit) só aparecem para `admin` — checar via hook de role já existente (`useWorkspaceRole` / `has_role`). Não é gate de segurança, apenas UX; RLS continua sendo a fonte de verdade.
- **Estados**: cada seção com `LoadingSkeleton` próprio; hero com skeleton para nome/logo do workspace.
- **Acessibilidade**: foco visível, `aria-label` em cartões clicáveis, ordem de tabulação lógica, contraste em light/dark.
- **Sem novas dependências**, sem mudanças em `src/integrations/supabase/*`, sem migrations.

## Arquivos previstos

Criados:
- `src/routes/_authenticated/home.tsx`
- `src/components/workspace/home-hero.tsx`
- `src/components/workspace/modules-grid.tsx`
- `src/components/workspace/workspace-settings-grid.tsx`
- `src/components/workspace/recent-activity-card.tsx` (opcional)

Alterados:
- `src/routes/_authenticated/index.tsx` (redirecionamento host-aware para `/home`)
- `src/routes/_authenticated/workspace.index.tsx` (redireciona para `/home`)
- Sidebar/`ModuleSwitcher` para incluir atalho "Home".

Removidos: nenhum.

## Fora de escopo

- Não altera módulos internos (TechSales/TechHire).
- Não cria novas server functions, migrations ou RLS.
- Não altera fluxo de convites, billing ou branding — apenas os expõe como cartões navegáveis.
- Não mexe em rotas de módulo (`(ats)`, `/dashboard` do CRM etc.).

## Como validar manualmente

1. Login em host neutro → cai em `/home` com hero + módulos + configurações.
2. Login em `crm.*` ou `ats.*` → continua indo para o `defaultRoute` do módulo (sem regressão).
3. Clique em cada cartão de módulo → entra no módulo correto.
4. Clique em cada cartão de configuração → abre a tela existente correspondente.
5. `/workspace` redireciona para `/home`.
6. Usuário não-admin não vê cartões restritos.
7. Light/dark, desktop/tablet/mobile ok.
