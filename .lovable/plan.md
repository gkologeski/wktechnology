## Problema

No editor de questionários (`src/components/prospecting/questionnaires-tab.tsx`), o ícone `GripVertical` ao lado de cada pergunta é apenas decorativo — não há handler de drag, nem mutação de reordenação. Além disso, questionários com `is_template=true` são somente-leitura e não devem permitir reordenar (o usuário precisa duplicar primeiro).

A tabela `public.prospecting_questions` já possui a coluna `position` (integer), então não precisa de migration.

## Escopo

Habilitar drag-and-drop para reordenar perguntas dentro de um questionário **editável** (não-template) em `/prospecting → Questionários`.

## Mudanças

1. **`src/lib/prospecting/questionnaires.functions.ts`**
   - Nova server function `reorderQuestions({ questionnaire_id, ordered_ids: string[] })` que valida ownership do questionário (bloqueia se `is_template=true`) e atualiza `position` em lote respeitando RLS.
   - Ajustar `listQuestionnaireDetail` (ou o loader atual) para garantir `ORDER BY position ASC, created_at ASC`.

2. **`src/components/prospecting/questionnaires-tab.tsx`**
   - Envolver a lista de `QuestionRow` num container com HTML5 drag-and-drop nativo (mesmo padrão já usado no Workflow Builder: `draggable`, `onDragStart`, `onDragOver`, `onDrop`), sem adicionar nova dependência.
   - Estado local `orderedQuestions` sincronizado com `data.questions`; ao soltar, atualiza estado otimistamente e dispara `reorderQuestions.mutate()`; em erro, reverte e faz `invalidate`.
   - `GripVertical` vira o handle visual (cursor `grab`/`grabbing`).
   - Drag desabilitado quando `readOnly` (templates continuam intocáveis).

3. **Feedback UX**
   - Toast de sucesso silencioso ou apenas indicação visual (drop shadow durante drag).
   - Sem reordenação entre questionários diferentes (só dentro do mesmo).

## Fora do escopo

- Reordenar questionários entre si.
- Permitir reorder em templates.
- Migration de schema (coluna `position` já existe).
- Biblioteca externa de DnD.

## Como validar

1. Abrir `/prospecting?tab=questionarios`, duplicar um modelo (MEDDIC/CHAMP/GPCT).
2. Abrir o questionário duplicado, arrastar uma pergunta para outra posição — deve persistir após refresh.
3. Abrir um modelo original — o handle não deve permitir arrastar.
