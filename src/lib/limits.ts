// Limites de produto e técnicos compartilhados. Limites oficiais de
// provedores externos ficam junto do adaptador de cada provedor.

/** Cota de armazenamento de arquivos por workspace (regra de produto). */
export const STORAGE_QUOTA_BYTES = 100 * 1024 * 1024;

/** Máximo de linhas que o banco devolve por consulta (limite técnico). */
export const DB_PAGE_MAX_ROWS = 1000;

/** Linhas por página no histórico do Painel de IA. */
export const AI_PANEL_PAGE_SIZE = 25;

/** API pública v1: requisições por chave por janela (regra de produto, ciclo 6). */
export const PUBLIC_API_RATE_LIMIT = 120;
/** Janela do limite da API pública, em segundos. */
export const PUBLIC_API_RATE_WINDOW_SECONDS = 60;

/** Fila offline de apontamentos: retenção máxima no aparelho (horas). */
export const OFFLINE_TIME_QUEUE_RETENTION_HOURS = 72;
/** Fila offline de apontamentos: máximo de itens por usuário+workspace no aparelho. */
export const OFFLINE_TIME_QUEUE_MAX_ITEMS = 50;

/** Assistente de análise do TechProjects: limites por pergunta. */
export const PROJECTS_ASSISTANT_MAX_QUESTION_CHARS = 500;
export const PROJECTS_ASSISTANT_MAX_TOOL_CALLS = 4;
export const PROJECTS_ASSISTANT_MAX_ROWS_PER_TOOL = 20;
export const PROJECTS_ASSISTANT_TIMEOUT_MS = 30_000;
/** Perguntas por usuário por hora (proteção de custo; o provedor segue a configuração do workspace). */
export const PROJECTS_ASSISTANT_MAX_PER_HOUR = 30;
