# Mostrar o preset nos itens da cotação

## O que está acontecendo

Os itens da cotação gravam o preset corretamente (os três itens da cotação de DataBite têm preset). O problema é só de exibição: o modelo visual usado ("Prosposta 001") imprime o item pelo campo `{{name}}`, que contém apenas o título do serviço ("Outsourcing de TI"). O rótulo padronizado com quantidade e preset existe (`{{display_name}}`), mas nenhum dos 5 modelos cadastrados usa esse campo.

## Solução proposta

Fazer o `{{name}}` do item passar a imprimir o rótulo padronizado — `Outsourcing de TI x1 (Desenvolvedor Java Sr)` — em todos os modelos, atuais e futuros, sem precisar reeditar modelo nenhum.

- O título cru do item continua disponível em um campo próprio (`{{item_title}}`) para quem quiser só o nome.
- `{{display_name}}` continua funcionando igual (mesmo valor).
- Vale para a cotação pública, o PDF e a pré-visualização do modelo.
- O bloco de tabela de itens do editor visual passa a gerar `{{display_name}}` nos modelos novos.
- Itens antigos sem serviço ou sem preset seguem o fallback atual: usam o título e não geram parênteses vazios.

Nada muda em valores, descontos, impostos, totais, permissões, banco ou regras de negócio.

## Detalhes técnicos

- `src/routes/quote.$token.tsx` e `src/routes/api/public/quotes/$token.pdf.ts`: no contexto de item, `name` recebe `formatLineItemIdentity(...)` e o valor cru vai para `item_title`; `display_name` mantido.
- `src/lib/quote-template-renderer.ts`: tipo `QuoteRenderContext` ganha `item_title`; dados de exemplo (preview) e catálogo de tokens atualizados (`{{item_title}}` documentado, `{{name}}` descrito como "Serviço, quantidade e preset").
- `src/lib/quote-template-blocks.ts` (linha do bloco de itens): `{{name}}` → `{{display_name}}` no HTML gerado.
- Sem migration e sem alteração em modelos já salvos no banco.

## Validação

- Testes unitários do renderizador cobrindo item com preset, sem preset e sem serviço.
- `bun run typecheck`, `bun run lint` e `bun run test`.
- Conferência manual: reabrir a cotação pública e o PDF da cotação de DataBite e ver os três itens com preset entre parênteses.
