# Associar candidato ↔ vaga (a partir do candidato e atalho global)

## Contexto

Hoje só dá para criar uma `ats_application` partindo da **vaga** (`/jobs/$id` → "Adicionar candidato"). Na tela do candidato (`/candidates/$id`) o card "Aplicações" só lista. O Quick Create (`+` no header) e o Copilot (⌘K) não têm essa ação. A server function `addApp` (em `ats.functions.ts`) já existe e aceita `{ jobId, candidateId, source }` — vamos reusar.

## Escopo

1. **Diálogo reutilizável** `AssociateCandidateJobDialog`
   - Novo componente em `src/components/ats/associate-candidate-job-dialog.tsx`.
   - Props: `open`, `onOpenChange`, `presetCandidateId?`, `presetJobId?`, `onSuccess?`.
   - Mostra apenas o(s) seletor(es) que faltam:
     - sem candidato → combobox de candidatos (busca em `ats_candidates` por nome/email, debounced).
     - sem vaga → combobox de vagas **abertas** (`status in ('open','active')`) com `title`, `seniority`, `location`.
   - Campos extras: `Estágio inicial` (default = primeiro estágio do pipeline da vaga) e `Origem` (default `manual`).
   - Botão primário: "Associar". Chama `addApp({ data: { jobId, candidateId, source, stage_value? } })`.
   - Trata erro de duplicidade (já existe application desse candidato nessa vaga) com toast amigável e link "Abrir aplicação".
   - Estados: loading, empty (sem vagas abertas), error.

2. **Ação na tela do candidato** (`src/routes/_authenticated/(ats)/candidates.$id.tsx`)
   - No `ApplicationsCard`, header recebe `action`: botão `Associar a vaga` (ícone `Plus`).
   - Abre o diálogo com `presetCandidateId = detail.id`.
   - `onSuccess`: invalida a query do detalhe (refetch) + toast.

3. **Quick Create global** (`src/components/quick-create-menu.tsx`)
   - Novo item "Candidatura" (ícone `Briefcase` + `UserPlus`) na categoria TechHire.
   - Como o item não navega para uma rota com `?create=1`, abrir o diálogo via estado local do `QuickCreateMenu` (sem `presetCandidateId`/`presetJobId`).
   - Visível apenas quando o módulo ativo é ATS (`useActiveModule() === 'ats'`) para não poluir o CRM.

4. **Atalho no Copilot ⌘K** (`src/components/copilot-cmdk.tsx`)
   - Nova ação "Associar candidato a uma vaga" no grupo de ações ATS.
   - Dispara um `window.dispatchEvent(new CustomEvent("ats:associate-open"))`.
   - O `QuickCreateMenu` (ou um listener leve no shell ATS) escuta o evento e abre o mesmo diálogo neutro. Mantém uma única fonte de UI.

5. **Refatorar `/jobs/$id`** (opcional, mesma PR)
   - Substituir o diálogo inline atual pelo `AssociateCandidateJobDialog` com `presetJobId = id`. Mantém o mesmo comportamento e remove duplicação.

## Detalhes técnicos

- **Server fn**: reusar `addApp` existente. Se ela ainda não aceita `stage_value` opcional, estender o `inputValidator` para `stage_value: z.string().optional()` e, no handler, usar o estágio recebido ou o primeiro do pipeline. Sem mudança de RLS / schema.
- **Listagens dentro do diálogo**: usar server fns já existentes (`listCands` para candidatos, `listJobs` filtrado por status aberto). Limitar a 50 com busca server-side se a lista for grande.
- **Invalidação**: `queryClient.invalidateQueries({ queryKey: ["candidate-detail", candidateId] })` e, quando vier de `/jobs/$id`, `["job-pipeline", jobId]`.
- **A11y / UX**: foco inicial no combobox que falta, Enter envia, Esc fecha, `aria-live` para erros. Seguir Quiet Premium: `AtsPageHeader` não se aplica (é dialog) — usar `DialogHeader` + `FormSection` interno.
- **Tokens**: nenhum hardcoded; só componentes oficiais (`Dialog`, `Combobox`/`Command`, `Button`, `Select`).

## Não-escopo

- Não criar bulk associate (vários candidatos de uma vez).
- Não mexer em schema, RLS, ou no fluxo de candidatura pública (`/careers/$slug`).
- Não adicionar atalho no CRM Quick Create.
- Não trocar a forma de mover entre estágios.

## Validação manual

1. `/candidates/<id>` → card "Aplicações" → "Associar a vaga" → escolher vaga aberta → confirma → aparece na lista e na vaga.
2. Tentar associar o mesmo candidato à mesma vaga → toast de duplicidade.
3. `+` no header (em contexto ATS) → "Candidatura" → escolher candidato + vaga → criada.
4. ⌘K → "Associar candidato a uma vaga" → abre mesmo diálogo neutro.
5. `/jobs/<id>` → "Adicionar candidato" continua funcionando (agora pelo diálogo unificado).
6. Verificar dark mode, responsivo (mobile) e foco visível.

## Riscos / Pendências

- Listas grandes de candidatos/vagas: combobox precisa de busca server-side; se ainda não existir, adicionar `query` opcional em `listCands`/`listJobs`.
- Se `addApp` não retornar a application criada, ajustar para retornar `{ id, stage_value }` para permitir "Abrir aplicação" no toast de sucesso.
