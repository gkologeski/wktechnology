# Registros da Priscila ainda invisíveis: política RESTRICTIVE bloqueando

## Causa confirmada

A migration anterior adicionou as políticas permissivas corretas (`ats_jobs_rbac_select`, `ats_candidates_rbac_select`) e elas **funcionam**: testado no banco, `techhire_rbac_gate(guilherme, priscila, 'techhire.jobs.view.workspace')` e a versão de candidatos retornam `true`.

O que anula esse ganho: em `ats_jobs` e `ats_candidates` existe uma política de leitura **RESTRICTIVE** (`polpermissive = false`), que é aplicada com **AND** sobre todas as permissivas:

- `ats_jobs_perm_select` (RESTRICTIVE): `owner_id = auth.uid() OR is_workspace_admin_of(owner_id, auth.uid()) OR user_has_permission(auth.uid(), resolve_workspace_id(owner_id), 'techhire.jobs.view.workspace')`
- `ats_candidates_perm_select` (RESTRICTIVE): mesma forma, com a permissão de candidatos.

Para as linhas da Priscila os três ramos falham:

- `owner_id = auth.uid()` → falso (dona é a Priscila);
- `is_workspace_admin_of(owner_id, …)` interpreta `owner_id` como id de workspace → falso;
- `resolve_workspace_id(priscila)` = `NULL` (ela não criou workspace), então `user_has_permission(…, NULL, …)` → falso.

Resultado: a RESTRICTIVE nega e as vagas/candidatos dela não aparecem. Confirmado na tela: `/jobs` mostra exatamente as 6 vagas do Guilherme; as 4 da Priscila (Desenvolvedor Fullstack, Gestor de projetos, 2x Executivo Comercial) ficam de fora.

Efeito equivalente em escrita: `ats_jobs_perm_update`, `ats_jobs_perm_delete`, `ats_candidates_perm_update`, `ats_candidates_perm_delete` também são RESTRICTIVE com o mesmo `resolve_workspace_id(owner_id)`, então o sintoma "vejo mas não consigo editar" apareceria logo após liberar a leitura.

Nenhuma outra tabela do ATS tem política RESTRICTIVE de leitura (verificado).

## Correção (migration)

Reescrever as políticas RESTRICTIVE de `ats_jobs` e `ats_candidates` para incluir o caminho correto de workspace, sem afastar nenhum dos critérios atuais:

```
owner_id = auth.uid()
OR is_workspace_admin_of(owner_id, auth.uid())
OR user_has_permission(auth.uid(), resolve_workspace_id(owner_id), '<perm>')
OR techhire_rbac_gate(auth.uid(), owner_id, '<perm>')
```

Aplicado a:

- `ats_jobs_perm_select` / `ats_candidates_perm_select` → permissão `…view.workspace`
- `ats_jobs_perm_update` / `ats_candidates_perm_update` → `…update.workspace` (mantendo o ramo `update.own` já existente)
- `ats_jobs_perm_delete` / `ats_candidates_perm_delete` → `…delete.workspace`

O gate exige workspace em comum **e** a permissão efetivamente concedida em Configurações → Permissões, então o isolamento entre workspaces é preservado e ninguém ganha acesso além do já concedido.

## Correção no código (filtro por criador)

Além do RLS, várias server functions do ATS ainda filtram por `.eq("owner_id", userId)`, o que esconde registros de colegas mesmo com RLS liberado. Ajustar em `src/lib/ats/ats.functions.ts`, deixando o RLS decidir:

- `listAtsCandidates` (listagem de candidatos) — remoção do filtro;
- `moveApplication`, `setAtsJobStatus`, `setAtsJobDepartment`, `setCandidateArchived`, `deleteAtsJob`, `deleteAtsCandidate`, update de candidato — remover o filtro e manter a checagem de permissão já existente + `assertAffected`, para diferenciar "sem permissão" de "salvo".

`listAtsJobs` já não filtra (correção anterior).

## Fora de escopo

- Não migrar o ATS para coluna `workspace_id` (dívida técnica registrada).
- Não alterar `resolve_workspace_id` (usada por políticas de outros módulos).
- Nenhuma mudança em telas, schema ou autenticação.

## Como validar

1. Logado como Guilherme, abrir Vagas: passam a aparecer 10 vagas (as 6 atuais + 4 da Priscila).
2. Abrir uma vaga da Priscila: candidaturas e pipeline visíveis; edição funciona conforme a permissão concedida.
3. Candidatos: registros criados pela Priscila aparecem na lista.
4. Usuário sem `techhire.jobs.view.workspace` continua vendo só as próprias vagas e as em que é hiring manager/recruiter.
5. Usuário de outro workspace continua sem ver nada.
