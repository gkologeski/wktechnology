# Atualizar teste de menu e expandir a matriz do diagnóstico de RBAC

Duas tarefas pequenas e independentes.

## 1. `src/lib/menu-config.test.ts` — remover expectativas obsoletas

A execução atual do teste falha em 4 casos, sempre pelas mesmas duas URLs que não existem mais no menu:

- `/prospecting/campaigns` (listada em `SIDEBAR_MANAGER_PLUS`) — a Prospecção hoje é `/prospecting` com abas.
- `/home/access` (listada em `SETTINGS_ADMIN_ONLY`) — a rota virou apenas um redirecionamento para `/settings/permissions`, e não está mais no menu de Configurações.

Correções:

- Remover `/prospecting/campaigns` de `SIDEBAR_MANAGER_PLUS` e garantir que `/prospecting` esteja coberto.
- Remover `/home/access` de `SETTINGS_ADMIN_ONLY` e usar `/settings/permissions` (item real de controle de acesso, admin-only).
- Conferir cada URL restante das listas contra os arquivos `menu-config*.ts` e ajustar o que estiver fora do lugar (por exemplo, item que hoje é manager e está listado como admin-only), sem alterar nenhuma configuração de menu.

Os testes de integridade (URLs duplicadas, `need` válido) ficam como estão.

## 2. `/settings/rbac-diagnostics` — todos os itens expandidos

Hoje a tela guarda apenas um item aberto (`expanded: string | null`), então a matriz de ações só aparece em um item por vez.

Mudança: passar a guardar um conjunto de linhas fechadas (ou abertas), com o padrão "todas expandidas", de forma que ao abrir a tela toda funcionalidade já mostre sua matriz Exibir/Criar/Editar/Excluir. O botão de expandir/recolher por linha continua funcionando (agora recolhendo). Também serão adicionados dois atalhos no topo da tabela: "Expandir tudo" e "Recolher tudo".

## Detalhes técnicos

- `src/routes/_authenticated/settings.rbac-diagnostics.tsx`: trocar o state `expanded` por `collapsed: Set<string>` (linha aberta = não presente no set); `isOpen = !collapsed.has(rowKey)`; manter `aria-expanded` correto e o restante da UI, filtros, loading/empty/error e tokens semânticos inalterados.
- Nenhuma alteração em permissões, RLS, server functions ou configuração de menu.
- Validações: `bunx vitest run src/lib/menu-config.test.ts src/lib/menu-resources.test.ts`, typecheck e lint.

## Fora de escopo

- Alterar visibilidade real de qualquer item de menu.
- Alterar o catálogo de permissões.
