## Detalhes técnicos
- Causa: a política RESTRITIVA `rep_scope_select_companies` usa `id IN (SELECT rep_visible_company_ids())`. Essa função é STABLE e SECURITY DEFINER e lê `companies` com o snapshot do comando, que não enxerga a linha inserida no próprio INSERT ... RETURNING. `rep_scope_select_contacts` usa `rep_visible_contact_ids()` e tem o mesmo problema.
- Migração aditiva (aplicada ao aceitar o rascunho): `DROP POLICY IF EXISTS` + `CREATE POLICY` com o mesmo nome, RESTRICTIVE, FOR SELECT, TO authenticated:
  `NOT (workspace_id IN (SELECT rep_restricted_workspaces())) OR owner_id = auth.uid() OR assigned_to = auth.uid() OR id IN (SELECT rep_visible_*_ids())`
- Antes de recriar, ler os papéis da política atual para manter os mesmos.
- Sem mudança de código, de cargos nem de GRANT.
- Conferir no AGENTS.md se a regra de visibilidade restrita precisa de ajuste no texto.
- Teste: criar uma sessão da Eduarda, inserir empresa e contato com `.select().single()`, confirmar contagem de empresas visíveis antes e depois, e apagar os registros de teste.
