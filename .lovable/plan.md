# Fase 3 — Estender assertPermission aos handlers restantes de PSA

## Contexto

A Fase 1 aplicou RLS RESTRICTIVE em todas as tabelas dos módulos PSA (proteção real do banco). A Fase 2 aplicou `assertPermission` nos handlers principais de **contracts, projects (core), people (core), ats jobs e ats candidates**.

Restam ~15 arquivos de server functions com mutações que hoje contam apenas com RLS — funciona, mas devolve erros PostgREST crus em vez de mensagens PT-BR amigáveis e não registra auditoria em `access_audit_log`.

O objetivo desta fase é **paridade de UX + defense-in-depth** nos módulos restantes, sem alterar RLS nem lógica de negócio.

## Escopo

### TechService (2 arquivos)
- `src/lib/services.functions.ts` — `createService`, `updateService`, `deleteService`, `activateService`.
- `src/lib/kb.functions.ts` — `upsertKbCategory`, `deleteKbCategory`, `upsertKbArticle`, `deleteKbArticle`, `seedStarterKb`.

### TechPeople sub-módulos (7 arquivos)
- `allocations.functions.ts` — CRUD de alocações.
- `benefits.functions.ts` — CRUD de benefícios.
- `documents.functions.ts` — CRUD de documentos (com atenção à sensibilidade PII).
- `performance.functions.ts` — goals, reviews, 1:1s.
- `wellbeing.functions.ts` — incidentes e avaliações psicossociais.
- `timesheet.functions.ts` — apontamentos e aprovações.
- `onboarding.functions.ts` — templates, planos, tarefas, offboarding.

### TechHire complementares (1 arquivo)
- `src/lib/ats/candidate-detail.functions.ts` — `removeCandidateFromPool` e handlers auxiliares que fazem write.

### TechService — Tickets (writes espalhados)
- `src/lib/tickets-notify.functions.ts`
- `src/lib/live-chat.functions.ts` (writes em `tickets` e `live_chat_messages`)
- `src/lib/portal.functions.ts` (portal externo — checar se aplica RBAC ou é público)

## Padrão a aplicar

Idêntico ao usado na Fase 2:

```ts
import { assertAnyPermission, getActiveWorkspaceId } from "@/lib/access-control/enforce.server";

// dentro do .handler():
const workspaceId = await getActiveWorkspaceId(supabase, userId);
await assertAnyPermission(supabase, userId, workspaceId, [
  "<módulo>.<recurso>.<ação>.own",
  "<módulo>.<recurso>.<ação>.workspace",
]);
```

Regras:
- **create** → `.create.own` (ou `.create.own` + `.update.workspace` quando não existir `.create.workspace`).
- **update** → `.update.own` + `.update.workspace`.
- **delete** → `.delete.workspace`.
- **approve/publish/assign** → chave específica do domínio.

Handlers de **leitura** (`list*`, `get*`) permanecem sem asserção — RLS já filtra os resultados; adicionar seria redundante e degradaria UX (tela em branco vs. lista filtrada).

## Pré-requisitos (checagem antes de codificar)

1. Confirmar que todas as chaves de permissão já existem em `public.permissions` para os recursos-alvo (`techpeople.allocations.*`, `techpeople.benefits.*`, `techpeople.performance.goals.*`, `techpeople.performance.reviews.*`, `techpeople.performance.one_on_ones.*`, `techpeople.wellbeing.incidents.*`, `techpeople.wellbeing.assessments.*`, `techpeople.timesheet.*`, `techpeople.onboarding.*`, `techservice.services.*`, `techservice.kb.*`, `techservice.tickets.*`).
2. Para chaves faltantes, **criar migration** que:
   - Insere as chaves em `public.permissions`.
   - Concede a cada `system_role` do módulo o tier apropriado (Admin=workspace, Manager=workspace, Viewer=view, Own=own) — seguindo o padrão já usado nos módulos PSA.
3. Confirmar semântica de `owner_id` em cada tabela nova alcançada (workspace_id vs auth.uid()).

## Fora do escopo

- Alterar RLS já aplicada na Fase 1.
- Alterar lógica de negócio dos handlers.
- Adicionar RBAC a rotas públicas do portal (`portal.functions.ts` só se comprovadamente autenticado).
- Refatorar UX ou componentes.
- `analytics.functions.ts`, `my-team.functions.ts`, `contract-margin.functions.ts`, `finance-sync.functions.ts` (somente leitura ou jobs internos).

## Entregas

1. **Migration** (se necessário) adicionando chaves de permissão faltantes + seed de bundles.
2. **Edição de ~12 arquivos** de server functions adicionando `assertAnyPermission` em cada mutação.
3. **Typecheck** limpo (`bunx tsgo --noEmit`).
4. **Relatório final** listando arquivos alterados, chaves de permissão adicionadas, e handlers agora protegidos vs. handlers deixados apenas com RLS (com justificativa).

## Validação manual sugerida

1. Login como usuário `viewer` → tentar criar/editar/deletar em Services, KB, People (goals, reviews, incidents, timesheet, onboarding), Candidatos → esperar toast **"Permissão negada: ..."** (HTTP 403).
2. Verificar registro em `access_audit_log` com `action='permission_denied'`.
3. Login como admin → todas as operações devem passar.

## Riscos

- Usuários legados sem `job_role` ou sem cargo mapeado para o novo recurso podem ser bloqueados. Mitigar rodando query de auditoria antes do deploy para identificar quem ficaria sem permissão.
- `onboarding.functions.ts` tem 13 handlers com muitas transições de estado — risco maior de quebra; deve ser o último a ser modificado, com revisão dedicada.

## Sub-fases sugeridas (execução incremental)

- **3.1** Services + KB (5 handlers).
- **3.2** People / allocations + benefits + documents (16 handlers).
- **3.3** People / performance + wellbeing + timesheet (22 handlers).
- **3.4** People / onboarding (13 handlers).
- **3.5** Tickets writes (portal, live-chat, notify).

Cada sub-fase entrega isoladamente: migration (se necessário) → asserts → typecheck → relatório.
