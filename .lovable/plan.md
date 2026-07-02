# Próximas fases — TechERP Access Control

A Fase 1 (fundação read-only) já está no ar. Segue o roteiro para transformar em RBAC+ABAC completo.

## Fase 2 — CRUD do Controle de Acesso
Tornar `/home/access` editável.
- Server functions com `requireSupabaseAuth` + checagem de owner/platform_admin para: criar/editar/excluir Cargo, Conjunto de Permissões, Regra de Campo; atribuir cargo primário + cargos extras + conjuntos avulsos a membros.
- Bloquear edição de linhas `is_system=true`; validar unicidade por workspace; auditar em `audit_logs`.
- UI: drawers de edição, matriz de permissões por módulo, atribuição em massa por membro.

## Fase 3 — Enforcement no backend (RBAC efetivo)
- Função SQL `public.user_has_permission(user_id, key)` (SECURITY DEFINER) resolvendo cargos + conjuntos + permissões avulsas.
- Helper TS `requirePermission(ctx, key)` nas server functions críticas (ATS: mover estágio, criar oferta, exportar; CRM: converter lead, editar deal fechado, exportar).
- RLS: cláusulas `user_has_permission(auth.uid(), '<key>')` nas tabelas sensíveis, preservando `shares_workspace_with`.
- Migração suave: feature flag por workspace em `app_settings` para ativar enforcement gradualmente.

## Fase 4 — Field-level (mascarar/ocultar/readonly)
- Hook `useFieldRules(resource)` → `{hidden, masked, readonly}` por campo.
- `<Field>` wrapper em Record Layout / DataTable que respeita o modo.
- Server: sanitizar payloads em endpoints públicos (portal, careers) removendo campos `hidden`/`masked`.

## Fase 5 — Escopo por dado (ABAC leve)
- `data_scope` em `job_roles`: `own | team | workspace | custom`.
- `user_groups` (já existe) vira base do `team`.
- RLS considera escopo: `own` = `owner_id = auth.uid()`; `team` = mesmo grupo; `workspace` = comportamento atual.
- UI: seletor de escopo por cargo.

## Fase 6 — Auditoria, simulação e governança
- Log de mudanças em cargos/conjuntos/atribuições com diff.
- "Impersonate view" read-only: admin vê a matriz efetiva de um membro.
- Relatório "Quem pode X?".
- Export CSV do modelo de acesso.

## Ordem de execução
1. Fase 2 (destrava o dia a dia).
2. Fase 3 (segurança real).
3. Fase 4 (field-level).
4. Fase 5 (ABAC).
5. Fase 6 (governança).

## Como validar
- F2: criar cargo custom, atribuir a membro, confirmar persistência e bloqueio em `is_system`.
- F3: usuário sem `ats.jobs.delete` recebe erro ao excluir vaga; owner continua excluindo.
- F4: campo "Salário" some para cargo sem permissão em `/candidates/:id`.
- F5: cargo `own` só enxerga próprios registros.

Fora de escopo até indicação: SSO/SCIM, Access Reviews periódicas, aprovação em 2 etapas.
