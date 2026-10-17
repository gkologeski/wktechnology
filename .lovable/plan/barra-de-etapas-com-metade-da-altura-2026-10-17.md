# Barra de etapas com metade da altura

A barra de etapas (1. Escopo/Solução … 6. Perdido) fica com cerca de metade da altura atual. Textos, cores, cliques e o seletor de substatus continuam iguais.

Essa barra é a mesma nas fichas de Negócios e de Leads, então as duas mudam juntas.

## Detalhes técnicos
- Arquivo: `src/components/stage-tracker.tsx`.
- No botão de cada etapa, trocar `py-2` por `py-0.5 leading-4` (de ~34 px para ~20 px de altura). O ícone de check continua `h-3 w-3`.
- Conferir no navegador, em 1280 px, numa ficha de negócio.
