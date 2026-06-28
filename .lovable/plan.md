
## Diagnóstico

**1. Vagas não abrem para detalhes**
- A rota `/_authenticated/(ats)/jobs/$id` existe e a página renderiza (você está nela: `/jobs/3213bc9a…`).
- O erro presente no console é `Failed to fetch dynamically imported module … virtual:tanstack-start-client-entry`. Isso é um chunk obsoleto: depois das últimas reescritas de `jobs.tsx` e `jobs.$id.tsx`, abas antigas (com bundle anterior) tentam carregar um arquivo que não existe mais e o clique em "Detalhes" falha silenciosamente.
- A correção precisa atuar em duas frentes: tornar o `<Link>` resistente a falha de import dinâmico (fallback para `window.location` quando o lazy import rejeita) e adicionar um listener global que recarrega a aba quando um `chunk load error` é detectado.

**2. Kanbans não permitem mover cards**
- `/_authenticated/(ats)/jobs.tsx` (Kanban por Status e por Departamento) usa `JobKanbanCard` apenas como `<Link>` — sem `draggable`, sem `onDragStart`, e as colunas sem `onDragOver`/`onDrop`.
- `/_authenticated/(ats)/candidates.index.tsx` (Kanban por status derivado) idem.
- Apenas o pipeline dentro de `jobs.$id.tsx` (candidatos por estágio) já tem DnD funcional.

## Escopo do que será feito

### A. Abertura de detalhes de vagas (correção de regressão)
1. Em `src/router.tsx` (ou `src/routes/__root.tsx`, onde já existe wiring global): registrar `window.addEventListener('vite:preloadError', …)` e `window.addEventListener('error', …)` para detectar `ChunkLoadError` / `Failed to fetch dynamically imported module` e fazer **um único** `window.location.reload()` (com flag em `sessionStorage` para não cair em loop). Padrão recomendado pela própria Vite.
2. Em `JobCard` e `JobKanbanCard` (lista de vagas): manter `<Link>` mas adicionar `onClick` defensivo que, em caso de exceção do router, faz `window.location.assign('/jobs/' + job.id)` como último recurso.
3. Nenhuma mudança em rotas ou no server-side; é apenas tolerância a chunks obsoletos.

### B. Kanban de Vagas — drag-and-drop
1. Tornar cada `JobKanbanCard` arrastável (`draggable`, `onDragStart` setando `dragging`) e cada coluna receptiva (`onDragOver`, `onDrop`).
2. Ao soltar no Kanban por **Status**: optimistic update local + `saveAtsJob({ id, status: novoStatus })` (server fn já existente). Toast de sucesso / rollback em erro.
3. Ao soltar no Kanban por **Departamento**: optimistic update + `saveAtsJob({ id, metadata: { ...metadata, department: novoDepto } })`. Verificar se `saveAtsJob` aceita `metadata`; se não aceitar, estender a server fn de forma aditiva (apenas mesclando o campo `department` no JSONB existente — sem tocar em outros campos).
4. Garantir feedback visual (opacity no card sendo arrastado, ring na coluna destino), foco visível e `aria-label` nas colunas.
5. Persistir estado consistente: refetch leve apenas no card afetado em caso de erro.

### C. Kanban de Candidatos — drag-and-drop com transições seguras
Status é **derivado** de ofertas/entrevistas/aplicações. Conforme decidido, só aceitar transições mutáveis e mostrar aviso nas demais:

| De → Para         | Ação                                                              |
| ----------------- | ----------------------------------------------------------------- |
| `* → archived`    | `UPDATE ats_candidates SET archived = true` (ou flag equivalente) |
| `archived → new`  | `UPDATE ats_candidates SET archived = false`                      |
| `new → in_process`| Mostrar toast: "Para mover para Em processo, associe o candidato a uma vaga." + abrir o dialog `AssociateCandidateJobDialog` já existente |
| `in_process → new`| Toast informativo: "Em processo é derivado de aplicações ativas. Encerre as aplicações para retornar a Novo." |
| Demais            | Toast: "Esta transição é derivada automaticamente e não pode ser ajustada manualmente." e rollback visual |

1. Verificar/adicionar coluna `archived boolean default false` em `ats_candidates` se ainda não existir (migration aditiva apenas se necessário). Atualizar `candidate-status.functions.ts` para considerar `archived = true` como status `archived` antes das demais derivações.
2. Criar server fn `setCandidateArchived({ id, archived })` em `src/lib/ats/ats.functions.ts`.
3. Tornar cada card do kanban arrastável e colunas receptivas. Centralizar a lógica de transição em um helper `attemptCandidateStatusTransition(from, to, candidate)` no próprio arquivo de rota.
4. Após operação bem-sucedida, refetch só do status do candidato movido (já existe `getCandidateStatuses`).

### D. Revisão e validações obrigatórias
- Rodar `tsgo --noEmit` ao final.
- Reproduzir manualmente cada kanban (drop, rollback, toasts).
- Conferir foco visível, contraste, `aria-label`, dark mode e responsividade.
- Garantir que nenhuma funcionalidade pré-existente (filtros, navegação, criação de vagas, scorecards) seja afetada.

## Fora de escopo
- Redesign visual dos kanbans.
- Mudanças em RLS, autenticação, ou regras de derivação além do necessário para `archived`.
- DnD em outras telas (Pipelines `/pipelines`, Talent Pools, etc.).
- Migração de "status do candidato" para campo persistido full — apenas `archived` será persistido.

## Detalhes técnicos (referência)

```text
Arquivos a editar:
- src/routes/__root.tsx               → listener global de chunk error (1 reload guard)
- src/routes/_authenticated/(ats)/jobs.tsx
                                      → DnD nos kanbans Status e Departamento
- src/routes/_authenticated/(ats)/candidates.index.tsx
                                      → DnD com transições seguras
- src/lib/ats/ats.functions.ts        → setCandidateArchived; possível extensão
                                        de saveAtsJob para aceitar `metadata`
- src/lib/ats/candidate-status.functions.ts
                                      → considerar archived antes das demais

Arquivos a criar:
- (nenhum novo componente; reuso de AssociateCandidateJobDialog já existente)

Migration (aditiva, somente se a coluna não existir hoje):
- ALTER TABLE public.ats_candidates ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
```
