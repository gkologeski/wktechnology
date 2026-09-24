# Superfícies operacionais configuráveis no White Label

## Objetivo
Permitir escolher, em Configurações → White Label → Superfícies, o canvas cinza-azulado e as demais superfícies do novo Design System, com prévia clara/escura e herança por módulo.

## Itens
1. **Canvas operacional** — nova cor "Canvas operacional" (claro e escuro) no grupo Superfícies, com os padrões atuais.
2. **Seletor com prévia** — aparece automaticamente no editor existente (abas Claro/Escuro, restaurar padrão, alerta de contraste, derivar escuro) e na prévia ao vivo, que ganha uma cena "Lista operacional" mostrando canvas, cabeçalho, faixa de filtros e painel.
3. **Controle completo** — também expor: Cabeçalho operacional, Faixa de filtros/abas, Painel, Painel suave, Painel forte e Divisória operacional.

Módulos continuam herdando do workspace e podem sobrescrever cada cor. Sem personalização, nada muda visualmente.

## Detalhes técnicos
- `src/lib/branding/tokens.ts`: adicionar 7 tokens `product-*` no grupo `surfaces`, com padrões light/dark convertidos para hex a partir dos valores atuais de `src/styles.css`. `themeToCss`/`applyBranding` já aplicam qualquer token do catálogo; os valores de `styles.css` continuam como fallback.
- `live-preview.tsx`: nova cena usando `ProductCanvas`/`ProductPageHeader`/`ProductToolbarBand`/`ProductPanel`.
- Validação Zod atual (`record<string,string>`) já aceita as novas chaves; sem migration, RLS ou mudança de server function.
- Atualizar `docs/techhire-design-system.md` (tokens configuráveis).
- Validações: typecheck, lint, testes de branding, e Playwright alterando o canvas e conferindo Negócios em claro/escuro.
