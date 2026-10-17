# Cabeçalho do Negócio mais baixo (de ~225 px para ~110 px)

O cabeçalho da ficha de Negócio fica bem mais compacto, abrindo espaço para a janela de atividades. Nada é removido: título, valor, data de fechamento, empresa, funil, excluir, etapas e substatus continuam lá.

## O que muda
- **Linha 1:** voltar, ícone menor, título com etapa e, na mesma linha, valor, fechamento e empresa. O funil e o botão excluir ficam à direita, sem descer para uma segunda linha.
- **Linha 2:** a barra de etapas e, ao lado dela, o seletor de substatus compacto, sem o rótulo "Substatus" em cima. O nome continua disponível para leitores de tela.
- Os nomes das etapas não quebram mais em duas linhas ("1. Escopo/Solução" fica numa só linha, cortado com reticências se faltar espaço; o nome completo aparece ao passar o mouse).
- Menos espaço em branco entre as partes do cabeçalho.
- Em telas estreitas, os itens descem para a linha de baixo, como já acontece hoje.

## Detalhes técnicos
- `src/routes/_authenticated/deals.$id.tsx`: header `py-4`→`py-2`; ícone `h-12 w-12`→`h-9 w-9`; remover o rótulo "Negócios" (o botão voltar já leva a Negócios); a linha de metadados entra no mesmo flex do título; container das ações com `sm:flex-nowrap` e `ml-auto`; o bloco das etapas sai de `mt-4 pt-4` para `mt-2 pt-2` e vira `flex items-center gap-3` (tracker `flex-1 min-w-0`, substatus `w-56 shrink-0` com select `h-8`).
- `SubstatusSelect`: verificar se aceita esconder o rótulo visual; se não aceitar, passar uma classe que use `sr-only` no rótulo sem mudar o comportamento.
- `src/components/stage-tracker.tsx`: `whitespace-nowrap truncate` no texto + `title` com o nome completo.
- Ficha de Lead usa o mesmo tracker; ela só ganha o texto sem quebra.
- Conferir no navegador em 1496 px e 1280 px medindo a altura do cabeçalho.
