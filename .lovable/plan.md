# Configurações: tratar itens que navegam para fora de /settings

## Diagnóstico (confirmado no código)

Em `src/lib/menu-config.ts` (`SETTINGS_GROUPS`), alguns itens do menu de Configurações apontam para rotas fora de `/settings`, trocando a tela inteira e tirando o usuário do contexto:

- **Integrações**: `Marketplace` → `/marketplace`, `Integrações` → `/integrations`, `Importar HubSpot` → `/leads/import-hubspot`, `Sync HubSpot` → `/settings/hubspot-sync` que **redireciona** para `/integrations/$slug` (saída "surpresa").
- **Plataforma**: todos os itens → `/admin/*` (Status, Alertas, Segurança, Quotas, Sandbox).
- **Conta**: `Meus chamados` → `/my-bug-reports`.

Os redirects legados de prospecção (`/settings/scoring` etc. → `/prospecting`) existem apenas como rotas de compatibilidade, sem itens de menu — não fazem parte do problema visível.

## Sugestão (o que será implementado)

Princípio: **dentro de Configurações, tudo fica em /settings; o que sai do contexto é sinalizado visualmente e/ou removido do menu**.

1. **Adicionar flag `external?: boolean`** ao tipo `SettingsItem` em `menu-config.ts`.
2. **Sinalizar visualmente os itens externos**: no shell `/settings` (chips/abas) e no dropdown da engrenagem (`settings-menu.tsx`), itens com `external` ganham ícone `ArrowUpRight` + texto auxiliar discreto ("abre fora de Configurações") — o usuário sabe que vai trocar de tela antes de clicar.
3. **Corrigir o "salto surpresa" do Sync HubSpot**: o item passa a apontar diretamente para `/integrations/hubspot` com `external: true` (o redirect da rota é mantido para bookmarks).
4. **Reclassificar itens que não são configuração**:
   - `Importar HubSpot` → sai do grupo Integrações; mantido acessível pela área de Leads e pela engrenagem, com `external: true` se permanecer em algum grupo.
   - `Marketplace` e `Integrações` → permanecem no grupo, mas marcados como `external`.
5. **Grupo Plataforma**: renomear rótulo para "Plataforma (admin)" e marcar todos os itens como `external` — deixa claro que é uma área separada de super-admin.
6. **Busca e seletor mobile**: itens externos aparecem com o mesmo indicador `ArrowUpRight`.

## Fora de escopo

Sem mudanças de rotas, redirects legados, permissões, schema ou regras de negócio. Nenhum item perde acesso — apenas sinalização visual e ajuste de destino do Sync HubSpot.

## Detalhes técnicos

- `src/lib/menu-config.ts`: tipo `SettingsItem` + flag `external` nos itens afetados; item Sync HubSpot aponta para `/integrations/hubspot` (rota existente `/integrations/$slug`).
- `src/routes/_authenticated/settings.tsx`: chip do item externo exibe `ArrowUpRight`; ao trocar de grupo via aba, itens externos continuam contando como "primeira opção" apenas se forem a única opção — caso contrário a navegação automática prefere o primeiro item interno (evita sair de /settings por acidente ao clicar no grupo).
- `src/components/settings-menu.tsx`: mesmo indicador nos itens do dropdown.

## Validação

- `bunx tsgo --noEmit` e ESLint nos arquivos alterados.
- Playwright: abrir `/settings/branding`, conferir que os itens externos mostram o indicador; clicar no grupo "Integrações" não sai de /settings quando houver item interno disponível; clicar em "Marketplace" navega para fora de forma sinalizada.
