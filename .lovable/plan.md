# Sprint H — Fase 3: Conciliação bancária em massa

Objetivo: permitir selecionar várias transações do extrato de uma vez na tela de conciliação e aplicar ações em lote (sugerir matches, vincular, criar lançamentos, ignorar), reduzindo cliques em fechamentos mensais.

## Escopo

- Somente a tela `/finance/banking/reconciliation`.
- Sem mudar regras de matching existentes.
- Sem alterar RLS/permissões.

## Mudanças

### 1. Server functions (`src/lib/banking/reconciliation.functions.ts`)

Novas funções em lote — cada uma itera e chama a lógica unitária já existente, retornando `{ ok, failed, errors[] }`:

- `bulkSuggestMatches({ ids: string[] })` — roda o sugestor em cada transação, retorna resumo com contagem de matches encontrados.
- `bulkLinkBestMatch({ ids: string[], min_score })` — vincula automaticamente onde o score da melhor sugestão ≥ `min_score` (default 0.9); ignora quando ambíguo.
- `bulkCreateEntries({ ids: string[], defaults: { category_id?, counterparty_company_id?, direction? } })` — cria `financial_entries` a partir de cada transação (direção inferida por sinal se não fornecido) e marca como conciliado.
- `bulkIgnoreTransactions({ ids: string[] })` — marca como `ignored`.

Validação Zod, limite de 200 ids por chamada, `requireSupabaseAuth`, escopo por `owner_id` para respeitar RLS.

### 2. UI (`src/routes/_authenticated/finance.banking.reconciliation.tsx`)

- Coluna de checkbox na tabela de transações não conciliadas + checkbox "selecionar todos" no header (respeitando filtros ativos).
- Barra de ações em lote fixa no topo quando há seleção, mostrando contagem e botões: **Sugerir matches**, **Vincular automáticos**, **Criar lançamentos**, **Ignorar**.
- **Criar lançamentos** abre modal simples com defaults opcionais (categoria, empresa contraparte); direção é auto por sinal com toggle "forçar todas como receber/pagar".
- **Vincular automáticos** abre modal para ajustar `min_score` (slider 0.7–1.0).
- Toast final com resumo `X sucesso / Y falha` e link "ver detalhes" que expande erros.
- Reset da seleção após cada ação bem sucedida; `queryClient.invalidateQueries` nos keys da reconciliação e do dashboard.

### 3. Detalhes técnicos

- Reaproveitar `advanceRecurrenceOnce`-style: chamadas unitárias existentes iteradas server-side para manter uma transação por commit (evita rollback em bloco em caso de erro isolado).
- Processamento em série no server (não paralelo) para não estourar limites do PostgREST e manter logs previsíveis.
- Nenhum novo estado persistido: seleção vive só no client.

## Fora do escopo

- Undo em lote (pode ser proposto depois se o usuário pedir).
- Regras salvas de auto-categorização.
- Alteração no engine de matching.

## Como validar manualmente

1. Abrir `/finance/banking/reconciliation` com transações pendentes.
2. Selecionar várias e usar cada ação; conferir contagens no toast e o estado das linhas.
3. Confirmar que lançamentos criados aparecem em `/finance/payable` e `/finance/receivable` com `external_ref` do extrato.
4. Confirmar que "Ignorar" some da lista sem afetar outras contas.