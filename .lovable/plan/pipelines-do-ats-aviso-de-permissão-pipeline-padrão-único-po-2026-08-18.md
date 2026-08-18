# Pipelines do ATS: aviso de permissão + pipeline padrão único por workspace

## Situação atual (verificada)

- `ats_pipelines` não tem `workspace_id`; o workspace é derivado de `owner_id` via `public.resolve_workspace_id(owner_id)`, e a visibilidade vem de políticas RBAC (`techhire_rbac_gate`, `is_workspace_admin_of`, `can_write_owner`).
- `listAtsPipelines` cria um "Pipeline padrão" sempre que o usuário não vê nenhum pipeline. Isso já gerou registros duplicados: hoje existem 8 pipelines, incluindo 2 "Pipeline padrão" no mesmo workspace (owner `5946...`) ambos com `is_default = true`, além de um "Pipeline padrão" com `is_default = false` convivendo com "RH - Seleção".
- Nos seletores (`jobs.index.tsx` e o painel de propriedades em `jobs.$id.tsx`), quando a lista vem vazia o `Select` apenas fica desabilitado, sem nenhuma explicação para o usuário.

## O que será feito

### 1. Aviso no seletor de pipeline

Nos dois pontos onde o pipeline é escolhido (criação de vaga e propriedades da vaga):

- Quando não houver nenhum pipeline visível, manter o seletor desabilitado e exibir abaixo dele um aviso curto no padrão do design system (tom de alerta/`text-warning`, com ícone), explicando que não há pipeline visível pelas permissões atuais e o que fazer:
  - pedir a um administrador do workspace acesso de visualização de pipelines, ou
  - criar/definir um pipeline em Configurações de pipelines (link direto para `/pipelines` quando o usuário tiver permissão de acesso à tela).
- Quando o erro for de carregamento (falha na consulta), mostrar mensagem de erro com ação "Tentar novamente", em vez do aviso de permissão.
- A tela `/pipelines` recebe o mesmo tratamento no estado vazio: diferencia "workspace sem pipelines" de "sem permissão para ver pipelines".

### 2. Regra de pipeline padrão por workspace

- Limpeza dos dados existentes: em cada workspace, eleger um único pipeline padrão (preferindo o que já é padrão e tem mais vagas vinculadas), desmarcar `is_default` dos demais e remover pipelines "Pipeline padrão" duplicados que não tenham nenhuma vaga vinculada.
- Garantia no banco: índice único parcial por workspace para `is_default = true` e um gatilho que, ao marcar um pipeline como padrão, desmarca automaticamente os outros do mesmo workspace (hoje isso é feito no código, com `.neq(id)` sem escopo real de workspace).
- No servidor: `listAtsPipelines` deixa de criar pipeline como efeito colateral da listagem. A criação automática do pipeline padrão passa para uma função explícita, idempotente, que:
  - primeiro procura um pipeline padrão já existente no workspace;
  - só cria "Pipeline padrão" se o workspace realmente não tiver nenhum;
  - é chamada ao abrir a criação de vaga / a tela de pipelines, e nunca duplica.
- `savePipeline` e `setDefaultPipeline` passam a delegar a exclusividade do padrão ao gatilho do banco (escopo de workspace), evitando alterar pipelines de outros workspaces.
- Novas vagas continuam pré-selecionando o pipeline padrão do workspace; se não houver padrão, usa o primeiro visível.

## Detalhes técnicos

- Migração SQL: dedupe + `UPDATE` de `is_default`, função `public.ats_pipelines_enforce_single_default()` (trigger `BEFORE INSERT OR UPDATE`) usando `resolve_workspace_id(owner_id)`, e `CREATE UNIQUE INDEX ... ON public.ats_pipelines (public.resolve_workspace_id(owner_id)) WHERE is_default` (se a função não for aceita como imutável no índice, a exclusividade fica apenas no gatilho).
- Arquivos afetados: `src/lib/ats/pipelines.functions.ts`, `src/routes/_authenticated/(ats)/jobs.index.tsx`, `src/routes/_authenticated/(ats)/jobs.$id.tsx`, `src/routes/_authenticated/(ats)/pipelines.tsx`.
- Sem mudança em RLS, autenticação ou nas permissões existentes; nenhuma funcionalidade removida.
