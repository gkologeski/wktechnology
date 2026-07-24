## Objetivo

Deixar a UI de "Condição" na criação/edição de regras de Scoring (/prospecting → Scoring → Nova regra) igual ao padrão usado no Workflow Builder (`FilterRow`), com Campo/Operador/Valor todos formatados como Selects tipados usando o catálogo de campos da entidade.

## Escopo

Arquivo único: `src/routes/_authenticated/settings.scoring.tsx` (a mesma página é reutilizada pela aba Scoring de `/prospecting`). Nenhuma alteração de backend, RLS, schema ou server functions.

## Mudanças

1. **Buscar campos da entidade selecionada** via `getEntityFieldCatalog` de `@/lib/entity-fields.functions`, mapeando o `entity` da regra (singular: `lead`/`contact`/`company`) para o valor plural aceito pelo catálogo (`leads`/`contacts`/`companies`) com `useQuery` + `useServerFn`, seguindo exatamente a mesma forma do `useEntityFieldOptions` do workflow-builder.
2. **Substituir o `Input` texto do "Campo"** por um `Select` com as opções do catálogo (mesma UX do `FilterRow`): trigger com placeholder "Selecionar propriedade", `SelectContent` com `max-h-72`, itens exibindo `f.label`.
3. **Renderização adaptativa do "Valor"**, replicando o `FilterRow`:
   - Se o campo selecionado tem `options` (select/status/stage): `Select` com essas opções.
   - Senão: `Input` com `type` derivado (`number`/`date`/`text`) e coerção numérica quando aplicável, exatamente como no workflow.
   - Mantém a regra de "não exibir valor" para operadores `is_empty` / `is_not_empty` (já existente via `NEEDS_VALUE`).
4. **Reset defensivo do valor** ao trocar de campo (evita "site" persistir quando o novo campo é numérico/date), mesmo comportamento efetivo do workflow.
5. **Manter tudo mais igual**: nome, entidade, pontos, operadores, salvamento, layout do Sheet, textos, atalhos.

## Fora de escopo

- Não altero a shape do payload salvo (`condition: { field, op, value }`) — apenas a UI de entrada. O engine de scoring segue funcionando com os mesmos valores.
- Não mexo em `src/components/workflows/*` nem extraio hook compartilhado (para não arrastar refactor); reuso a mesma implementação inline de 6 linhas.
- Não altero a listagem de regras nem o log de aplicações.

## Validação

- `bun run typecheck` (ou script equivalente do projeto).
- Verificação manual em /prospecting → Scoring → Nova regra:
  - Campo vira dropdown com labels do catálogo para Lead/Contato/Empresa.
  - Trocar Entidade recarrega os campos.
  - Campo com options (ex.: status/stage) exibe Select no Valor; campos numéricos abrem input `number`; datas abrem `date`.
  - Operadores `is_empty`/`is_not_empty` continuam ocultando o Valor.
  - Salvar/editar regra existente preserva `condition.field`.
