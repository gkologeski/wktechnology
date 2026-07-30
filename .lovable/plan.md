# Corrigir fila de prospecção vazia (Fila teste 001)

## Diagnóstico (confirmado)

A fila "Fila teste 001" é manual, entidade `lead`, com 33 itens — e os 33 leads existem no banco, todos com status `new` e pertencentes ao seu workspace. Ou seja, os dados estão corretos.

A consulta que alimenta a tela falha antes de retornar qualquer linha: ela pede a coluna `assigned_to` em `leads`/`contacts`, e essa coluna **não existe** nessas tabelas (verificado no banco: `leads`, `contacts`, `companies` e `deals` não têm `assigned_to`; a coluna foi criada em outras 58 tabelas, mas não nas entidades de CRM).

Como a consulta retorna erro, a tela cai no estado vazio genérico — o que também explica o rótulo "0 contatos" em uma fila de leads (o texto usa um fallback quando a resposta não chega) e o botão "Iniciar fila" desabilitado. O filtro "Todos os responsáveis" não tem relação com o problema.

## O que será feito

1. **Adicionar o campo Responsável a Leads e Contatos** (migração): coluna `assigned_to` em `public.leads` e `public.contacts`, com preenchimento inicial a partir do dono do registro (`owner_id`) e índice para filtro. Isso alinha as duas entidades ao padrão já aplicado nas outras telas do sistema, mantendo o filtro por responsável funcional na fila.
2. **Tornar a consulta da fila resiliente**: a listagem e a contagem de itens deixam de assumir colunas opcionais e passam a tratar erro com mensagem clara na tela (estado de erro com ação "tentar novamente"), em vez de mostrar "nenhum item".
3. **Corrigir o rótulo da fila**: usar a entidade da própria fila (lead/contato) para o texto de contagem, sem depender da resposta da consulta.
4. **Validar**: abrir `/prospecting?tab=fila`, confirmar os 33 leads listados, o botão "Iniciar fila" habilitado e o filtro por responsável funcionando (Todos / Meus registros / Sem responsável).

## Detalhes técnicos

- Migração: `ALTER TABLE public.leads ADD COLUMN assigned_to uuid`, idem em `public.contacts`, backfill `assigned_to = owner_id`, índices `(owner_id, assigned_to)`. Sem alterar RLS, grants ou regras de negócio existentes.
- `src/lib/prospecting/queues.functions.ts`: `listQueueItems`/`countQueueItems` — selects explícitos e coerentes com o schema; erro propagado com mensagem tratada.
- `src/components/prospecting/queue-tab.tsx`: `QueueWorkspace` recebe a entidade da fila via prop, adiciona estado de erro e mantém loading/empty atuais.
- Fora de escopo: `companies` e `deals` (também sem `assigned_to`) — sinalizado como pendência, sem alteração neste plano.
