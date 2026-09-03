# Correção da migração de itens de linha + seletor de período pt-BR padrão

Duas frentes na mesma entrega: (1) fazer a aprovação em `/catalog/line-item-migration` efetivamente atualizar os itens; (2) padronizar todos os filtros de período do sistema no seletor pt-BR da skill. Campos de data única de formulário (vencimento, admissão, etc.) não mudam.

## 1. Bug: aprovar sugestões afeta 0 registros

Os 13 itens que sobraram têm espaço no fim do nome (`"Tech Lead "`, `"Fábrica de Software "`). Hoje a aplicação do mapeamento filtra por nome (`name in (...)`), e esse filtro por texto com espaços nas extremidades não casa de forma confiável com o valor guardado no banco — resultado: 0 linhas atualizadas.

Correção: parar de identificar itens por nome e passar a identificar por **ID do item**.

- A listagem passa a devolver, em cada grupo, os IDs dos itens sem serviço (`itemIds`).
- A aprovação recebe esses IDs e atualiza por `id in (...)`, mantendo a trava `service_catalog_id IS NULL` (idempotência) e sem tocar quantidade, preço, desconto ou imposto.
- Mantém o retorno por grupo (`results`) e o aviso na tela quando um grupo atualiza 0 itens, agora indicando que o item já foi classificado ou está fora do acesso do usuário.
- Após aprovar, a tela recarrega a listagem para confirmar a contagem restante.

Esperado ao final: só a linha “Desconto de Projeto em Execução” permanece pendente (é desconto, não serviço) — e ela pode ser ocultada com “Não é serviço”, que já existe.

## 2. Filtros de período: um único componente

Consolidar em um componente oficial de intervalo de datas em pt-BR (presets `Período`, `Hoje`, `Ontem`, `Essa Semana`, `Esse Mês`, `Últimos 30 dias`, etc.), com “Período” no topo, calendário de 2 meses ao lado da lista de presets, seleção personalizada em dois cliques (o popover não fecha no primeiro clique) e rótulo formatado `dd/MM/yyyy`.

Hoje existem três variações (`date-range-picker.tsx`, `date-range-filter.tsx`, `date-filter.tsx`). Fica **um** componente de apresentação + um wrapper de filtro serializável (para persistir preset em URL/segmentos); os demais são substituídos.

Telas a converter (filtros de período apenas):

- Início, Dashboard, Analytics, Relatórios
- Negócios (toolbar e filtros do dashboard de vendas)
- Leads (sidebar de filtros), Contatos, Empresas
- Prospecção (aba Base e construtor de listas)
- Timeline de atividades
- TechFinance: DRE, Bancos, Faturas, Faturamento e Margem de contrato
- TechHire: Insights de pipeline, Hunting
- Contratos: lista e agrupamento por serviço/empresa

Regras de execução: sem mudança de schema, RLS, autenticação ou regra de negócio; nenhum filtro existente é removido; comportamento padrão de cada tela preservado (o preset inicial reproduz o período que a tela já usava, ex. “Últimos 30 dias”); tokens semânticos, foco visível, `aria-label`, responsividade e dark mode; `pointer-events-auto` no calendário.

Entrega em fases, cada fase revisada e validada: (a) componente consolidado + Início/Dashboard/Analytics/Relatórios; (b) Negócios/Leads/Contatos/Empresas/Prospecção/Timeline; (c) Finance/TechHire/Contratos.

## Detalhes técnicos

- `src/lib/catalog/line-item-migration.functions.ts`: `UnmappedGroup` ganha `itemIds: string[]`; `mappingEntry` passa a aceitar `itemIds` (mantendo `name`/`rawNames` apenas como rótulo) e o update usa `.in("id", itemIds).is("service_catalog_id", null)`. Limite atual de 5.000 itens e as checagens `assertAnyPermission` permanecem.
- `src/components/catalog/line-item-migration-page.tsx`: envia `itemIds`, invalida a query após aplicar e mostra o motivo quando `updated === 0`.
- Datas: `src/lib/date-presets.ts` segue como fonte única do cálculo dos intervalos; `src/components/date-range-picker.tsx` como componente de UI; `date-range-filter.tsx` reduzido a wrapper serializável; `date-filter.tsx` removido após os consumidores migrarem.
- Validações: `bun run typecheck`, `bun run lint`, `bun run test` e conferência SQL das contagens de `deal_line_items` sem `service_catalog_id` antes/depois.
