## Diagnóstico

Hoje o mesmo item aparece em 3 lugares — Sidebar do ERP, Home (`/home`) e Configurações (`/settings`) — sem hierarquia clara. Duplicações atuais:

| Item | Sidebar ERP | Home | Configurações |
|---|---|---|---|
| Marketplace | ✓ | ✓ (grid + card "Explorar") | ✓ |
| Faturas | ✓ | ✓ | — |
| Membros (`/settings/teams`) | ✓ | ✓ | ✓ |
| Controle de Acesso (`/home/access`) | ✓ | ✓ | ✓ |
| Configurações | ✓ | (botão) | ✓ (é a própria) |
| Integrações | — | ✓ | ✓ |
| Branding / Idioma / Billing / Segurança / API Keys / Webhooks / Auditoria / Notificações / Importar / Exportar / Privacidade / Residência / Módulos | — | ✓ | ✓ |

Além disso, `settings.index.tsx` repete grupos que já estão no menu lateral de configurações (`settings.tsx`), gerando um 4º nível de duplicação dentro do próprio /settings.

## Princípio de organização

Cada destino tem **um único lar canônico**:

- **Sidebar ERP** = trilho de navegação primária. Só atalhos de alto nível para áreas do workspace.
- **Home (`/home`)** = dashboard/launcher. Módulos + KPIs + poucos atalhos curados. Não reproduz o menu de configurações.
- **Configurações (`/settings`)** = fonte única e completa de todas as configurações administrativas do workspace, com sua própria sidebar interna (`settings.tsx`) já bem estruturada.

## Mudanças

### 1. Sidebar ERP — `src/lib/menu-config-erp.ts`

Reduzir para apenas os atalhos primários. Remover Membros e Controle de acesso (vivem em Configurações → Pessoas & Acesso).

```
ERP:        Home · Marketplace · Faturas
Workspace:  Configurações
```

### 2. Home — `src/routes/_authenticated/home.index.tsx`

Remover completamente a `SettingsGrid` (6 grupos × 3-4 cards = 21 links duplicados com /settings).

Manter:
- `PageHeader` com botões "Gerenciar módulos" e "Todas as configurações" (já existe).
- 3 MetricCards (Módulos ativos, contratados, Status).
- `ModulesGrid` (identidade da Home).
- Uma única seção curada **"Atalhos"** com 4 cards estáveis: Membros, Controle de Acesso, Marketplace, Faturas. Serve como onboarding rápido; qualquer coisa além disso vive em `/settings`.
- Remover o rodapé "As configurações acima…" (some com o grid).

### 3. Configurações (índice) — `src/routes/_authenticated/settings.index.tsx`

Remover os 3 grupos `GROUPS` (Workspace ERP / CRM / ATS) porque duplicam a sidebar de configurações à esquerda (`settings.tsx`). Manter só:
- Cabeçalho "Configurações".
- Card "Meu perfil" (email + nome + salvar) — já existe e é útil como landing.
- Um bloco discreto de "Continue de onde parou" **opcional** com 3 links (Membros, Branding, Billing) — pode ficar ou não; proposta é remover para máxima clareza.

Manter `settings.tsx` (sidebar de configurações) intocado — já é a estrutura canônica.

### 4. Ajustes de consistência

- Nenhuma alteração em rotas, server functions, RLS, permissões ou lógica de negócio.
- Testes de `menu-config.test.ts` continuam válidos (não mexemos em `SIDEBAR_GROUPS`/`SETTINGS_GROUPS` de módulos).
- Global search (`commands.ts`) já aponta cada item para seu destino em `/settings/*` — nada a mudar.

## Resultado

- **Sidebar ERP**: 4 itens (era 6). Sem duplicação com Configurações.
- **Home**: dashboard de módulos + 4 atalhos curados. Sem repetir menu de settings.
- **Configurações**: única fonte completa via sidebar interna. Página inicial limpa (perfil).

## Arquivos alterados

- `src/lib/menu-config-erp.ts` — remover Membros e Controle de acesso do trilho.
- `src/routes/_authenticated/home.index.tsx` — remover `SETTING_GROUPS`/`SettingsGrid`, adicionar seção "Atalhos" curada (4 cards).
- `src/routes/_authenticated/settings.index.tsx` — remover `GROUPS`, manter só cabeçalho + perfil.

## Validação

- `bunx tsgo --noEmit`
- `bun run test` (menu-config.test.ts)
- Manual: navegar Sidebar → Home → Configurações e conferir que cada item existe em exatamente 1 lugar (exceto Marketplace/Faturas/Membros/Acesso que reaparecem só como "atalho" curado na Home).
