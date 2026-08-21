# Por que voltaram a aparecer vários "Pipeline padrão"

## Diagnóstico (verificado no banco)

- Existem 4 pipelines chamados "Pipeline padrão" (entidade Negócios), todos criados em 21/08/2026 entre 18:38:39 e 18:38:40 — ou seja, 4 inserções em pouco mais de 1 segundo.
- Todos têm como autor a conta da Andressa (`8dc53d40…`), que passou a ser membro do workspace às 18:23 do mesmo dia — 15 minutos antes das criações.
- Todos os 4 estão marcados como padrão (`is_default = true`), junto com "Serviços" e "Novos Negócios", que também estão como padrão. A tabela `pipelines` não tem gatilho que garanta um único padrão (o ATS tem: `ats_pipelines_enforce_single_default`).
- Nenhum negócio está vinculado a esses 4 pipelines (0 registros), então eles são puramente lixo de criação automática.
- A criação automática vem do próprio front-end: em `src/lib/pipelines.ts`, o hook `usePipelines` tem um `useEffect` que, sempre que a consulta retorna lista vazia, insere um pipeline padrão. Esse hook é usado em 12 telas/componentes (grade de negócios, detalhe, drawer, cards de associação, diálogos de criação), e vários deles montam ao mesmo tempo na mesma tela.

Causa raiz: o "semear pipeline padrão" está no cliente, sem trava de concorrência e sem distinguir "o workspace realmente não tem pipeline" de "este usuário ainda não consegue ver os pipelines". Quando a conta da Andressa entrou no workspace, a listagem que ela tinha em cache estava vazia (antes do vínculo, as políticas de acesso não retornavam nenhuma linha); ao abrir a tela de Negócios, cada componente que usa o hook disparou a mesma inserção em paralelo, gerando 4 cópias.

Isso explica também a recorrência: qualquer usuário novo, ou qualquer momento em que a listagem venha vazia (falha de permissão, cache antigo, troca de workspace), recria "Pipeline padrão".

## O que será feito

1. **Tirar a criação automática do cliente.** Remover o `useEffect` de semeadura do `usePipelines`. O hook passa a apenas ler pipelines.

2. **Criar a semeadura no servidor, idempotente**, no mesmo padrão já usado no ATS (`ensureDefaultAtsPipeline`): uma server function que, por workspace e por entidade (negócio, lead, ticket), reaproveita o padrão existente, promove o primeiro visível quando nenhum está marcado como padrão e só cria quando o workspace realmente não tem nenhum. Chamada uma única vez por tela de listagem (Negócios, Leads, Tickets), nunca pelos componentes de detalhe/diálogo.

3. **Garantir "um único padrão" no banco**, com gatilho equivalente ao do ATS: ao marcar um pipeline como padrão, os outros do mesmo workspace e mesma entidade deixam de ser padrão.

4. **Limpar os dados atuais**: excluir os 4 "Pipeline padrão" (nenhum negócio vinculado) e deixar apenas um pipeline padrão por entidade — em Negócios, manter "Serviços" como padrão (regra de negócio já presente no código) e desmarcar "Novos Negócios".

## Detalhes técnicos

- `src/lib/pipelines.ts`: remover o bloco de seed (linhas ~104-138) e a dependência de `useQueryClient` que só existia para ele.
- Nova server function `ensureDefaultPipeline({ entity })` em `src/lib/pipelines.functions.ts`, com `requireSupabaseAuth`, seleção ordenada por `is_default`/`created_at`, promoção do primeiro visível e inserção só quando a lista está vazia. Sem filtro manual por `owner_id`; isolamento continua vindo de `workspace_id` + políticas de acesso.
- Chamada nas rotas `deals.tsx`, `tickets.tsx` e no hook de estágios de leads (uma chamada por tela, via `useQuery` com chave por entidade).
- Migration: gatilho `pipelines_enforce_single_default` (BEFORE INSERT OR UPDATE) + limpeza dos 4 registros duplicados e ajuste dos `is_default`. Sem alteração de políticas de acesso, schema de autenticação ou colunas.

## Como validar depois

1. Abrir /deals com a conta da Andressa: deve listar os pipelines existentes, sem criar nada novo.
2. Consultar a tabela: apenas um pipeline padrão por entidade, e nenhum registro novo chamado "Pipeline padrão".
3. Marcar outro pipeline como padrão em Configurações → Pipelines: o anterior deve deixar de ser padrão automaticamente.

## Risco

A exclusão dos 4 duplicados é segura hoje (0 negócios vinculados). Se algum usuário tiver selecionado um deles como visão atual, a tela cai automaticamente no padrão do workspace (a seleção é guardada localmente e revalidada).
