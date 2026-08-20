# Responsável em Candidatos/Candidaturas + numeração hierárquica em Contratos

## Verificado no banco

- `ats_candidates` e `ats_applications` já possuem a coluna `assigned_to` (além de `owner_id` e `workspace_id`) — não é preciso migração de schema.
- Registros sem responsável hoje: 1 de 14 candidatos e 1 de 5 candidaturas.
- `contracts` já tem `parent_contract_id`, `amendment_of_id`, `role` e `document_kind`; a lista de /contracts já aninha por esses vínculos (função `arrangeContractLinks`), mas exibe apenas recuo + setinha, sem numeração hierárquica.

## Parte 1 — Responsável em Candidatos

- Detalhe do candidato (`candidates.$id.tsx`): incluir o `AssigneeField` no painel de propriedades, no mesmo padrão já usado na vaga (leitura/escrita direta pelo cliente, RLS decide; erro de permissão cai em modo leitura com aviso amigável).
- `getCandidateDetail` passa a selecionar `assigned_to` para alimentar o campo.
- Criação de candidato passa a gravar `assigned_to` = usuário atual (paridade com vagas).
- Grid de Candidatos já exibe a coluna Responsável — nada a mudar além da consistência de dados.

## Parte 2 — Responsável em Candidaturas

Candidaturas não têm tela própria; aparecem como linhas em "Aplicações" no detalhe do candidato e como cards no kanban da vaga.

- `listJobApplications` e a consulta de aplicações do candidato passam a trazer `assigned_to`.
- Detalhe: em cada linha de "Aplicações" (detalhe do candidato) o Responsável fica editável via `AssigneeField` compacto (tabela `ats_applications`).
- Kanban da vaga: o card da candidatura exibe o Responsável (`AssigneeCell`, somente leitura) para o grid e o detalhe contarem a mesma história.
- Criação de candidatura (`addApplication`) grava `assigned_to` = usuário atual.

## Parte 3 — Backfill

Preencher `assigned_to = owner_id` em `ats_candidates` e `ats_applications` onde estiver vazio (apenas quando `owner_id` existir). Nenhum registro já preenchido é alterado.

## Parte 4 — Aninhamento e numeração em /contracts

Passar a exibir numeração hierárquica na coluna Título, na ordem pedida:

```text
1     CONTRATO DE PRESTAÇÃO DE SERVIÇOS
1.1     ADITIVO 1 DO CONTRATO DE PRESTAÇÃO
1.2     ADITIVO 2 DO CONTRATO DE PRESTAÇÃO
1.3     CONTRATO DE COMPRA
1.3.1     ADITIVO 1 DO CONTRATO DE COMPRA
1.3.2     ADITIVO 2 DO CONTRATO DE COMPRA
```

Regras de ordenação dentro de cada nível:

1. aditivos do contrato de prestação primeiro, ordenados por número do aditivo (e depois por data de criação quando não houver número);
2. contratos de compra em seguida, ordenados por número/criação;
3. aditivos do contrato de compra aninhados sob ele, com a mesma regra.

Nada de RLS, schema ou regra de vínculo muda: apenas ordenação e rótulo de numeração na apresentação, mantendo os selos "Aditivo"/"Compra" e o recuo atuais. A numeração aparece somente quando o aninhamento está ativo; em lista plana/agrupada o comportamento atual é preservado.

## Detalhes técnicos

- `src/lib/ats/candidate-detail.functions.ts`: `assigned_to` no select do candidato e das aplicações; tipos `CandidateDetail`/`CandidateApplication` atualizados.
- `src/lib/ats/ats.functions.ts`: `assigned_to` no select de `listJobApplications`; `assigned_to: userId` nos inserts de candidato e candidatura.
- `src/routes/_authenticated/(ats)/candidates.$id.tsx`: `AssigneeField` no painel de propriedades e nas linhas de aplicações.
- Card do kanban de candidaturas: `AssigneeCell`.
- `src/components/contracts/contracts-grouped-list.tsx`: `arrangeContractLinks` retorna também o rótulo de numeração (`path`), consumido por `ContractTableRow`.
- Backfill via operação de dados (dois `UPDATE ... WHERE assigned_to IS NULL`).

## Validação

- Typecheck + lint.
- Manual: abrir um candidato → trocar Responsável → recarregar e conferir no grid; abrir uma candidatura no detalhe do candidato → trocar Responsável → conferir no card do kanban da vaga; abrir /contracts com aninhamento e conferir a numeração 1 / 1.1 / 1.3 / 1.3.1.
