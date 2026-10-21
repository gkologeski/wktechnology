// Definição, base e fonte de cada indicador do painel por perfil (explicabilidade).
export type MetricDef = { title: string; definition: string; source: string };

export const METRIC_DEFS: Record<string, MetricDef> = {
  "entries.total": {
    title: "Horas registradas",
    definition:
      "Soma exata (segundos) de todos os apontamentos do período no seu escopo, em qualquer situação, inclusive rejeitados e importados.",
    source: "Apontamentos (data do apontamento no fuso escolhido).",
  },
  "entries.validated": {
    title: "Horas aprovadas",
    definition:
      "Apontamentos aprovados no fluxo de horas, inclusive os que já estão em período fechado. Importado bloqueado não entra: não é aprovação.",
    source: "Fluxo de horas (envio, aprovação, fechamento).",
  },
  "entries.awaiting_review": {
    title: "Aguardando revisão",
    definition: "Apontamentos enviados e ainda não aprovados nem rejeitados.",
    source: "Fluxo de horas.",
  },
  "entries.pending_mine": {
    title: "Rascunhos e rejeitados",
    definition: "Apontamentos que ainda precisam ser enviados ou corrigidos.",
    source: "Fluxo de horas.",
  },
  "entries.locked_import": {
    title: "Importado bloqueado",
    definition:
      "Horas trazidas do Clockify/Jibble e bloqueadas. Não são aprovação nem faturamento; ficam separadas.",
    source: "Importações de horas.",
  },
  "entries.in_review": {
    title: "Com pendência de conciliação",
    definition:
      "Apontamentos com alerta aberto ou adiado na central de conciliação. Visível só para administradores.",
    source: "Central de conciliação (Ciclo 1).",
  },
  "entries.flagged": {
    title: "Com marcação de revisão",
    definition: "Apontamentos com alguma marcação de revisão registrada no próprio lançamento.",
    source: "Apontamentos.",
  },
  "entries.billable": {
    title: "Marcadas como faturáveis",
    definition: "Indicação do apontamento. Não significa medido nem cobrado.",
    source: "Apontamentos.",
  },
  "projects.active_now": {
    title: "Projetos ativos agora",
    definition: "Situação atual Ativo. Não depende do período.",
    source: "Projetos.",
  },
  "projects.open": {
    title: "Projetos em andamento",
    definition: "Planejamento, Ativo ou Em espera, situação atual.",
    source: "Projetos.",
  },
  "projects.overdue": {
    title: "Projetos com prazo vencido",
    definition: "Planejamento ou Ativo com prazo antes de hoje (no fuso escolhido).",
    source: "Projetos.",
  },
  "projects.due_soon": {
    title: "Prazo nos próximos 30 dias",
    definition: "Planejamento ou Ativo com prazo entre hoje e 30 dias.",
    source: "Projetos.",
  },
  "projects.no_owner": {
    title: "Sem responsável operacional",
    definition: "Planejamento ou Ativo sem responsável definido.",
    source: "Projetos.",
  },
  "projects.no_approver": {
    title: "Ativos sem aprovador",
    definition: "Projetos ativos sem aprovador de horas vigente.",
    source: "Aprovadores de horas (Ciclo 3).",
  },
  "projects.no_company": {
    title: "Sem empresa vinculada",
    definition: "Projetos em andamento sem empresa cliente vinculada.",
    source: "Projetos.",
  },
  "tasks.open": {
    title: "Tarefas abertas",
    definition: "Tarefas não concluídas de projetos em andamento.",
    source: "Tarefas.",
  },
  "tasks.overdue": {
    title: "Tarefas atrasadas",
    definition: "Tarefas abertas com prazo antes de hoje.",
    source: "Tarefas.",
  },
  "tasks.due_soon": {
    title: "Tarefas nos próximos 14 dias",
    definition: "Tarefas abertas com prazo entre hoje e 14 dias.",
    source: "Tarefas.",
  },
  "tasks.no_estimate": {
    title: "Tarefas sem estimativa",
    definition: "Tarefas abertas sem horas estimadas: impedem a previsão de entrega.",
    source: "Tarefas.",
  },
  "milestones.overdue": {
    title: "Marcos atrasados",
    definition: "Marcos não concluídos de projetos em andamento com data antes de hoje.",
    source: "Marcos.",
  },
  "milestones.due_soon": {
    title: "Marcos nos próximos 14 dias",
    definition: "Marcos abertos com data entre hoje e 14 dias.",
    source: "Marcos.",
  },
  "people.all": {
    title: "Pessoas no escopo",
    definition:
      "Pessoas do TechPeople com alocação no período em projetos do escopo ou com horas nele. Contadas uma vez cada.",
    source: "TechPeople (jornada e alocações).",
  },
  "people.no_schedule": {
    title: "Sem jornada cadastrada",
    definition:
      "Capacidade desconhecida: a jornada não está no cadastro da pessoa. Nenhuma jornada padrão é presumida.",
    source: "TechPeople.",
  },
  "people.overbooked": {
    title: "Com sobrealocação",
    definition: "Pessoas com algum dia do período em que as alocações somam mais que a jornada.",
    source: "TechPeople (alocações vigentes).",
  },
  "people.gap": {
    title: "Com lacuna de apontamento",
    definition:
      "Horas alocadas até hoje maiores que as registradas. Só para quem tem jornada conhecida.",
    source: "TechPeople + apontamentos.",
  },
  "people.inactive_with_hours": {
    title: "Inativas com horas",
    definition: "Pessoas fora de atividade que têm horas registradas no período.",
    source: "TechPeople + apontamentos.",
  },
  "forecast.forecast": {
    title: "Com previsão",
    definition:
      "Projetos com estimativa restante e ritmo conhecido (4 de 8 semanas com horas ou capacidade alocada).",
    source: "Tarefas, apontamentos e alocações.",
  },
  "forecast.no_base": {
    title: "Sem base para prever",
    definition:
      "Sem tarefa aberta, sem estimativa ou sem ritmo conhecido. Nenhuma data é inventada.",
    source: "Tarefas e apontamentos.",
  },
  "forecast.late": {
    title: "Previsão após o prazo",
    definition: "A data provável (mediana) cai depois do prazo do projeto.",
    source: "Previsão de entrega.",
  },
  "deals.won": {
    title: "Negócios ganhos",
    definition:
      "Negócios ganhos no período (data de fechamento no fuso escolhido) que você pode ver.",
    source: "TechSales.",
  },
  "deals.no_project": {
    title: "Ganhos sem projeto",
    definition:
      "Ganhos depois da ativação da política de entrega, sem projeto e sem dispensa. Anteriores não contam.",
    source: "Entrega do negócio (Ciclo 2).",
  },
  "deals.preparation": {
    title: "Em preparação",
    definition: "Ganhos com projeto ainda em Planejamento.",
    source: "Entrega do negócio.",
  },
  "deals.no_owner": {
    title: "Projeto sem responsável",
    definition: "Ganhos cujo projeto não tem responsável operacional.",
    source: "Entrega do negócio.",
  },
  "deals.no_contract": {
    title: "Sem contrato",
    definition: "Ganhos sem contrato vinculado (aditivos não contam).",
    source: "TechContracts.",
  },
  "measurements.forecast": {
    title: "Prevista (rascunho/revisão)",
    definition: "Medições em rascunho ou revisão. Valores por moeda, nunca somados entre etapas.",
    source: "Medições (Ciclo 4), competência = início do período medido.",
  },
  "measurements.awaiting_approval": {
    title: "Aguardando aprovação",
    definition: "Medições em revisão.",
    source: "Medições.",
  },
  "measurements.approved": {
    title: "Aprovada",
    definition: "Medições aprovadas ou prontas, ainda não lançadas.",
    source: "Medições.",
  },
  "measurements.awaiting_generation": {
    title: "Aguardando geração",
    definition: "Aprovadas, prontas ou com falha na geração do título.",
    source: "Medições.",
  },
  "measurements.generated": {
    title: "Lançada no Financeiro",
    definition: "Título interno a receber gerado. Não é recebimento.",
    source: "Medições + Financeiro.",
  },
  "measurements.received": {
    title: "Recebida",
    definition: "Pagamentos registrados nos títulos gerados. Exige acesso ao Financeiro.",
    source: "Financeiro (pagamentos).",
  },
  "measurements.reversed": {
    title: "Estornada",
    definition: "Medições estornadas.",
    source: "Medições.",
  },
  "cost.cost_known": {
    title: "Horas com custo conhecido",
    definition:
      "Apontamentos com tarifa de custo vigente na data (situação da tarifa, nunca o valor).",
    source: "Tarifas e custos (Ciclo 4).",
  },
  "cost.cost_missing": {
    title: "Horas sem custo",
    definition: "Sem tarifa de custo vigente: custo desconhecido, não zero.",
    source: "Tarifas e custos.",
  },
  "cost.cost_ambiguous": {
    title: "Custo ambíguo",
    definition: "Duas tarifas no mesmo nível de prioridade: custo não é escolhido arbitrariamente.",
    source: "Tarifas e custos.",
  },
  "alerts.needs_action": {
    title: "Alertas pedindo ação",
    definition: "Abertos, ou adiados cujo prazo de adiamento chegou.",
    source: "Central de atenção (avaliação persistida).",
  },
  "alerts.active": {
    title: "Alertas ativos",
    definition: "Todos os alertas não resolvidos (abertos, reconhecidos ou adiados).",
    source: "Central de atenção.",
  },
};

export function metricDef(dataset: string, metric: string): MetricDef {
  return (
    METRIC_DEFS[`${dataset}.${metric}`] ?? {
      title: metric,
      definition: "Indicador calculado no banco com o mesmo escopo e filtros da lista.",
      source: "TechProjects.",
    }
  );
}
