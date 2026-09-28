# Rótulo de total nas barras do gráfico "Contatos por dia"

Adicionar, no gráfico "Contatos por dia" de `/dashboard`, o rótulo do **total diário** no topo de cada barra empilhada (soma de ligações, e-mails, WhatsApp, reuniões e outros).

## O que muda

- `src/components/deals/dashboard/contacts-chart.tsx`: adicionar um `LabelList` de rótulo customizado posicionado no topo da última série empilhada ("Outros"), lendo o campo `total` do registro do dia.
- O rótulo mostra o total do dia (ex.: "7"); dias com total zero não exibem rótulo, para não poluir o eixo.
- Estilo do rótulo segue os tokens existentes (cor de texto terciária, fonte 11px, igual aos eixos), funcionando em light e dark mode.

## Detalhes técnicos

- Recharts: em barras empilhadas, o `LabelList` precisa estar dentro de uma `Bar` para ser renderizado acima da pilha; usa-se `dataKey` nulo com `content={(props) => ...}` que acessa `props.value`/payload e devolve o `total` do dia.
- Posicionamento: `position="top"` sobre a última série da pilha (`other`), que já tem raio arredondado no topo.
- Sem alteração de dados, server functions, tipos ou layout — apenas o componente gráfico.

## Validação

- `bun run lint` (arquivo alterado) e `bun run typecheck`.
- Verificação visual no `/dashboard` (light e dark): rótulos visíveis em todos os dias com dados, gráfico legível em desktop e largura estreita.

## Fora de escopo

Não altera cálculo dos dados, fuso (GMT-3 já aplicado), filtros, demais blocos do painel ou o módulo TechHire.
