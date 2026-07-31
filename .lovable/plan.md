# Por que o marketing@ não vê filas de prospecção

## O que foi verificado no banco

- Existem 2 filas ("teste" e "Fila teste 001"), ambas com `owner_id` do seu usuário e `is_shared = false`.
- A tabela `prospecting_queues` tem apenas **uma** policy: `ALL` com `owner_id = auth.uid()` (leitura e escrita).
- Ou seja: hoje uma fila só é visível para quem a criou. O campo `is_shared` existe no formulário e no banco, mas **nenhuma policy o usa** — marcar "compartilhada" não muda nada.

## Por que o filtro "Todos os responsáveis" não aparece

O select de Responsável (`AssigneeFilter`) é renderizado dentro do **card de detalhe da fila selecionada** (`queue-tab.tsx`). Sem nenhuma fila visível, o card não existe e o filtro não aparece. Não é permissão: é consequência direta do item anterior.

Obs.: a diferença na quantidade de abas (seu usuário vê 10, o marketing vê 5) é o comportamento esperado do RBAC — cada aba exige sua `permission_key`.

## Plano

### 1. Tornar `is_shared` efetivo (migration)
Substituir a policy única por policies separadas, preservando a semântica atual:
- `SELECT`: dono **ou** (`is_shared = true` e o solicitante pertence ao mesmo workspace do dono).
- `INSERT`/`UPDATE`/`DELETE`: permanecem restritos ao dono (`owner_id = auth.uid()`), sem afrouxamento.
- Manter GRANTs existentes; nenhuma coluna nova, nenhum dado alterado.

A pertinência ao workspace usa a mesma resolução já adotada no projeto (`workspace_members` / `workspaces.created_by`), encapsulada numa função `SECURITY DEFINER` para evitar recursão de RLS.

### 2. Deixar o compartilhamento visível na UI
- No card/lista de filas, exibir um badge "Compartilhada" quando `is_shared`.
- No formulário de fila, rótulo e texto de ajuda explícitos: "Compartilhar com o workspace — os demais usuários poderão visualizar e trabalhar esta fila (somente o criador pode editar/excluir)".
- Em filas de terceiros, ocultar/desabilitar "Editar fila" e "Excluir fila" (o backend já recusa, mas o botão não deve prometer o que não pode).

### 3. Filtro de responsáveis
Nenhuma mudança de lógica necessária: ele volta a aparecer assim que houver fila visível. Ajuste apenas de estado vazio — quando não houver nenhuma fila, manter o `EmptyState` atual (já correto).

### 4. Marcar as filas atuais como compartilhadas
Não faremos isso por migration (é decisão sua sobre dados). Após aprovado, você marca "Compartilhar com o workspace" em "Fila teste 001" e "teste" e o marketing@ passa a vê-las.

## Detalhes técnicos

- Migration: policies de `public.prospecting_queues` + função auxiliar de workspace compartilhado.
- `src/lib/prospecting/queues.functions.ts`: `listQueues` passa a retornar também `owner_id` para a UI distinguir filas próprias das compartilhadas; `upsertQueue`/`deleteQueue` continuam restritos ao dono.
- `src/components/prospecting/queue-tab.tsx`: badge "Compartilhada", gate dos botões de editar/excluir.
- Sem alteração de schema de dados, autenticação ou catálogo de permissões.

## Como validar

1. Marcar uma fila como compartilhada com seu usuário.
2. Entrar com marketing@ em `/prospecting?tab=fila`: a fila aparece, com o filtro de Responsável no card, e sem os botões de editar/excluir.
3. Confirmar que uma fila não compartilhada continua invisível para o marketing@.
