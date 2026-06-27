## Problema

Nos cards de `/candidates`, o texto de cargo/empresa, e-mail e localização extrapola a largura do card. A imagem mostra "Psicóloga | Performance | Desenvolvimento Pessoal @ Universidade…" cortado pela coluna ao lado.

## Causa

Em `src/routes/_authenticated/(ats)/candidates.tsx` (linhas 411–463):

1. O `<article>` é um grid item sem `min-w-0`. Grid items têm `min-width: auto` por padrão, então o conteúdo interno pode empurrar a largura para além da coluna.
2. As linhas de cargo/empresa, e-mail e localização usam `inline-flex … truncate`. `inline-flex` se dimensiona pelo conteúdo, então o `truncate` no `<span>` interno nunca dispara — o container cresce livremente.

## Correção (somente CSS, escopo da tela `/candidates`)

Arquivo: `src/routes/_authenticated/(ats)/candidates.tsx`

1. Adicionar `min-w-0 overflow-hidden` no `<article>` para que ele respeite a largura da coluna do grid.
2. Trocar `inline-flex … truncate` por `flex min-w-0 … ` nos blocos de cargo/empresa, e-mail e localização, e manter `truncate` no `<span>` filho. Em `flex`, o `min-w-0` no container permite que o filho com `truncate` calcule a largura correta.
3. Garantir que a linha "cargo @ empresa" (`<p>`) também seja `flex min-w-0` em vez de `inline-flex`, mantendo o `<span className="truncate">` que já existe.

Sem alterações em dados, server functions, RLS, layout do grid externo, MetaPill, badges, ou outras telas.

## Validação manual

1. Abrir `/candidates` com candidatos cujo `current_position`, `email` ou `location` sejam longos (ex.: importados via extensão LinkedIn).
2. Confirmar que cada card respeita sua coluna nos breakpoints `sm` (2 col) e `lg` (3 col), com reticências (`…`) ao final do texto cortado.
3. Verificar em light e dark mode que nada mais mudou visualmente (paddings, badges, skills, hover).
