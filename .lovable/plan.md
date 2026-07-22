## Diagnóstico do bug

A tabela `people_psychosocial_assessments` usa a função `can_manage_person(person_id)` no INSERT/UPDATE/DELETE. Essa função chama:

```
is_workspace_admin_v2(auth.uid(), p.owner_id)
```

Mas a assinatura correta é `is_workspace_admin_v2(_workspace, _user)` — os argumentos estão **invertidos**. Resultado: praticamente ninguém passa no WITH CHECK, e o INSERT bate no RLS mesmo para admins reais. Além disso, ao contrário de `can_view_person_sensitive` (que já foi expandida para cobrir workspaces pessoais, profile vinculado e RBAC granular), a `can_manage_person` só considera admin — quem tem `techpeople.wellbeing.*` via cargo/pacote não consegue gravar.

## Escopo do plano

### 1. Corrigir bug de gravação de avaliação psicossocial (migration)

Recriar `public.can_manage_person(_person_id uuid)` com:

- Ordem correta `is_workspace_admin_v2(p.owner_id, auth.uid())`.
- Fallbacks equivalentes ao `can_view_person_sensitive`:
  - `p.owner_id = auth.uid()` (workspace pessoal).
  - `p.profile_id = auth.uid()` (a própria pessoa registrando auto-avaliação).
  - `user_has_permission(auth.uid(), p.owner_id, 'techpeople.wellbeing.assessments.manage.workspace')`.
  - `user_has_permission(auth.uid(), p.owner_id, 'techpeople.wellbeing.incidents.manage.workspace')` (para incidentes, que também usam `can_manage_person`).

Sem alterar as políticas em si (mantém `psych_*` e `incidents_*` como estão).

### 2. Auditoria das telas do TechPeople

Passar por cada rota/aba e reportar problemas visíveis. Escopo de correção **apenas** para bugs encontrados durante a auditoria (não redesenhar telas em bom estado). Áreas a revisar:

- Ficha 360° `/people/$id`: abas Identificação, Trabalho, Documentos, Benefícios, Timesheet, Onboarding, Offboarding, Performance (OKRs/1:1/Reviews), Psicossocial, Incidentes, Notas.
- Rotas agregadas: `/people/psychosocial`, `/people/incidents`, `/people/benefits`, `/people/onboarding`, `/people/offboarding`, `/people/analytics`, `/people/my-team`, `/people/onboarding-templates`.
- Diálogo `NewPersonDialog` e edição de pessoa.
- Timesheet (`/people/$id` aba + tela de aprovação/faturamento).
- Sidebar do TechPeople (`menu-config-people.ts`) — validar se todas as rotas estão ativas e sem duplicação.

### 3. Correções detectadas

Cada achado será resolvido dentro do padrão do design system (tokens, PageHeader, EmptyState/LoadingSkeleton/ErrorState, PT-BR, foco/acessibilidade), **sem** alterar regras de negócio ou permissões além do fix do item 1.

## Detalhes técnicos

- Migration única, idempotente, com `CREATE OR REPLACE FUNCTION public.can_manage_person`.
- Sem alterar `owner_id` no INSERT do server function — o payload atual (`owner_id = active_workspace_id`) já é compatível.
- Após aplicar a migration, testar salvar a avaliação psicossocial na pessoa `75ffe432-…` e revalidar as políticas via `supabase--linter`.
- Auditoria feita lendo arquivos e navegando via Playwright quando necessário; correções entregues em edits pontuais.

## Como validar

1. Abrir ficha da pessoa → aba Psicossocial → "Nova avaliação" → preencher e Salvar → deve gravar sem erro de RLS.
2. Repetir com um usuário não-admin que tenha `techpeople.wellbeing.assessments.manage.workspace`.
3. Percorrer as demais rotas do TechPeople listadas e verificar loading/empty/error e ações principais.
