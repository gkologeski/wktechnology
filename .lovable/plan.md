## Problema

Hoje a data de vencimento ("Vence 29 de Jun de 2026 16:47 GMT-3") aparece em uma linha separada abaixo do título/checkbox, alinhada à esquerda. O pedido é:

- Exibir o vencimento logo **abaixo da data de criação** (canto superior direito do item).
- Quando o vencimento estiver **no passado** e a tarefa **não estiver concluída**, exibir o texto em **vermelho** (`text-destructive`).

## Escopo

Apenas `src/components/activity-timeline.tsx`, no cabeçalho de cada item da timeline (linhas ~1338-1358). Sem mudar regras de negócio, schema, queries, edição inline ou outras seções.

Aplica-se a qualquer item com `due_date` definido (exceto `meeting`, que já tem seu próprio bloco de horários). Mantém comportamento atual para `meeting`.

## Mudanças

1. Mover o bloco `Vence {formatDateTime(a.due_date)}` para dentro da coluna direita do header, **abaixo** do `formatDateTime(a.hs_createdate ?? a.created_at)`, alinhado à direita, `whitespace-nowrap`, `text-xs`.
2. Calcular `isOverdue = a.due_date && !a.completed && new Date(a.due_date).getTime() < Date.now()`.
3. Aplicar classe `text-destructive font-medium` quando `isOverdue`; caso contrário, manter `text-muted-foreground`.
4. Continuar ocultando para `a.type === "meeting"` (mantém o bloco de horários existente).
5. Remover a linha antiga abaixo do header para não duplicar.

## Validação manual

- Tarefa com vencimento futuro: aparece em cinza no canto superior direito, abaixo da data de criação.
- Tarefa vencida e não concluída: aparece em vermelho.
- Tarefa vencida e concluída: volta ao cinza (sem alarmar).
- Reuniões continuam exibindo o bloco de horário/local como antes.
- Light/dark mode e responsividade preservados.

## Fora de escopo

- Página `/tasks/:id`, composer, edição inline, outros módulos.
- Qualquer alteração em filtros, ordenação ou persistência.
