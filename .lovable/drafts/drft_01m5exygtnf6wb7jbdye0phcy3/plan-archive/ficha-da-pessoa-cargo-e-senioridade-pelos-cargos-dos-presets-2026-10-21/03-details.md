## Detalhes técnicos
- Sem migration: `people.role_title`, `seniority`, `education`, `shirt_size`, `emergency_relationship`, `marital_status` continuam texto. Cargo grava o nome do `job_profile`; senioridade grava o rótulo (ex.: "Sênior"), compatível com o que a listagem já exibe.
- Novo `src/lib/people/person-field-options.ts` (client-safe) com as listas fixas e helper `isLegacyValue`.
- Novo `src/components/people/person-option-combobox.tsx` (Popover modal + Command, rótulo associado, item "valor anterior" quando o valor não pertence à lista) e `person-role-picker.tsx` usando `listJobProfileOptions` (busca com debounce, RBAC do catálogo já aplicado no servidor; sem permissão, cai para mostrar o valor atual somente leitura). Senioridade usa `SENIORITY_OPTIONS` de `job-profiles-shared.ts`.
- Alterar `people.$id.tsx` (aba de dados) e o diálogo "Nova pessoa" de `people.index.tsx`; estados disabled por `canWrite` preservados.
- Teste unitário de `isLegacyValue` e da regra "senioridade só preenchida se vazia".
- Validação: typecheck, lint, testes, build e Playwright na ficha `/people/$id` (abrir cada lista, escolher, salvar, reabrir), sem alterar dados reais de pessoas — teste de salvamento só reverte ao valor original na mesma sessão ou em pessoa de teste.
