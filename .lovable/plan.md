# Padronizar paginação do sistema

Adotar a direção escolhida (numerada clássica + jump-to-page) como **único** componente de paginação, usado em Leads, Contatos, Empresas, Tarefas, Negócios e nas listagens genéricas.

## 1. Novo componente reutilizável

Criar `src/components/table-pagination.tsx` exportando `<TablePagination>` com a API:

```ts
type Props = {
  page: number;              // 0-indexed
  pageSize: number;
  total: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (n: number) => void;
  pageSizeOptions?: number[]; // default [25, 50, 100]
  isLoading?: boolean;
  entityLabel?: string;       // ex.: "leads", "contatos"
};
```

Estrutura visual (fiel ao protótipo aprovado, mas usando os tokens do design system — sem cores hard-coded indigo/slate):

- **Esquerda** — segmented control para `pageSize` (`25 / 50 / 100`). Botão ativo: `bg-primary text-primary-foreground`. Contêiner: `bg-muted` com `border`. Label em caps "Exibir".
- **Centro** — contador `Mostrando 1–50 de 5.698 {entityLabel}` em `text-muted-foreground` com números em destaque (`text-foreground font-semibold`). Pequeno dot pulsante em `bg-primary`.
- **Direita** — navegação numerada com algoritmo de janela: `1 … (c-2) (c-1) c (c+1) (c+2) … last`. Botões 36×36, `rounded-xl`. Página ativa: `bg-foreground text-background`. Hover: `bg-muted`. Setas anterior/próxima com hover translate. Divisor vertical + input "Ir para" que aceita Enter e valida o intervalo.

Comportamentos:
- Esconder "…" e os botões de borda quando `totalPages ≤ 7`.
- `total === 0` → mostra "0 de 0" e desabilita os controles.
- Wrap responsivo: em <640px, as três zonas empilham e o jump fica oculto.

## 2. Substituições

Trocar a paginação atual nos seguintes arquivos pelo `<TablePagination>`:

- `src/routes/_authenticated/leads.tsx` (rodapé que aparece truncado no print)
- `src/routes/_authenticated/contacts.tsx`
- `src/routes/_authenticated/companies.tsx`
- `src/routes/_authenticated/tasks.tsx`
- `src/components/entity-list.tsx` → remover `NumberedPagination` interna e passar a usar o novo componente
- `src/components/deals/deals-hubspot-table.tsx`

Cada substituição apenas troca o JSX do rodapé; estados (`page`, `pageSize`, `total`, `isLoading`) já existem em todos esses arquivos. Nenhuma lógica de query muda.

## 3. Detalhes técnicos

- Componente puro, sem chamadas a Supabase nem efeitos.
- Usa apenas `Button` e ícones `ChevronLeft/ChevronRight` já presentes no projeto.
- Input de jump usa estado local; só dispara `onPageChange` no `Enter` ou `blur` com valor válido (`1..totalPages`).
- `pageSizeOptions` default `[25, 50, 100]`; `entity-list` continua passando `[25, 50, 100, 200]`.
- Sem mudanças em rotas, RLS, queries ou no header das páginas. Escopo é estritamente o rodapé.

## 4. Validação

- Conferir visual no preview de `/leads` (caso original do bug — combo truncado).
- Conferir que página atual, contador e botão "próxima" funcionam em `/contacts`, `/companies`, `/tasks` e `/deals`.
- Conferir que mudar o page size reseta para a página 1 (comportamento já existente no estado pai).
