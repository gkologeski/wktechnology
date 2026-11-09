# ROLAGEM-CONTRATO — Barra de rolagem no corpo do contrato

Porte P · estimativa 15–25 min.

## O que muda
Na tela de edição de Modelo de Contrato, o "Corpo do contrato" passa a ter altura fixa (aprox. 70% da altura da tela, mínimo 520 px) com barra de rolagem própria. A barra de ferramentas (negrito, listas etc.) fica fixa no topo da caixa enquanto o texto rola. A página não precisa mais rolar inteira para percorrer o contrato.

## Detalhes técnicos
- `src/components/word-editor.tsx`: nova prop opcional `maxHeight` (número ou string CSS). Quando informada, o wrapper vira `flex flex-col` com essa altura máxima, a Toolbar fica `shrink-0` e o `EditorContent` fica em `overflow-y-auto` (`min-h-0 flex-1`). Sem a prop, comportamento atual inalterado nos demais usos (propostas, e-mails etc.).
- `src/routes/_authenticated/contracts.templates.$id.tsx`: passar `maxHeight="70vh"` ao `WordEditor`.
- Sem mudança de dados, permissões ou regras; classificação apenas de apresentação no registro de permissões, se o gate exigir.
- Validação: Playwright abrindo um modelo longo, confirmando que o corpo rola internamente e a toolbar permanece visível; build.
