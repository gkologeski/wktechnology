
# Picker inteligente para campos vinculados ao banco

## O padrão de referência

No diálogo "Criar lead" o campo **Empresa** é um `Input` de texto que, a partir de 3 caracteres, busca no banco com `ilike`, mostra uma lista de "Empresas parecidas" embaixo e — ao clicar — vincula o registro. Se nenhuma corresponder, o texto vira o nome da empresa nova. Esse padrão resolve dois problemas que afligem os outros campos do sistema:

1. `<Select>` carrega 500 itens de uma vez, sem busca, sem teclado, e fica lento;
2. campos puros de texto (sem busca) duplicam registros porque o usuário não vê o que já existe.

## O que vou criar

Um componente reutilizável **`<EntityCombobox>`** em `src/components/ui/entity-combobox.tsx`, com a mesma inteligência do campo Empresa, baseado em `Command + Popover` do shadcn (já presentes no projeto):

- input de busca com debounce de 250 ms;
- consulta o Supabase com `ilike` no campo de label;
- lista resultados com teclado e mouse;
- estado "vinculado" (chip verde com ícone) quando um item é selecionado;
- dois modos:
  - **`mode="pick"`** — só seleciona registros existentes. Retorna `id`. Usado quando o backend exige um FK (ex.: `product_id`, `primary_contact_id`).
  - **`mode="pick_or_create"`** — aceita texto livre se nada bater (ex.: nome de empresa novo). Retorna `{ id?, label }`.
- props: `entity` (`companies` | `contacts` | `deals` | `products` | …), `labelField`, `extraSelect`, `searchFields`, `value`, `onChange`, `placeholder`, `icon`.

Não vai depender de carregar a lista inteira no mount — a consulta sempre é por demanda. Isso elimina os `useQuery` que hoje puxam 500 registros só para popular um `<Select>`.

## Onde vou trocar

Apenas campos que apontam para tabelas do banco. Selects de enum (status, prioridade, intervalo, etapa do pipeline) ficam como estão.

| Arquivo | Campos | Modo |
|---|---|---|
| `src/components/deals/deal-detail-drawer.tsx` | Empresa, Contato principal | `pick` |
| `src/components/deals/deal-line-items.tsx` | "Adicionar do catálogo" (produto) | `pick` |
| `src/routes/_authenticated/tickets.tsx` (diálogo de criar/editar) | Contato, Empresa, Negócio | `pick` |
| `src/routes/_authenticated/settings.recurring.tsx` (diálogo "Nova assinatura") | Contato | `pick` |

`create-lead-dialog.tsx` e `create-deal-from-lead-dialog.tsx` já têm o comportamento alvo — não serão tocados, mas serão a referência visual para o estado "vinculado" do novo componente.

## Fora do escopo

- Filtros de tela (Toolbar de leads/deals/tickets) — funcionam diferente, filtram por FK e não selecionam um único registro.
- Migrar selects de enum.
- Mudanças de schema ou RLS.
- Renomear/criar rotas.
