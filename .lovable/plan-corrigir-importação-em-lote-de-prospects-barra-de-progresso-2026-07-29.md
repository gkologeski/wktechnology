# Corrigir importação em lote de prospects + barra de progresso

## Problemas confirmados

1. **"Importar todos os leads" retorna 18 falhas** — a importação grava o lead com `owner_id` = id do workspace e não envia `workspace_id`. A política de segurança da tabela de leads exige `workspace_id` do usuário e `owner_id = auth.uid()`, então toda inserção é rejeitada. Todas as falhas vêm daí.
2. **"Incluir todos em uma fila" não faz nada** — o fluxo primeiro importa os prospects; como todas as importações falham (mesma causa), a lista de leads fica vazia e o modal de fila nunca abre.
3. **Sem feedback de progresso** — o processamento é sequencial (1 chamada por prospect), sem indicação de avanço.

## O que será feito

**Correção da importação**

- Na função de importação de prospect, gravar `owner_id` com o id do usuário autenticado e incluir `workspace_id` do workspace ativo.
- Sem mudança de schema, políticas ou regras de negócio.

**Barra de progresso**

- Exibir uma barra de progresso no topo do painel de resultados enquanto o lote roda, com contador "X de Y" e o nome do prospect em processamento.
- Os botões de lote e as ações por card continuam desabilitados durante o processamento.
- Ao terminar, a barra some e o resumo (importados / já existentes / falhas) continua no toast.

**Mensagens de erro mais úteis**

- Guardar a primeira mensagem de erro real do lote e mostrá-la no toast de falha, em vez de apenas a contagem.
- Se a importação falhar para todos no fluxo de fila, informar explicitamente que o modal não foi aberto por causa das falhas.

## Detalhes técnicos

- `src/lib/prospecting.functions.ts` (`importProspectAsLead`): `owner_id: userId` + `workspace_id: workspaceId` no insert de `leads`.
- `src/routes/_authenticated/settings.prospecting.tsx`: `importMany` recebe callback de progresso; novo estado `{ done, total, label }`; render com o componente `Progress` do design system (`@/components/ui/progress`) e texto acessível (`aria-live="polite"`).
- Sem alteração de RLS, migrations ou contratos de server functions.

## Como validar

1. Abrir uma busca em `/prospecting?tab=prospecting`.
2. Clicar em "Importar todos os leads" — a barra avança e o toast final deve mostrar leads importados, sem falhas.
3. Clicar em "Incluir todos em uma fila" — após a barra concluir, o modal de fila abre com todos os leads.
4. Repetir "Importar todos" — deve informar que já haviam sido importados (idempotente).
