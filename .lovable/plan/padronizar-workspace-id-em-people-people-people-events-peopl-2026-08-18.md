# Padronizar workspace_id em People (people, people_events, people_psychosocial_assessments)

## Situação atual (verificada no banco)

- `people` (185 registros), `people_events` (186) e `people_psychosocial_assessments` (3) **não têm** coluna `workspace_id`.
- Nas três tabelas, `owner_id` guarda o **id do workspace** (100% dos registros conferem com `workspaces.id`; nenhum aponta para usuário).
- As políticas de acesso usam `owner_id` como se fosse workspace (`is_workspace_admin_v2(owner_id, ...)`, `resolve_workspace_id(owner_id)`, `user_has_permission(..., resolve_workspace_id(owner_id), ...)`).
- `people` tem 6 políticas sobrepostas (dois conjuntos: `people_*` só de admin e `people_perm_*` com RBAC), o que dificulta auditar o isolamento.
- `people_events` e `people_psychosocial_assessments` dependem das funções `can_view_person`, `can_manage_person` e `can_view_person_sensitive`, que também tratam `people.owner_id` como workspace e ainda aceitam o atalho `owner_id = auth.uid()` ("workspace pessoal"), um caminho que hoje não corresponde a nenhum dado real.
- Código do módulo People (11 arquivos em `src/lib/people/*`, incluindo caminhos de storage `${owner_id}/${person_id}/...`) usa `owner_id` como workspace.

## O que será feito

Mudança **aditiva**: introduzir `workspace_id` como fonte de verdade do isolamento, mantendo `owner_id` preenchido e sincronizado para não quebrar nada que já funciona.

1. **Coluna e backfill**
   - Adicionar `workspace_id uuid` (FK para `workspaces`, com índice) nas três tabelas.
   - Backfill `workspace_id = owner_id` (validado: todos são workspaces existentes).
   - Tornar `workspace_id` obrigatório após o backfill.

2. **Sincronização automática**
   - Trigger por tabela: se `workspace_id` vier nulo, preenche a partir de `owner_id` (ou do registro pai, em `people_events`/avaliações, via `person_id`); se `owner_id` vier nulo, espelha de `workspace_id`. Assim o código atual (que grava `owner_id`) continua correto e o novo padrão passa a valer.

3. **Políticas padronizadas**
   - `people`: substituir os dois conjuntos por um único conjunto por operação (ver/criar/editar/excluir), no padrão já usado no CRM: `workspace_id ∈ workspaces do usuário` **e** (admin do workspace **ou** permissão granular `techpeople.people.<ação>.<escopo>` **ou** ser o gestor/a própria pessoa para leitura), com bypass de administrador de plataforma.
   - `people_events` e `people_psychosocial_assessments`: mesma base de workspace, somada às regras de sensibilidade que já existem (evento visível à pessoa, gestor direto, permissões de bem-estar). Nenhum acesso hoje concedido será perdido, exceto o atalho `owner_id = auth.uid()`, que não corresponde a dado nenhum.
   - Atualizar `can_view_person`, `can_manage_person` e `can_view_person_sensitive` para usar `p.workspace_id` e checar pertencimento ao workspace, removendo o atalho de "workspace pessoal".

4. **Ajuste de código (mínimo)**
   - Nos pontos de escrita de `src/lib/people/*`, passar a enviar `workspace_id` junto de `owner_id` (mantendo o mesmo valor). Caminhos de storage e leituras existentes ficam como estão.

## Detalhes técnicos

- Migration única com: `ALTER TABLE ... ADD COLUMN`, `UPDATE` de backfill, `SET NOT NULL`, índices `(workspace_id)`, funções de trigger `people_set_workspace_id`/`people_child_set_workspace_id`, `DROP POLICY` dos conjuntos antigos e `CREATE POLICY` do novo padrão, `CREATE OR REPLACE FUNCTION` das três funções auxiliares.
- Padrão de política: `workspace_id IN (SELECT current_user_workspaces())` + (`is_workspace_admin_v2(workspace_id, auth.uid())` OU `user_has_permission(auth.uid(), workspace_id, '<perm>')`) OU `is_platform_admin(auth.uid())`.
- `owner_id` permanece na tabela (sem remoção) e continua sincronizado; a remoção só será considerada em um lote futuro, depois que todo o código migrar.
- Atualizar o snapshot de `docs/workspace-isolation-compliance.md` retirando as três tabelas do grupo de pendências.

## Como validar depois

1. Abrir `/people`, uma ficha de pessoa, a aba Psicossocial e `/people/psychosocial` — as listas devem continuar iguais para admin e para usuário com permissão.
2. Conferir no banco que não há registro com `workspace_id` nulo nas três tabelas e que `workspace_id = owner_id` em todos.
3. Criar uma pessoa e uma avaliação: `workspace_id` deve ser preenchido automaticamente com o workspace ativo.
4. Usuário sem permissão de People deve continuar sem ver a lista; usuário do workspace com permissão deve ver os registros dos colegas.
