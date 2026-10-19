# Selo ✨ em registros enriquecidos nos últimos 30 dias

## O que muda
- Aparece um ✨ ao lado do nome de Leads, Contatos e Empresas que o enriquecimento Apollo atualizou nos últimos 30 dias.
- Passando o mouse (ou com leitor de tela): "Enriquecido em dd/mm/aaaa".
- Onde: listas/grids de Leads, Contatos e Empresas, e o topo da ficha de cada um.
- Conta só enriquecimento real que alterou dados (inclusive foto). Simulações e registros sem alteração não ganham selo. Edições manuais também não.

## Fora do escopo
Nenhuma mudança no banco, permissões, nos dados ou no enriquecimento. Nada será publicado.

## Detalhes técnicos
- Fonte: `enrichment_job_items` com `status = 'ok'` e `created_at >= now() - 30 dias`, junto com `enrichment_jobs` da entidade. Os dois já respeitam o workspace (RLS).
- O motor só grava um item `ok` quando há dados alterados. Quando só a foto muda, nenhum item é gravado. Nesse caso, a foto vinda do LinkedIn (`photo_source = 'linkedin'` com `photo_updated_at` nos últimos 30 dias) também conta.
- Novo hook `useRecentEnrichment(entity, ids)`: uma consulta em lote por página visível (lotes de 200) e um mapa id → data mais recente. Nada de uma consulta por linha.
- Novo componente `EnrichedBadge`: emoji com `aria-label` e `Tooltip` do design system.
- O selo entra na célula de nome dos grids `leads.tsx`, `contacts.tsx` e `companies.tsx` e no cabeçalho das fichas. Antes de editar, confirmar a célula e o cabeçalho exatos de cada tela.
- Teste unitário para a regra dos 30 dias (29 dias mostra, 31 não), mais um teste para a regra da foto.
- Validação: typecheck, lint, testes e build, mais Playwright em Leads, Contatos e Empresas (lista e ficha, claro e escuro).
