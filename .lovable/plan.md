# Corrigir o card de detalhe do contrato no seletor "Contrato principal"

## Problema

No seletor de "Contrato principal" (workflows), o card com vigência e valor é posicionado de forma absoluta dentro da lista de contratos, que tem rolagem própria. Resultado: ao passar 2s sobre um contrato, o card fica fora da área visível e a lista apenas ganha uma barra de rolagem "vazia".

## Correção

O card passa a ser exibido **dentro do fluxo da lista, logo abaixo do nome do contrato** em que o mouse está parado:

- Sai o posicionamento absoluto e a rolagem lateral criada por ele.
- O bloco de detalhe é inserido como um painel que ocupa a largura da linha, empurrando os itens seguintes para baixo enquanto o mouse permanece sobre o contrato.
- Mantém-se: atraso de 2 segundos, transparência de 80% com desfoque, conteúdo (vigência início–fim e valor mensal ou total) e o comportamento por foco de teclado.
- Ao sair com o mouse (ou perder o foco), o painel recolhe e a lista volta ao tamanho normal.

## Detalhes técnicos

- Arquivo: `src/components/workflows/contract-parent-picker.tsx`.
- Remover `position: absolute` / `top-full` / `z-50` do card e renderizá-lo como filho em fluxo do `<li>`, com largura total e recuo alinhado ao texto do contrato.
- Manter `bg-popover/80 backdrop-blur-sm` (tokens semânticos) e o `role="tooltip"`.
- Nenhuma alteração em consultas, server functions, schema, RLS ou regra de negócio.

## Validação manual

1. `/settings/workflows` → passo "Criar registro" → tabela Contratos → campo "Contrato principal".
2. Buscar uma empresa e clicar nela.
3. Parar o mouse 2s sobre um contrato: o card aparece abaixo do nome, legível, sem barra de rolagem vazia.
4. Retirar o mouse: o card recolhe.
5. Repetir navegando por teclado (Tab) e conferir light/dark mode.
