## Objetivo

Após excluir um registro (via tela de detalhe ou via grid), o usuário deve voltar automaticamente ao grid/tela de origem e o grid deve refletir a exclusão sem F5.

## Diagnóstico

Auditei as telas de detalhe (`*.$id.tsx`) e vários grids. O padrão de bug é sempre o mesmo: a exclusão remove o registro e navega de volta, mas **não invalida a query da listagem**. Como a lista já está em cache, o item excluído continua aparecendo até um reload manual.

Casos com bug confirmados (deletam + `navigate` mas não invalidam a lista):

- `companies.$id.tsx` — deleta e vai para `/companies`, sem invalidar `["companies"]`.
- `contacts.$id.tsx` — idem para `["contacts"]`.
- `tasks.$id.tsx` — idem para `["tasks"]`/atividades.
- `tickets.$id.tsx` — idem para `["tickets"]`.
- `deals.$id.tsx` — idem para `["deals"]`.
- `leads.$id.tsx` — idem para `["leads"]`.

Casos já corretos (mantêm como referência):
- `services.$id.tsx`, `contracts.$id.tsx`, `proposals.index.tsx`, `projects.$id.tsx` já invalidam a lista.

Além disso, alguns grids fazem `.delete()` diretamente pelo cliente Supabase (sem passar por server function) e também não invalidam a query. Farei uma varredura completa dos grids em `src/routes/_authenticated/*.index.tsx` e `src/components/**` para aplicar a mesma correção.

## Escopo da correção

1. **Telas de detalhe (delete + voltar ao grid)** — em cada uma:
   - Antes de `navigate({...})`, chamar `qc.invalidateQueries` para a query de lista correspondente (e queries auxiliares como board/kanban quando existirem).
   - Também invalidar a query do próprio registro (`["contact", id]` etc.) para evitar reabertura em cache.
   - Manter o `navigate` para o grid pai já existente.

2. **Grids (delete inline em `*.index.tsx` e componentes de lista)** — auditar e garantir que toda ação de excluir chama `invalidateQueries` da lista após sucesso. Onde já usa `useMutation`, adicionar/ajustar `onSuccess`. Onde chama Supabase direto sem mutation, envolver em `useMutation` ou chamar `qc.invalidateQueries` no callback.

3. **Padronização** — nas telas de detalhe que usam `supabase.from(...).delete()` direto (companies, contacts, tasks, tickets, deals), manter esse caminho (para não alterar regra de negócio/RLS), apenas adicionando a invalidação. Sem mudanças de schema, RLS ou permissões.

4. **Confirmação de exclusão** — não alterar. Onde há `AlertDialog`, mantém; onde há `confirm()`, mantém. Fora do escopo pedido.

## Telas que serão alteradas

Detalhe:
- `src/routes/_authenticated/companies.$id.tsx`
- `src/routes/_authenticated/contacts.$id.tsx`
- `src/routes/_authenticated/tasks.$id.tsx`
- `src/routes/_authenticated/tickets.$id.tsx`
- `src/routes/_authenticated/deals.$id.tsx`
- `src/routes/_authenticated/leads.$id.tsx`

Grids/telas de lista (a confirmar após varredura, mas o padrão será o mesmo):
- `src/routes/_authenticated/*.index.tsx` que fazem delete inline sem invalidar (ex.: candidatos, jobs, workflows, sequences, landing-pages, files etc.).

Farei a varredura completa em build mode antes de aplicar as correções, corrigindo todas as ocorrências, e listarei arquivos alterados no relatório final.

## Fora do escopo

- Não altero RLS, permissões, políticas, schema ou lógica de negócio.
- Não mudo confirmações, UX de botões, textos ou estilos.
- Não mudo o destino de navegação de nenhuma tela — apenas garanto que a lista de destino esteja fresca.

## Validação

- `tsgo` (typecheck).
- Verificação manual do fluxo em 2–3 telas críticas (ex.: excluir contato, empresa e ticket) para confirmar que a lista atualiza sem F5.

## Detalhes técnicos

Padrão aplicado em cada ponto de exclusão:

```ts
await deleteOp(...);
toast.success("Excluído");
qc.invalidateQueries({ queryKey: ["<lista>"] });     // grid principal
qc.invalidateQueries({ queryKey: ["<detalhe>", id] }); // detalhe em cache
navigate({ to: "/<lista>" });
```

Para grids que já usam `useMutation`, adiciono/ajusto:

```ts
useMutation({
  mutationFn: ...,
  onSuccess: () => qc.invalidateQueries({ queryKey: ["<lista>"] }),
});
```
