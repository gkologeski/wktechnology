# WK — correção do salvamento de pessoa e investigação do plano

## Erro confirmado e corrigido

O usuário confirmou a mensagem `people_assigned_to_fkey` ao salvar uma pessoa.
`upsertPerson` grava o workspace em `owner_id` (contrato legado de TechPeople).
O gatilho compartilhado `sync_responsible_columns` copiava esse valor para
`assigned_to`, cuja FK aponta para `auth.users`. A consulta confirmou que o UUID
do workspace WK não corresponde a um usuário. O INSERT, portanto, falhava mesmo
com `techpeople.people.create.workspace` efetiva.

A migração 0190 adiciona um gatilho BEFORE INSERT específico da tabela people
na WK, ordenado depois do sincronizador compartilhado. Corrige apenas a cópia do
workspace para responsável: usa o ator ativo; para importação sem sessão, usa
created_by válido e ativo ou deixa o campo opcional vazio. Responsável explícito
válido é preservado. UUID de usuário inexistente continua sendo recusado pela FK.
Não altera o sincronizador global, cargos, permissões, registros existentes ou
outros workspaces. O helper é somente de trigger, sem EXECUTE direto para
PUBLIC/anon/authenticated; as políticas RLS existentes continuam obrigatórias.

Aplicada no banco em transação e registrada em drizzle.__drizzle_migrations:
`dfd90c57973dac2f09f1df34c41f71c9e10d298f0f508e4c76ab003a7691fc1b`.
Não exige publicação de frontend, pois a correção é no banco utilizado pelo app.

## Cobertura de testes

O teste anterior do Head de RH tinha uma fixture de RLS reduzida que não incluía
o gatilho compartilhado e a FK de responsável. Por isso não detectava esse erro.
A fixture foi ampliada para preservar o sincronizador original e as FKs reais
people_assigned_to, people_onboarding_plans_assigned_to e owner_id do plano,
além das políticas reais da tabela people.

- 44 verificações anteriores de RLS passaram novamente.
- O erro original people_assigned_to_fkey foi reproduzido antes da nova migração.
- 15 verificações adicionais passaram: mesmo payload de upsertPerson, responsável
  atual e explícito, FK inválida, membro inativo, importação com/sem ator e criação
  de planos para pessoa nova e existente com o sincronizador ativo.
- Reprodução: `PG_BIN=/opt/homebrew/opt/postgresql@15/bin bash tests/sql/run-wk-head-rh.sh`.
- A fixture usa dados sintéticos e PostgreSQL por socket, não a sessão de Priscila.
  Não equivale a clone integral, teste de browser ou de todos os gatilhos de negócio.

## Plano de onboarding — limite da conclusão

A mensagem atual do erro ao salvar plano não foi lembrada pelo usuário.
As chaves efetivas de Priscila e as políticas de criação foram reconferidas no
banco. Não havia sessão ativa de Ver como vinculada a ela no momento da consulta.
O teste isolado de salvar o plano passou com o sincronizador e suas FKs ativos,
mas isso não comprova que o erro real da sessão dela foi resolvido. Nenhuma nova
permissão foi concedida nem proteção removida para contornar uma falha não identificada.
Se persistir, capturar a mensagem exata e a URL do app/ficha para reproduzir o
fluxo/versão correspondente. Não marcar o aceite de onboarding da usuária como
concluído antes dessa conferência.
