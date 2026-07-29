# Corrigir preenchimento da descrição ao qualificar lead

## Diagnóstico confirmado

Em `src/components/leads/create-deal-from-lead-dialog.tsx` existem dois `useEffect` competindo pelo estado `description`:

- Linhas 63–68: quando `open` vira `true`, define `description = initialDescription` se estiver vazia.
- Linhas 86–138 (reset ao abrir o diálogo): sempre executa `setDescription("")` na linha 97.

Ambos os efeitos disparam no mesmo commit quando `open` passa a `true`. O `useState` inicial usa `initialDescription ?? ""`, então a condição `!description` do primeiro efeito é falsa e ele não faz nada. Em seguida o segundo efeito zera o campo. Resultado: o resumo da qualificação nunca chega ao editor.

`RichHtmlEditor` sincroniza `value` externamente (linhas 230–238 de `src/components/rich-html-editor.tsx`), então o problema é 100% do estado no diálogo — não é do editor.

## Correção

Arquivo único: `src/components/leads/create-deal-from-lead-dialog.tsx`

1. No efeito de reset (linha 97), trocar `setDescription("")` por `setDescription(initialDescription ?? "")` para que a reabertura do diálogo respeite o resumo vindo do painel de qualificação.
2. Adicionar `initialDescription` às dependências desse efeito para garantir sincronização quando o resumo mudar antes do submit.
3. Remover o efeito duplicado das linhas 63–68 (fica redundante) para evitar futuras regressões.

Nada mais é alterado. `QualificationPanel` continua enviando `initialDescription={qualificationSummary}` — já está correto.

## Validação manual

1. Abrir `/prospecting/queues/:id/play` com um lead que tenha questionário obrigatório.
2. Responder às perguntas obrigatórias e clicar em "Qualificar".
3. Conferir que o campo Descrição do modal "Criar negócio" abre pré-preenchido com o bloco `Qualificação — <nome> (score X/Y)` seguido das perguntas e respostas.
4. Editar manualmente a descrição, cancelar e reabrir: o resumo deve ser reaplicado (comportamento consistente com o pedido original).
