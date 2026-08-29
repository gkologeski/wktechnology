# Configurações no padrão HubSpot: tudo dentro de /settings

## Problema (confirmado no código)

No menu de Configurações (`SETTINGS_GROUPS` em `src/lib/menu-config.ts`) vários itens levam para rotas fora de `/settings`, o que troca a tela inteira e derruba o shell de Configurações:

- `Integrações` → `/integrations`
- `Marketplace` → `/marketplace`
- `Importar HubSpot` → `/leads/import-hubspot` (que redireciona para `/integrations/hubspot`)
- `Sync HubSpot` → `/settings/hubspot-sync` (rota que redireciona para fora, para `/integrations/hubspot`)
- Grupo `Plataforma` → `/admin/status`, `/admin/alerts`, `/admin/security-scans`, `/admin/quotas`, `/admin/sandbox`
- `Meus chamados` → `/my-bug-reports`

## Princípio adotado (mecânica do HubSpot)

Configuração vive em Configurações. O usuário entra em `/settings`, e tudo que é configuração — incluindo Integrações, Marketplace, Importações e as telas de Plataforma — é renderizado **dentro** do shell de Configurações, com o cabeçalho/abas/chips sempre visíveis. O caminho inverso também vale: qualquer atalho de configuração exibido em telas operacionais (Leads, Negócios, Reuniões, Prospecção, etc.) "salta" para `/settings/...` e o usuário passa a navegar dentro de Configurações.

## O que será feito

1. **Trazer as telas de configuração para dentro de `/settings`** (rotas filhas do shell, reaproveitando os componentes de página já existentes, sem duplicar lógica):
   - `/settings/integrations` e `/settings/integrations/$slug` (catálogo e detalhe de integração)
   - `/settings/marketplace` e `/settings/marketplace/$slug`
   - `/settings/import` — hub de importações, com HubSpot como primeira fonte (Importar HubSpot passa a ser configuração de fato)
   - `/settings/platform/status`, `/settings/platform/alerts`, `/settings/platform/security`, `/settings/platform/quotas`, `/settings/platform/sandbox` (grupo Plataforma, ainda restrito a super-admin)
   - `/settings/my-tickets` (Meus chamados)
2. **Rotas antigas passam a redirecionar** para os novos caminhos em `/settings/...` (`/integrations`, `/integrations/$slug`, `/marketplace`, `/marketplace/$slug`, `/leads/import-hubspot`, `/admin/status|alerts|security-scans|quotas|sandbox`, `/my-bug-reports`), preservando bookmarks e links antigos. Nada é removido nem perde acesso.
3. **`/settings/hubspot-sync` deixa de sair do contexto**: passa a redirecionar para `/settings/integrations/hubspot`.
4. **Atualizar todos os apontamentos de menu** para os novos caminhos:
   - `SETTINGS_GROUPS` (itens acima)
   - sidebars de módulo (`menu-config.ts`, `menu-config-erp.ts`) — itens que são configuração apontam para `/settings/...`
   - engrenagem do header (`settings-menu.tsx`), busca do shell de Configurações, seletor mobile e comandos da busca global (`global-search/commands.ts`)
5. **Sinalização de contexto**: dentro de `/settings`, o grupo/chip do item aberto fica ativo sempre (inclusive nas telas migradas), então o usuário nunca "perde" o menu de Configurações. Atalhos de configuração em telas operacionais recebem um indicador discreto de que levam para Configurações.

## Fora de escopo

Sem mudanças de schema, RLS, permissões ou regras de negócio. As páginas migradas mantêm exatamente a mesma funcionalidade e as mesmas checagens de acesso (`need`/`permissionAny`, super-admin em Plataforma); somente a rota e o enquadramento visual mudam.

## Detalhes técnicos

- Novos arquivos de rota em `src/routes/_authenticated/settings.*.tsx` que apenas montam os componentes de página existentes (`integrations.index`, `marketplace.index`, `marketplace.$slug`, `admin.quotas`, etc.), mantendo o gate `_authenticated` e o layout de `settings.tsx`.
- Rotas antigas convertidas em `beforeLoad: () => { throw redirect({ to: ..., replace: true }) }`.
- `menu-config.ts`: grupo `Integrações` ganha `Importar` e passa a apontar para `/settings/integrations` e `/settings/marketplace`; grupo `Plataforma` aponta para `/settings/platform/*`; `Conta` aponta para `/settings/my-tickets`.
- `menu-config-erp.ts` e `WORKSPACE_ROUTE_PREFIXES` revisados para continuarem reconhecendo os prefixos antigos (redirects) e os novos.
- Componentes de página não são reescritos; se algum deles hoje renderiza seu próprio `PageHeader` com espaçamento de página cheia, apenas o container é ajustado para o padrão interno de Configurações.

## Validação

- `bunx tsgo --noEmit`, ESLint nos arquivos alterados e `bun run test`.
- Playwright: a partir de `/settings/branding`, abrir Integrações, Marketplace, Importar e Plataforma e confirmar que o cabeçalho/abas de Configurações permanecem visíveis e o chip correto fica ativo; acessar as URLs antigas (`/integrations`, `/marketplace`, `/leads/import-hubspot`, `/admin/quotas`, `/my-bug-reports`) e confirmar o redirect para `/settings/...`.
