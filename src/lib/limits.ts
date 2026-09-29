// Limites de produto e técnicos compartilhados. Limites oficiais de
// provedores externos ficam junto do adaptador de cada provedor.

/** Cota de armazenamento de arquivos por workspace (regra de produto). */
export const STORAGE_QUOTA_BYTES = 100 * 1024 * 1024;

/** Máximo de linhas que o banco devolve por consulta (limite técnico). */
export const DB_PAGE_MAX_ROWS = 1000;

/** Linhas por página no histórico do Painel de IA. */
export const AI_PANEL_PAGE_SIZE = 25;
