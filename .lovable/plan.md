## Objetivo

No diálogo "Testar workflow com registro" (Settings → Workflows), substituir o input livre de UUID por um **combobox buscável** que lista registros da entidade do workflow (Leads, Contatos, Empresas, Negócios, Tickets, Vagas, Candidatos, Aplicações, Entrevistas), com nome amigável. O UUID continua sendo o valor enviado ao `testWorkflow`, mas o usuário nunca precisa vê-lo/digitá-lo.

## Escopo

Somente a UX do teste. Nenhuma mudança na engine de workflows, no `testWorkflow`, RLS ou schema.

## Mudanças

### 1. Server function nova — `src/lib/workflow-refs.functions.ts`

Adicionar `searchEntityRecords` (padrão dos `searchCompanies`/`searchContacts` já existentes):

- Input: `{ entity: WorkflowEntity, q?: string, ids?: uuid[] }` validado por Zod.
- Usa `context.supabase` (RLS aplica — só devolve o que o usuário enxerga).
- Para cada `entity`, escolhe colunas e monta rótulo:
  - `leads`: `first_name`, `last_name`, `company_name`, `email` → "Nome Sobrenome — Empresa".
  - `contacts`: `first_name`, `last_name`, `email` → "Nome Sobrenome" (fallback e‑mail).
  - `companies`: `name`.
  - `deals`: `name`.
  - `tickets`: `subject` (fallback `id`).
  - `ats_jobs`: `title`.
  - `ats_candidates`: `first_name`, `last_name`, `email`.
  - `ats_applications`: join simples com candidato + vaga (`candidate:candidates(first_name,last_name)`, `job:ats_jobs(title)`) → "Candidato — Vaga".
  - `ats_interviews`: usar `scheduled_at` + candidato → "Candidato — dd/mm HH:mm".
- Busca livre: `ilike` nas colunas textuais relevantes via `.or(...)` (com `escapeLike`), ordenação por `updated_at desc` quando existir, senão por nome, `limit 20`.
- Hidratação por `ids`: `.in("id", ids)` — usado para exibir o rótulo do valor já selecionado se o usuário reabrir o diálogo.

Reaproveita helper `escapeLike` já existente no arquivo.

### 2. UI — `src/routes/_authenticated/settings.workflows.tsx`

Substituir o bloco atual do input UUID (linhas ~371‑378) por um combobox usando `Popover` + `Command` (padrão dos outros pickers do app, ex.: `FkPicker`/`OwnerField`):

- Trigger: botão com o rótulo do registro selecionado ou placeholder "Selecionar registro…".
- Ao abrir: chama `searchEntityRecords({ entity: testTarget.entity, q })` com debounce (~200 ms).
- Ao selecionar: guarda `id` em `testEntityId` (estado já existente) e o rótulo em novo estado `testEntityLabel` para exibição.
- Se o usuário quiser digitar o UUID manualmente (fallback avançado), oferecer link secundário "Colar UUID" que revela o `<Input>` atual — mantém a rota de escape.
- Reset de `testEntityLabel` ao trocar de workflow / fechar diálogo (mesmo `onOpenChange` que já limpa `testEntityId`).
- Botão "Executar teste" continua desabilitado enquanto `!testEntityId`.

Nenhuma outra parte do arquivo é alterada.

## Fora de escopo

- Alterar `testWorkflow` server fn.
- Alterar builder de workflows, engine, filtros, RLS.
- Suporte a entidades adicionais fora das 9 já em `WorkflowEntity`.

## Validação manual

1. Settings → Workflows → em um workflow de `deals`, clicar "Testar".
2. Abrir o combobox: aparece lista de negócios recentes com nomes.
3. Digitar "Grao" → filtra por `ilike`.
4. Selecionar → "Executar teste" habilita; resultado (`triggerOk` + `log`) igual ao fluxo atual.
5. Repetir para `contacts`, `companies`, `leads`, `tickets`, `ats_jobs`, `ats_candidates`, `ats_applications`, `ats_interviews`.
6. Fluxo "Colar UUID" ainda funciona para casos avançados.
