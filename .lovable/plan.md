## Ajuste — alinhamento do campo Desconto

O toggle `% / R$` está no mesmo bloco do label "DESCONTO", tornando a linha do label mais alta que as demais (QTD, PREÇO, IMP %) e empurrando o input para baixo, quebrando o alinhamento horizontal da grade.

### Correção
Em `src/components/deals/deal-line-items.tsx`, no bloco do campo Desconto:

- Manter o label "DESCONTO" na mesma linha/altura dos outros labels (apenas texto, sem o toggle).
- Posicionar o toggle `% / R$` **sobreposto à direita do input** via `relative` no wrapper do input + `absolute right-1 top-1/2 -translate-y-1/2` no toggle, reduzindo o tamanho dos botões (`h-5 text-[10px]`) e adicionando `pr-14` no input para não sobrepor o valor.
- Alternativa mais simples se sobreposição atrapalhar leitura: manter o toggle fora, mas fixar `h-4` no container do label (igual aos outros) e mover o toggle para dentro do próprio input como adorno à direita.

Resultado: os quatro inputs (Qtd, Preço, Desconto, Imp %) ficam alinhados na mesma linha base, e o toggle `%/R$` continua acessível junto ao campo de desconto.

### Arquivo
- `src/components/deals/deal-line-items.tsx` — apenas o JSX do bloco Desconto e classes utilitárias. Sem mudanças de lógica.

### Fora do escopo
- Cálculo, cache, persistência ou qualquer outra alteração funcional.
