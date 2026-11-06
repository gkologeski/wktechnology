---
module_key: crm
slug: permissoes
title: Permissões do TechSales
summary: Quem pode ver, criar, editar, excluir, exportar e administrar cada área do TechSales, e o que aparece mascarado.
article_type: reference
route_pattern:
min_permission:
audience: internal
sort_order: 3
version: 1
is_published: true
---
# Permissões do TechSales

## Como o acesso funciona

- Você precisa ser **membro ativo** do workspace e o workspace precisa ter o TechSales licenciado. Membro inativo perde todo o acesso.
- Cada ação é uma chave no formato `techsales.<recurso>.<ação>.<escopo>`.
- **Escopos:** `own` (registros sob sua responsabilidade), `team` (do seu time), `workspace` (todo o workspace).
- **Negação vence:** se um cargo concede e uma regra nega, vale a negação.
- Administrador e dono do workspace têm acesso total ao workspace.
- Esconder o menu não basta: servidor e banco também verificam a permissão. Abrir a tela pela URL não libera nada.
- As permissões são gerenciadas em **Configurações › Pessoas & Acesso › Permissões** (`/settings/permissions`), só por dono/admin.

## Matriz recurso × ação

✔ = ação existe no catálogo e pode ser concedida ao cargo. — = ação não existe para o recurso.

| Área | Recurso | Ver | Criar | Editar | Excluir | Exportar | Administrar | Outras |
|---|---|---|---|---|---|---|---|---|
| Leads | `leads` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | atribuir |
| Contatos | `contacts` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | atribuir |
| Empresas | `companies` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | atribuir |
| Negócios | `deals` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | atribuir, aprovar |
| Cotações | `quotes` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | atribuir, aprovar |
| Enviar/compartilhar cotação | `quote_send`, `quote_share` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — |
| Propostas | `proposals` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | atribuir, aprovar |
| Enviar proposta | `proposal_send` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — |
| Compartilhar proposta | `proposal_share` | ✔ | — | — | — | — | ✔ | — |
| Modelos de proposta | `proposal_templates` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — |
| Tarefas e atividades | `tasks`, `activities` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | atribuir |
| Filas de tarefas | `task_queues` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — |
| Notas | `notes` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — |
| Reuniões | `meetings` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | atribuir |
| Comunicações | `communications` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — |
| Inbox (Email, WhatsApp, Chat) | `inbox.email`, `inbox.whatsapp`, `inbox.chat` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | atribuir |
| Contas de e-mail | `email_accounts` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — |
| Campanhas | `marketing.campaigns` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | atribuir |
| Formulários | `marketing.forms` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | atribuir |
| Landing pages | `marketing.landing_pages` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | atribuir |
| Agente SDR | `marketing.sdr_agent` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | atribuir |
| Pesquisas | `surveys` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | atribuir |
| Prospecção (busca, fila, roteiros, cadências, voz, enriquecimento…) | `prospecting_*` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | atribuir (conforme recurso) |
| Segmentos | `segments` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — |
| Tickets | `tickets` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | atribuir |
| Metas | `goals` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — |
| Painel | `dashboard` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — |

Itens de **Otimizar** e algumas telas de configuração usam chaves `system.*` (ex.: `system.analytics.reports.view.workspace`, `system.workflows.manage.workspace`, `system.automation.sequences.view.workspace`). Sem a chave, o item aparece apenas para gestor ou superior.

## O que aparece para quem

- Itens de menu sem chave (Leads, Contatos, Empresas, Negócios, Inbox, Tarefas, Notas, Tickets…) aparecem a todo membro ativo com o módulo licenciado. Os **registros** listados dependem do escopo da sua permissão de ver (`own`, `team` ou `workspace`).
- Cargos com **visibilidade restrita** só enxergam registros do próprio escopo, mesmo que o menu apareça.
- Faturas seguem as permissões do TechFinance (`techfinance.invoices.*`).

## Campos ocultos, mascarados ou só leitura

O administrador pode definir regras por campo:

- **Oculto:** o campo não aparece para você.
- **Mascarado:** você vê só o primeiro e o último caractere, o resto vira `•` (ex.: `j•••••m`).
- **Somente leitura:** você vê o valor, mas não consegue alterar.

Essas regras são aplicadas no servidor, inclusive na exportação.

## Relacionados

- [Visão geral do TechSales](/ajuda/crm/visao-geral)
- [Erros comuns](/ajuda/crm/erros-comuns)
