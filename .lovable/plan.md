## Problema

Nas telas de registro (ex: `/leads/:id`, `/candidates/:id`) o layout de 3 colunas ativa a partir de `lg` (1024px). Em viewports intermediários (~1053px do print, com sidebar do app ocupando espaço), a coluna central fica com ~200-250px e o texto quebra caractere-a-caractere ("Nenhum resumo ainda...", "cmo@gralhaimoveis.com.br", "Marcel quer fazer um..." verticalizado).

Causa: em `src/components/record/record-layout.tsx` as colunas fixas (260px + 300px = 560px) somadas ao sidebar de navegação não deixam largura útil no `lg`.

## Escopo

Somente ajuste de layout/responsividade em `src/components/record/record-layout.tsx`. Sem alterações de dados, RLS, rotas, componentes filhos ou lógica de negócio.

## Mudanças

1. Elevar o breakpoint do grid de 3 colunas de `lg` para `xl` (1280px), garantindo que em viewports entre 1024–1279px as colunas empilhem em vez de espremer o centro.
2. Introduzir um estágio intermediário: no `lg` empilha em 1 coluna (mais legível que 3 colunas espremidas). No `xl` retoma o layout de 3 colunas.
3. Manter `min-w-0` em todas as colunas (já presente) e não mexer no restante do arquivo.

Diff conceitual da linha 27:

```
- grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_300px] 2xl:grid-cols-[280px_minmax(0,1fr)_320px]
+ grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)_300px] 2xl:grid-cols-[280px_minmax(0,1fr)_320px]
```

## Fora do escopo

- Não alterar `PropertiesPanel`, `AiSummaryPanel`, `ActivityTimeline`, `AssociationsPanel`.
- Não mexer na sidebar principal do app.
- Não redesign de tipografia ou tokens.

## Validação

- `bunx tsgo --noEmit`.
- Verificar visualmente `/leads/:id` e `/candidates/:id` em viewports 1024px, 1053px (o do print), 1280px e 1440px — em `<xl` deve empilhar; em `≥xl` volta ao 3-col.
- Verificar que emails longos e resumos não quebram caractere-a-caractere.

## Riscos

Baixo — o layout apenas empilha mais cedo. Usuários em telas 1024–1279px verão colunas empilhadas, o que é mais legível do que a versão atual espremida.
