## Diagnóstico

Você está certo: **hoje não existe UI para trocar o pipeline de uma vaga**. Verifiquei o código e:

- O schema `JobSaveSchema` (`src/lib/ats/ats.functions.ts`) **não aceita `pipeline_id`**.
- A função `saveAtsJob` sempre sobrescreve com `ensureDefaultPipeline(...)` — ou seja, mesmo se o form enviasse, o backend ignoraria e forçaria o pipeline padrão.
- Nem o dialog de criação (`jobs.index.tsx`) nem a página de detalhe (`jobs.$id.tsx`) mostram um seletor de pipeline.

Por isso todas as 4 vagas (Java, React, Delphi, xispito) acabaram no pipeline padrão "RH - Seleção" — não porque você escolheu, mas porque é o único caminho hoje.

## Plano

Escopo: **apenas UI de vagas + backend do save**, sem tocar em RLS, candidatos, workflows ou o motor do pipeline.

### 1. Backend — aceitar `pipeline_id` no save da vaga
Arquivo: `src/lib/ats/ats.functions.ts`
- Adicionar `pipeline_id: z.string().uuid().optional().nullable()` em `JobSaveSchema`.
- Em `saveAtsJob`: se o cliente enviar `pipeline_id`, validar que o pipeline pertence ao workspace (consulta em `ats_pipelines` com `owner_id`) e usá-lo; caso contrário, manter o fallback `ensureDefaultPipeline`.
- `getAtsJob` já retorna `*`, então `pipeline_id` já vem para o front — não precisa mudar.

### 2. UI — dialog de criação/edição de vaga
Arquivo: `src/routes/_authenticated/(ats)/jobs.index.tsx` (dialog "Nova vaga") e o form de edição usado em `jobs.$id.tsx`.
- Adicionar um **Select "Pipeline"** dentro de um `FormSection`, listando `listAtsPipelines()` (função já existente em `src/lib/ats/pipelines.functions.ts`).
- Default: pipeline atual da vaga (edição) ou o marcado como `is_default` (criação).
- Texto de ajuda: "Define as etapas pelas quais as candidaturas desta vaga vão passar."
- Aviso ao trocar pipeline de uma vaga com candidaturas ativas: `AlertDialog` de confirmação — "As etapas atuais dos candidatos podem não existir no novo pipeline." Sem migração automática de etapa (fora do escopo).

### 3. UI — cabeçalho da página da vaga
Arquivo: `src/routes/_authenticated/(ats)/jobs.$id.tsx`
- Exibir o nome do pipeline atual como uma `MetaPill` clicável ao lado das outras meta-infos (status, localização, etc.).
- Clique abre o mesmo dialog de edição já focado no campo Pipeline.

### 4. Ação em massa (opcional, marcar no plano mas confirmar antes)
Na listagem `/jobs`, adicionar "Alterar pipeline" na `BulkActionBar` para trocar várias vagas de uma vez. **Só implemento se você confirmar** — dá para ficar para depois.

## Fora do escopo
- Não migra automaticamente as etapas dos candidatos ao trocar pipeline.
- Não altera schema do banco (coluna `pipeline_id` já existe).
- Não mexe em RLS, workflows ou pipeline-insights.

## Validação manual
1. Abrir `/jobs/<id>` → editar → conferir novo campo "Pipeline" com pipelines do workspace.
2. Criar uma vaga escolhendo outro pipeline → conferir no banco que `pipeline_id` foi persistido corretamente.
3. Trocar pipeline de uma vaga que tem candidatos → aparece o alerta antes de salvar.
4. Voltar ao pipeline "RH - Seleção" e conferir que a vaga volta a aparecer nele em `/pipelines`.

Confirma que posso implementar? Diga também se quer incluir a **ação em massa** do item 4.