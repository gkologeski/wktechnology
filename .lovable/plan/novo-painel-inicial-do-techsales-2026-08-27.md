# Novo Painel Inicial do TechSales

Substituir o `/dashboard` atual (4 KPIs genéricos + 2 gráficos + tarefas) por um painel de trabalho diário de vendas: o que fechar, com quem falar e o que está travando.

## O que o painel passa a mostrar

**Faixa de KPIs (4 cartões, com comparativo do período anterior)**

1. Pipeline aberto (valor + nº de negócios), somente etapas não ganhas/perdidas
2. Previsão ponderada do mês (valor × probabilidade da etapa do pipeline)
3. Ganho no mês vs. meta (usa `goals` quando existir meta ativa; sem meta, mostra só o realizado)
4. Taxa de conversão + ticket médio do período

**Blocos principais**

- **Negócios em fases avançadas** — negócios em etapas de alta probabilidade (proposta/negociação, ou `probability >= 60` conforme o pipeline configurado), ordenados pelo `hot-score` já existente (`src/lib/deals/hot-score.ts`). Mostra valor, etapa, responsável, data prevista de fechamento e sinal de risco (sem atividade futura, data prevista vencida).
- **Próximas reuniões (7 dias)** — de `meetings` e `bookings`, com participante/empresa, horário e link (Meet) quando houver.
- **Contatos por dia (últimos 14 dias)** — barras empilhadas de atividades registradas por tipo (ligação, e-mail, WhatsApp, reunião), com total do período e média/dia. Responde "estamos falando com clientes?".
- **Precisam de atenção** — negócios abertos sem nenhuma atividade nos últimos N dias e negócios com fechamento previsto vencido. Cada linha clicável para o negócio.
- **Minhas tarefas de hoje / atrasadas** — mantém a lista de atividades pendentes que já existe hoje, separando atrasadas de hoje/próximas.
- **Funil por etapa** — barra horizontal com valor e contagem por etapa do pipeline padrão, substituindo o gráfico atual baseado em `DEAL_STAGES` fixo (passa a respeitar os pipelines configurados).
- **Leads a trabalhar** — leads novos/em contato não qualificados, com contagem e atalho para `/leads` no modo prospecção.

**Filtros no cabeçalho:** período (7/30/90 dias), pipeline e escopo "Meus / Da equipe" (respeitando RBAC — o escopo de equipe só aparece para quem tem permissão de visualizar além do próprio).

## Layout

```text
PageHeader: Painel de vendas   [período] [pipeline] [meus/equipe]
┌──────────┬──────────┬──────────┬──────────┐
│ Pipeline │ Previsão │ Ganho/meta│ Conversão│
└──────────┴──────────┴──────────┴──────────┘
┌────────────────────────────┬──────────────────┐
│ Negócios em fase avançada  │ Próximas reuniões│
│ (lista rankeada)           ├──────────────────┤
│                            │ Minhas tarefas   │
├────────────────────────────┴──────────────────┤
│ Contatos por dia (14 dias, empilhado por tipo)│
├────────────────────────┬──────────────────────┤
│ Precisam de atenção    │ Funil por etapa      │
└────────────────────────┴──────────────────────┘
                Leads a trabalhar
```

Mobile: coluna única, na ordem KPIs → fase avançada → reuniões → tarefas → contatos/dia → atenção → funil → leads.

## Detalhes técnicos

- Nova server function `getSalesDashboard` em `src/lib/deals/sales-dashboard.functions.ts` (`requireSupabaseAuth`, workspace via `resolveActiveWorkspace`), retornando um DTO único com todas as seções. Helpers de agregação em `sales-dashboard.server.ts` — o `*.functions.ts` fica fino, conforme a regra do projeto.
- Rota `/dashboard` reescrita: `loader` com `ensureQueryData` + `useSuspenseQuery`; filtros como search params (período/pipeline/escopo) para serem compartilháveis.
- Componentes presentacionais novos em `src/components/deals/dashboard/` (sem Supabase dentro), reutilizando `PageHeader`, `MetricCard`, `SectionHeader`, `EmptyState`, `Skeletons`, `StatusBadge` e `LazyChart` (recharts sob demanda).
- Sem migration: usa `deals`, `pipelines`, `activities`, `meetings`, `bookings`, `leads` e `goals` já existentes. A RPC `dashboard_metrics` continua no banco (usada por outras telas) mas deixa de ser a fonte do painel.
- Estados obrigatórios: loading (skeleton fiel), empty por bloco, error com "Tentar novamente"; tokens semânticos, dark mode e responsividade 360/768/1024/1280.
- Validação: `bun run lint`, `bun run typecheck`, `bun run test` e verificação visual do painel em light/dark.

## Fora de escopo

Não altera RLS, schema, permissões, `/dashboards` (dashboards customizados) nem o painel do TechHire.
