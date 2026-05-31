
## Objetivo

Transformar o padrão "Empresa" do diálogo **Criar lead** num componente único reutilizável e aplicá-lo em todos os pontos da app que têm o campo Empresa, incluindo os detalhes do lead (que hoje é só um texto editável e não busca nada).

## Padrão de referência

Pego de `src/components/leads/create-lead-dialog.tsx`:

- `Input` de texto livre.
- A partir de 3 caracteres, faz `ilike` em `companies.name` (debounce 350 ms).
- Mostra uma lista "Empresas parecidas" embaixo do campo, com até N resultados.
- Ao clicar em um item: vincula (guarda `company_id`) e mostra um chip verde `Vinculada a <nome>`.
- Se nenhuma empresa bater, o texto livre vira o nome da nova empresa ao salvar.

## O que vou criar

Um único componente **`<CompanyPicker>`** em `src/components/ui/company-picker.tsx` com duas variações de comportamento via prop `mode`:

- `mode="pick_or_create"` (default) — aceita texto livre. Estado emitido: `{ id: string | null, name: string }`. Usado onde a coluna é `company_name` (texto solto, ex.: `leads.company_name`).
- `mode="pick"` — só permite selecionar uma empresa existente. Estado emitido: `{ id: string | null, name: string | null }`. Usado onde a coluna é FK `company_id` (deals, tickets).

Props principais:

```ts
type CompanyPickerValue = { id: string | null; name: string };

interface CompanyPickerProps {
  mode?: "pick" | "pick_or_create";
  value: CompanyPickerValue;
  onChange: (v: CompanyPickerValue) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  // Para o caso de já termos um id salvo e precisarmos hidratar o nome:
  hydrateById?: boolean; // default true
}
```

Internamente:

- `useEffect` de busca igual ao do create-lead-dialog (350 ms, `ilike`, limit 500, `order name asc`).
- Hidrata `name` quando recebe só `id` (faz um `select id,name` único).
- Chip "Vinculada a …" reutilizando o visual atual (`border-primary/40 bg-primary/10`, `Building2` icon).
- Toast informativo ao encontrar matches só no primeiro debounce de cada query (mantém `lastSearchedRef` igual ao componente atual) — opcional via prop `toastOnMatches` para não poluir telas como o drawer.

## Onde vou trocar

| Arquivo | Campo | Modo | O que muda |
|---|---|---|---|
| `src/components/leads/create-lead-dialog.tsx` | Empresa | `pick_or_create` | Substitui o bloco inline (Input + useEffect + matches + chip) por `<CompanyPicker>`. Comportamento e UI ficam iguais. |
| `src/components/leads/create-deal-from-lead-dialog.tsx` | Empresa | `pick_or_create` | Mesma troca, mantém a lógica de criar `companies` se id vier `null`. |
| `src/components/properties-panel.tsx` (usado em `/leads/:id`) | `company_name` | `pick_or_create` | Adicionar suporte a `type: "company"` nas `PropDef`. Quando `editing === key` e `type==="company"`, renderiza `<CompanyPicker>` em vez de `<Input>`. No `save`, grava `company_name` (texto). Também usado no diálogo "Ver todas as propriedades" para o mesmo campo. |
| `src/routes/_authenticated/leads.$id.tsx` | `company_name` | — | Acrescenta `type: "company"` na PropDef de `company_name`. |
| `src/components/deals/deal-detail-drawer.tsx` | `company_id` | `pick` | Substitui `<EntityCombobox entity="companies" ...>` por `<CompanyPicker mode="pick">`, escrevendo `value.id` em `company_id`. |
| `src/routes/_authenticated/tickets.tsx` (diálogo de criar/editar) | `company_id` | `pick` | Mesma troca do drawer. |

Não toco em `companies.$id` (é o próprio registro), nem em `contacts.$id` (não edita empresa hoje — vínculo vem do `AssociationsPanel`), nem em filtros/colunas de listagens.

## Fora do escopo

- Contato, Produto, Negócio — apesar de estarem no plano antigo em `.lovable/plan.md`, o pedido é só Empresa.
- Migração para `EntityCombobox` em telas que não têm Empresa.
- Mudanças de schema/RLS.
- Auto-criar empresa quando o usuário digita um nome novo em `pick_or_create` (continua sendo responsabilidade de quem submete o formulário — leads grava em `company_name`; create-deal-from-lead já cria `companies` quando necessário).

## Verificação

- Criar lead com empresa existente → mostra lista, chip aparece, salva `company_name` igual ao nome escolhido.
- Editar `Empresa` no detalhe do lead → mesma UX do diálogo de criação, salva em `leads.company_name`.
- Editar Empresa no drawer de deal → busca, ao escolher salva `deals.company_id`; não permite texto livre.
- Editar Empresa no diálogo de ticket → idem deal.
- Diálogo "Ver todas as propriedades" do lead → campo Empresa também usa o picker.
