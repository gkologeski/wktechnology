## Como está hoje

`src/routes/_authenticated/prospecting.index.tsx` renderiza uma `TabsList` fixa com 9 abas (Fila, Questionários, Cadências, Scoring, Playbooks, Enrichment, Busca de prospects, Scripts, Voice Agent). Não há filtro por permissão: qualquer usuário autenticado no workspace enxerga todas as abas e pode abrir qualquer conteúdo. Já existe infraestrutura de RBAC (`usePermissions`, `<Can>`, tabela `permissions` + `has_role`), mas nenhuma chave de permissão foi criada para o módulo de prospecção — por isso hoje é "tudo ou nada".

## O que sugiro

Amarrar cada aba a uma permission key do módulo `techsales` e renderizar somente as abas que o usuário tem acesso, com fallback quando ele não tem nenhuma.

### 1. Chaves de permissão (migration)

Inserir em `public.permissions` (module `techsales`), uma por aba, escopo `workspace`:

```text
techsales.prospecting.queue.view       → Fila
techsales.prospecting.questionnaires.view → Questionários
techsales.prospecting.cadences.view    → Cadências
techsales.prospecting.scoring.view     → Scoring
techsales.prospecting.playbooks.view   → Playbooks
techsales.prospecting.enrichment.view  → Enrichment
techsales.prospecting.search.view      → Busca de prospects
techsales.prospecting.scripts.view     → Scripts
techsales.prospecting.voice.view       → Voice Agent
```

Seed: conceder as 9 chaves ao access profile "admin" do workspace; conceder o subconjunto operacional (fila, questionários, cadências, scripts, playbooks) ao perfil "member/SDR". Perfis podem ser ajustados depois em `/settings/permissions`.

### 2. UI — filtrar abas em `prospecting.index.tsx`

- Ler `usePermissions()`.
- Definir array `TABS = [{ value, label, permission, Component }, …]`.
- `visibleTabs = TABS.filter(t => can(t.permission))`.
- Renderizar `TabsList` e `TabsContent` a partir de `visibleTabs`.
- Corrigir a aba ativa: se `search.tab` não estiver em `visibleTabs`, redirecionar (`navigate replace`) para a primeira visível.
- Se `visibleTabs.length === 0`, renderizar `EmptyState` "Sem acesso à prospecção" no lugar das tabs.
- Enquanto `isLoading` das permissões, mostrar `LoadingSkeleton` no header das tabs (evita flash de todas as abas).

### 3. Rota de execução da fila

`prospecting.queues.$queueId.play.tsx` também deve exigir `techsales.prospecting.queue.view` no componente (redirect para `/prospecting` com toast quando negado). Mantém o menu lateral coerente com a rota direta.

### 4. Item do sidebar

Onde o link "Prospecção" aparece no sidebar, envolver com `<Can any={[...9 chaves]}>` para ocultar o item inteiro quando o usuário não tem nenhuma das abas.

## Fora do escopo

- Não altero as server functions das abas (cada uma já valida owner/RLS). A permissão aqui é para a UI; a segurança de dados continua nas RLS existentes. Se quiser hardening server-side de cada função, faço em uma fase separada.
- Não mexo em `/settings/scoring`, `/settings/playbooks`, `/settings/enrichment`, `/settings/prospecting`, `/settings/prospecting-scripts`, `/settings/voice-agent` (rotas legadas continuam existindo).

## Arquivos afetados

- `supabase/migrations/<timestamp>_prospecting_permissions.sql` (novo) — insere as 9 keys e concede aos access profiles padrão.
- `src/routes/_authenticated/prospecting.index.tsx` — filtro por permissão + fallback + normalização da aba ativa.
- `src/routes/_authenticated/prospecting.queues.$queueId.play.tsx` — guard de `queue.view`.
- Componente do sidebar que lista "Prospecção" (identifico no build; provavelmente `src/components/layout/*`).

## Validação manual

1. Como admin: ver as 9 abas.
2. Como usuário sem permissão de scoring/voice: essas abas somem; `?tab=scoring` redireciona para "fila".
3. Como usuário sem nenhuma permissão de prospecção: item some do sidebar; acessar `/prospecting` direto mostra EmptyState.
