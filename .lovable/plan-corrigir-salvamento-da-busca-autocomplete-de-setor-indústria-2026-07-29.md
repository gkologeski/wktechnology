# Corrigir salvamento da busca + autocomplete de Setor/Indústria

## 1. Erro "new row violates row-level security policy"

Causa confirmada: a tabela `prospecting_searches` exige, no INSERT, que `workspace_id` seja um workspace do usuário **e** que `owner_id = auth.uid()`. O código de salvamento (`upsertProspectSearch`) grava `owner_id` com o **ID do workspace** e nunca preenche `workspace_id`, então a política sempre rejeita.

Correção:

- No insert, gravar `workspace_id = workspace ativo` e `owner_id = usuário autenticado`.
- Nas leituras/updates/deletes de buscas e resultados, filtrar por `workspace_id` (com compatibilidade para a linha antiga, que tem `owner_id` preenchido com o ID do workspace).
- Nenhuma mudança de política RLS: a política atual já está correta e segura.

## 2. Setor / Indústria como autocomplete

Hoje o campo é texto livre com chips, sem sugestões — o usuário não sabe quais valores existem.

Novo comportamento:

- Campo vira um autocomplete com múltipla seleção: ao digitar, uma lista filtrada de setores aparece; ao escolher, vira chip.
- A lista usa a taxonomia de indústrias do Apollo (accounting, computer software, hospital & health care, marketing & advertising, etc.), com rótulo em PT-BR e o valor original enviado à API.
- Continua permitindo texto livre ("usar '<termo>'") para termos fora da lista, para não perder buscas atuais.
- Teclado: setas para navegar, Enter para escolher, Backspace remove o último chip, Esc fecha.
- Estados: lista vazia mostra "Nenhum setor encontrado — pressione Enter para usar assim mesmo".

O mesmo componente fica disponível para reaproveitar em outros campos de chips no futuro (ex.: tecnologias).

## Detalhes técnicos

- `src/lib/prospecting.functions.ts`: `upsertProspectSearch` passa a montar `{ workspace_id, owner_id: userId, ... }`; `listProspectSearches`, `deleteProspectSearch`, `runProspectSearch` e as escritas em `prospecting_results` passam a filtrar por `workspace_id` (fallback `owner_id` para dados legados).
- Novo `src/components/ui/autocomplete-chips.tsx`: input com chips + popover de sugestões (Command do shadcn), aceitando `options` e `allowCustom`.
- `src/lib/prospecting-options.ts`: nova constante `INDUSTRY_OPTIONS` (taxonomia Apollo, label PT-BR / value Apollo).
- `src/components/prospecting/prospect-search-form-dialog.tsx`: campo "Setor / Indústria" passa a usar `AutocompleteChips` com `INDUSTRY_OPTIONS`.
- Sem migrations, sem alteração de RLS, sem alteração das demais telas.

## Validação manual

1. Abrir `/prospecting?tab=prospecting`, criar uma nova busca e salvar — deve salvar sem erro de RLS.
2. Reabrir a busca salva e conferir que os filtros voltam preenchidos.
3. No campo Setor/Indústria, digitar "soft" e ver as sugestões; selecionar uma e conferir o chip.
4. Digitar um termo inexistente e confirmar que ainda é possível adicioná-lo.
5. Executar a busca e conferir que os resultados do Apollo respeitam o setor escolhido.
