# TechProjects — Painel por perfil, capacidade, alertas e previsão (Ciclo 5)

Rota: `/projects/dashboard` (aba "Visão geral" preservada + visões por perfil).
Migração: `drizzle/migrations/0177_techprojects_cycle5_dashboard.sql`.
Código: `src/lib/projects/dashboard-views.*`, `dashboard-metric-defs.shared.ts`,
`src/hooks/use-project-dashboard-views.ts`, `src/components/projects/dashboard/*`,
agendador `src/routes/api/public/hooks/project-alerts-tick.ts`.
Testes: `src/lib/projects/dashboard-views.shared.test.ts`,
`tests/sql/project-dashboard-isolated.{sh,sql}` (banco descartável, fixtures > 5.000 apontamentos/tarefas).

## Visões e quem vê

`project_dash_scope()` decide as abas a partir de permissões, carteira e papéis no projeto —
nunca pelo nome do cargo nem por "é admin". Um usuário pode ter várias visões.

| Visão            | Requisito                                                                |
| ---------------- | ------------------------------------------------------------------------ |
| Meu trabalho     | membro ativo do workspace                                                |
| Equipe e entrega | visão completa de horas, ou líder/gestor de algum projeto                |
| Comercial        | enxerga negócios (mesma regra de `deal_visible_to_current_user`)         |
| Financeiro       | permissões do Ciclo 4 de medição/rentabilidade; custo e recebido à parte |
| Qualidade        | admin ativo (mesmo requisito da central de conciliação)                  |

Todas as somas rodam no banco sobre as linhas que o usuário já enxerga (equivalência exata com
RLS testada por usuário), sem amostra nem limite de 1.000/5.000 linhas. "Ver lista" chama
`project_dash_drill` com o MESMO conjunto, métrica e filtros; o total da lista é o total real.
Exportação CSV: máximo 5.000 linhas por arquivo (avisado quando truncado), fórmulas neutralizadas,
sem valores de custo.

## Filtros

Período (fuso IANA explícito), comparação opcional com período anterior, projeto, cliente,
serviço, líder, pessoa, origem, situação e moeda — cada visão usa só os que se aplicam
(`DASH_VIEW_FILTERS`). Ficam na URL; preferência por workspace + usuário no navegador. IDs são
revalidados no banco (workspace ativo). Autocompletar retorna no máximo 20 itens visíveis por RLS.
Cache do cliente inclui workspace, usuário, visão e filtros.

## Capacidade

Fonte: `people.work_schedule` + alocações vigentes (Ciclo 3). Cada pessoa conta uma vez,
vigências parciais respeitadas. Sem jornada → "Sem jornada"/"Sem base" (nunca 8 h presumidas).
Feriados e ausências não existem como cadastro no TechPeople e NÃO são descontados (aviso na tela).
Sobrealocação considera todas as alocações da pessoa sem revelar projetos ocultos.

## Alertas

Regras versionadas por workspace (`project_risk_rule_versions`): marcos/projetos vencidos, horas
acima do planejado (só com planejado definido), capacidade excedida, horas aguardando revisão,
projeto sem aprovador ou pessoas sem jornada, negócio ganho sem projeto e sem responsável
operacional. Sem orçamento de valor confirmado não há alerta financeiro.
Persistidos em `project_alerts` (chave regra+alvo), eventos só em mudança de estado, causa
desaparecida resolve, causa de volta reabre. Ações (reconhecer/adiar/resolver/reabrir) exigem
justificativa e não alteram o registro de origem. Sem avisos externos.
Avaliação: botão "Reavaliar agora" (admin) ou agendador opt-in (`_schedule.enabled`, padrão
desligado) via `project-alerts-tick` (CRON_SECRET). Abrir o painel nunca calcula alertas.

## Previsão

Estimativa restante das tarefas abertas ÷ ritmo (média de 8 semanas, mínimo 4 com horas) ou
capacidade alocada semanal; faixa baixa/mediana/alta. Hunting → TechHire; recorrentes →
cobertura da competência; sem estimativa/ritmo → "Sem base para prever". Horas consumidas ÷
planejadas não é tratado como progresso.
