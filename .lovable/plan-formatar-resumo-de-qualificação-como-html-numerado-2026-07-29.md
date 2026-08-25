# Formatar resumo de qualificação como HTML numerado

## Onde

`src/components/prospecting/qualification-panel.tsx`, no `useMemo` `qualificationSummary` (hoje monta texto puro em `lines`).

## O que muda

Gerar HTML (o campo Descrição usa `RichHtmlEditor`, que aceita HTML sanitizado) no formato:

```html
<p><strong>Qualificação — {nome do questionário} (score {X}/{Y})</strong></p>
<ol>
  <li><strong>{prefixo}:</strong> {resto da pergunta}: {resposta}</li>
  ...
</ol>
```

Regras:

- Cabeçalho em `<strong>` dentro de `<p>`.
- Lista `<ol>` numerada, uma pergunta por `<li>`.
- Prefixo em negrito: se `q.label` contém `-` (padrão dos templates BANT/CHAMP/MEDDIC/GPCT — "Budget - existe orçamento…"), quebra em prefixo antes do `-` (ex.: "Budget") e resto ("existe orçamento…"). Se não houver separador, negrita o label inteiro e não repete o resto.
- Escapar HTML de `q.label` e da resposta (perguntas/respostas podem ter `<` `>` `&`) para evitar quebra de sanitização e injeção acidental.
- Formatação de valores permanece igual: booleano → "Sim"/"Não"; array → join com ", "; demais → String(raw). Perguntas sem resposta continuam ignoradas.

Nenhuma outra alteração de comportamento; `initialDescription` já flui até o modal de criar negócio via correção anterior.

## Validação manual

1. `/prospecting/queues/:id/play` com questionário padrão respondido.
2. Clicar em "Qualificar" → modal "Criar negócio" abre com Descrição pré-preenchida em lista numerada, cada item com o prefixo (Budget, Authority, Need, Timeline, etc.) em negrito.
3. Salvar o negócio e conferir em `/deals/:id` que a descrição preserva a formatação.
