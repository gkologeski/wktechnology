# Barras laterais um pouco maiores nas fichas com linha do tempo

Nas fichas de Leads, Contatos, Empresas, Negócios e Tickets, as colunas da esquerda e da direita ficam um pouco mais largas. A linha do tempo continua no centro e ocupa o espaço restante. As telas do TechHire (candidatos e vagas) não mudam.

## Larguras

| Tela | Esquerda (atual → nova) | Direita (atual → nova) |
| --- | --- | --- |
| Grande (a partir de 1280 px) | 260 → 300 px | 300 → 340 px |
| Muito grande (a partir de 1536 px) | 280 → 320 px | 320 → 360 px |

Em telas menores que 1280 px as colunas continuam empilhadas, como hoje.

## Detalhes técnicos
- Arquivo: `src/components/record/record-layout.tsx`.
- Quando `synchronizedTimeline` estiver ativo, usar `xl:grid-cols-[300px_minmax(0,1fr)_340px]` e `2xl:grid-cols-[320px_minmax(0,1fr)_360px]`. Sem a flag, manter as classes atuais.
- Antes de editar, confirmar no código que só as fichas comerciais ativam `synchronizedTimeline` e as fichas do TechHire não.
- Verificar no navegador em 1280 px e em 1536 px, numa ficha de negócio, que a página não ganha rolagem horizontal.
