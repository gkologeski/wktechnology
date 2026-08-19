# Responsável da vaga: grid vazio x detalhe com Priscila

## Diagnóstico (verificado no banco e no código)

São dois campos diferentes sendo mostrados nas duas telas:

- O **grid de Vagas** exibe a coluna "Responsável" a partir de `assigned_to` (`AssigneeCell`).
- O **detalhe da vaga** não tem campo Responsável: exibe apenas o **Proprietário** (`OwnerField`, coluna `owner_id`), que na vaga "Desenvolvedor Fullstack" é a Priscila Alves do Nascimento.

Confirmado nas vagas do workspace: "Desenvolvedor Fullstack" tem `owner_id` = Priscila e `assigned_to` **nulo**; as outras três vagas têm `assigned_to` preenchido. Ou seja, o grid está correto (não há responsável), e o que o usuário lê como "responsável" no detalhe é o proprietário.

## O que será feito

1. **Exibir Responsável no detalhe da vaga**: adicionar o campo `AssigneeField` (coluna `assigned_to`) no painel de Propriedades, logo abaixo do Proprietário, com os mesmos rótulos e estados usados nas outras entidades. Assim as duas telas passam a mostrar a mesma informação, com o Proprietário claramente identificado como autoria do registro.
2. **Definir responsável ao criar vaga**: novas vagas passam a assumir `assigned_to` = usuário atual quando nenhum for informado (mesmo padrão já adotado em outras entidades).
3. **Preencher o histórico**: migração aditiva que define `assigned_to = owner_id` apenas nas vagas em que `assigned_to` está nulo — corrige "Desenvolvedor Fullstack" e qualquer vaga antiga na mesma situação.

## Fora do escopo

- Não altera RLS, permissões, `owner_id`, nem a semântica de hiring manager/recruiter.
- Não mexe em outras telas do ATS.

## Detalhes técnicos

- `src/routes/_authenticated/(ats)/jobs.$id.tsx`: passa a ler `assigned_to` da vaga e renderiza `AssigneeField table="ats_jobs"` com `onChanged` ligado ao refresh já existente (`onSaved`).
- `src/lib/ats/ats.functions.ts` (`saveAtsJob`): no insert, `assigned_to: data.assigned_to ?? userId`; no update nada muda.
- Migração: `UPDATE public.ats_jobs SET assigned_to = owner_id WHERE assigned_to IS NULL AND owner_id IS NOT NULL;`

## Como validar

1. Abrir "Desenvolvedor Fullstack": Responsável deve mostrar Priscila, igual ao grid.
2. Trocar o responsável no detalhe e conferir a mudança no grid de Vagas.
3. Criar uma vaga nova: Responsável já vem com o usuário atual.
