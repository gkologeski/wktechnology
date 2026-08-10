# Nova Alocação: só contratos de prestação, ordenados por semelhança com o nome da pessoa

## Situação atual (verificada)

Em `src/components/people/allocations-panel.tsx`, o campo "Contrato de prestação" usa `ContractSelect`, que chama `listContracts({ data: {} })` — sem filtro de papel. Ou seja, a lista traz também contratos de compra. A ordenação é por `created_at desc`. O painel recebe apenas `personId`, não o nome da pessoa.

## O que muda

1. **Somente prestação**: o seletor passa a pedir `role: "provider"` (papel Prestação) ao listar contratos. O seletor de "Contrato de compra" continua igual.
2. **Ordenação por relevância ao nome da pessoa**: os contratos com maior semelhança entre o título e o nome da pessoa aparecem no topo, seguidos pelos demais na ordem atual.
   - Comparação sem acentos, sem maiúsculas/minúsculas e ignorando prefixos como `[PRESTAÇÃO]`, `[ADITIVO]`, além de partículas ("de", "da", "dos", "e").
   - Pontuação: peso maior para nome completo contido no título, depois sobrenome(s), depois primeiro nome; empates mantêm a ordem original.
   - Os contratos prováveis ficam agrupados no topo com um rótulo discreto "Prováveis para esta pessoa" e o restante sob "Outros contratos de prestação"; nenhum contrato é escondido.
3. **Busca digitável**: o `Select` fixo é trocado por `Popover` + `Command` (padrão já usado em outros seletores do projeto), permitindo digitar para filtrar por número/título, mantendo a opção "Sem contrato".

## Detalhes técnicos

- `src/routes/_authenticated/people.$id.tsx`: passa `personName={p.full_name}` (nome já carregado na tela) para `AllocationsPanel`.
- `src/components/people/allocations-panel.tsx`: nova prop opcional `personName`, repassada ao `AllocationSelect`; `ContractSelect` passa a chamar `listContracts({ data: { role: "provider" } })` com `queryKey` `["allocations-contracts","provider"]`, e ordena no cliente pela pontuação de semelhança.
- Nova função pura `scoreContractTitleForPerson(title, personName)` em `src/lib/contracts/title-match.ts` (client-safe), com testes unitários cobrindo acentos, prefixos e ausência de correspondência.
- Sem alteração de schema, RLS, permissões ou server functions; apenas filtro já suportado por `listContracts` e apresentação.

## Validação

- `tsgo` + lint nos arquivos alterados; testes unitários da nova função.
- Teste manual: abrir Pessoas → uma pessoa → Alocações → Nova alocação e conferir que só há contratos de prestação e que os relacionados ao nome da pessoa aparecem primeiro.
