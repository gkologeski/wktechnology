## Objetivo

Hoje o `CompanyPicker` (`src/components/ui/company-picker.tsx`) busca empresas só por **nome** (a partir de 3 caracteres). Vamos dar a ele a "skill" de também pesquisar por **telefone** e **domínio**, mantendo o mesmo gatilho de 3+ caracteres e o mesmo debounce.

Esse componente é o campo "Empresa" usado em criação de lead, criação de contato, painel de propriedades, associações etc. — então o ganho aparece em todo o app automaticamente.

## O que muda

1. **`src/components/ui/company-picker.tsx`**
   - Tipo `Match` passa a incluir `domain` e `phone` (nullable).
   - Query do Supabase: trocar `.ilike("name", …)` por `.or("name.ilike.%q%,domain.ilike.%q%,phone.ilike.%q%")` com `q` devidamente escapado (sem vírgula/parêntese — sanitizar para evitar quebrar o filtro `or`).
   - Continuar com `.limit(500)`, debounce 350ms, gatilho ≥ 3 chars, ordenação por `name`.
   - Lista de resultados: além do nome, mostrar uma 2ª linha discreta com `domain` e/ou `phone` quando existirem (texto `text-[11px] text-muted-foreground`). Ícone permanece `Building2`.
   - Toast "X empresas parecidas" continua igual.

2. **Sanitização do termo**
   - Função local `sanitizeOrTerm(q)` que remove `,`, `(`, `)` e `%` extras antes de injetar no `.or()` (PostgREST usa esses caracteres como separadores).

3. **Fallback de paridade (opcional, mesmo PR)**
   - `src/components/companies/company-hierarchy.tsx` já faz `name.ilike,domain.ilike` no diálogo "Vincular matriz". Acrescentar `phone.ilike` na mesma `.or(...)` para manter o comportamento consistente.

## Fora de escopo

- Não mexer em outros pickers (contatos, deals).
- Sem mudanças de schema, RLS ou server functions — é só UI/consulta client-side já permitida pelas policies atuais de `companies`.
- Sem alteração visual no input em si; só a lista de sugestões ganha a sublinha com domínio/telefone.

## Critérios de aceite

- Digitar 3+ caracteres que batem com **nome**, **domínio** ou **telefone** (parcial) traz a empresa na lista.
- Cada item mostra `nome` + (quando houver) `domínio · telefone` em cinza pequeno.
- Selecionar continua funcionando igual (`{ id, name }`), sem regressão nos formulários que usam o picker.
- Termos com caracteres especiais (`,`, `(`, `)`) não quebram a busca.
