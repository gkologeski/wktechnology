// Formato do painel de operação do TechProjects (project_ops_status).
export type OpsRun = {
  status: string | null;
  started_at: string | null;
  finished_at?: string | null;
  duration_ms?: number | null;
} | null;

export type OpsJob = {
  name: string;
  scheduled: boolean;
  active: boolean;
  schedule: string | null;
  last_run: OpsRun;
  last_log: OpsRun;
};

export type ProjectsOpsStatus = {
  generated_at: string;
  jobs: OpsJob[];
  queues: {
    deal_delivery: {
      by_status: Record<string, number>;
      oldest_pending: string | null;
      expired_leases: number;
    };
    webhooks: { by_status: Record<string, number> };
    imports: Array<{ status: string; started_at: string | null; finished_at: string | null }>;
    alerts: { last_run: string | null; runs: number };
  };
};

/** Rótulo e finalidade de cada agendamento esperado (texto de tela). */
export const OPS_JOB_LABEL: Record<string, { label: string; purpose: string; optional?: boolean }> =
  {
    "deal-delivery-jobs": {
      label: "Entrega de negócios",
      purpose: "Cria/vincula o projeto de negócios ganhos (fila com tentativas).",
    },
    "webhook-dispatch-tick": {
      label: "Webhooks de saída",
      purpose: "Envia eventos assinados para destinos cadastrados.",
    },
    "clockify-import-tick": {
      label: "Importações de horas",
      purpose: "Continua importações Clockify/Jibble em lotes.",
      optional: true,
    },
    "project-alerts-tick": {
      label: "Alertas do painel",
      purpose: "Reavaliação diária dos alertas (opt-in por workspace).",
      optional: true,
    },
    "services-billing-tick": {
      label: "Cobrança de serviços",
      purpose: "Gerador legado de cobrança de serviços.",
      optional: true,
    },
    "recurrences-tick": {
      label: "Recorrências financeiras",
      purpose: "Lançamentos recorrentes do Financeiro.",
    },
    "dunning-tick": { label: "Régua de cobrança", purpose: "Lembretes de títulos vencidos." },
    "cleanup-cron-logs-daily": {
      label: "Limpeza de registros técnicos",
      purpose: "Remove registros antigos de execução.",
    },
  };
