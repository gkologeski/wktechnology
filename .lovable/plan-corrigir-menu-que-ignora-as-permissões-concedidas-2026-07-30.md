# Corrigir menu que ignora as permissões concedidas

## Diagnóstico (confirmado no banco)

O usuário `marketing@wktechnology.com.br` tem sim as permissões marcadas na tela (cadências, fila, scripts, busca), mas a consulta que o app usa para montar o menu devolve **zero permissões** para ele.

Verificado:

- O cargo atribuído ao usuário contém 4 permissões de prospecção (exatamente as marcadas no anexo).
- A função de permissões efetivas (`user_effective_permissions`) devolve lista vazia para esse usuário no workspace atual.
- Causa: a tabela de atribuição de cargos guarda, para esse usuário, o **id do dono do workspace** (`1c237fbe…`), enquanto a função compara esse campo com o **id do workspace** (`184b9435…`). Como os dois valores nunca coincidem, nenhuma permissão é encontrada.
- O problema é geral, não pontual: hoje existem linhas gravadas nas duas convenções — 7 atribuições de cargo com id de workspace, 9 com id de dono; todas as atribuições diretas de conjuntos e todos os conjuntos criados no workspace usam id de dono.

Resultado prático: só aparecem no menu os itens sem exigência de permissão (Leads, Pesquisas, Contatos, Empresas…), como no segundo anexo.

## O que será feito

1. **Padronizar a convenção**: adotar o **id do workspace** como valor único em atribuições de cargo, atribuições de conjunto e conjuntos de permissão.
2. **Migração de dados**: converter as linhas que hoje guardam o id do dono para o id do workspace correspondente, sem apagar nada e sem duplicar atribuições.
3. **Ajustar a função de permissões efetivas** para, além de comparar com o id do workspace, tolerar linhas legadas gravadas com o id do dono — assim o sistema volta a funcionar mesmo se algum ponto de escrita antigo escapar.
4. **Ajustar os pontos de escrita** (atribuir cargo, atribuir conjunto, criar conjunto) para sempre gravar o id do workspace.
5. **Validar** consultando novamente as permissões efetivas do usuário e conferindo que Prospecção aparece no menu com apenas as abas permitidas (Busca, Fila, Cadências, Scripts) e que Enrichment, Playbooks, Questionários, Scoring e Voice continuam ocultos.

## Detalhes técnicos

- Migração SQL:
  - `UPDATE public.user_job_roles / user_permission_sets / permission_sets` trocando `owner_id` (quando for `workspaces.created_by`) pelo `workspaces.id` correspondente, resolvendo conflitos com a chave única existente (`ON CONFLICT`/dedupe antes do update).
  - `CREATE OR REPLACE FUNCTION public.user_effective_permissions(_user_id uuid, _workspace_id uuid)` — trocar `ujr.owner_id = _workspace_id` por `ujr.owner_id IN (_workspace_id, (SELECT created_by FROM public.workspaces WHERE id = _workspace_id))`, idem para `user_permission_sets`; manter `SECURITY DEFINER`, `search_path = public` e a lógica de grant/deny inalterada.
- Código: revisar as server functions de RBAC em `src/lib/access-control/*.functions.ts` que gravam `owner_id`, passando o `workspace_id` ativo.
- Sem alteração de RLS, de schema de tabelas ou da UI da matriz de permissões.

## Riscos

- Workspaces em que dono e workspace têm atribuições duplicadas podem gerar conflito de unicidade — tratado com dedupe antes do update.
- Usuários que hoje enxergam permissões por acaso (linhas já no formato correto) não são afetados.
