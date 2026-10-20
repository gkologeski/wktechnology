// Rótulos da aba de vínculos (apresentação pura).
export const CRITERION_LABEL: Record<string, string> = {
  name_exact: "Mesmo nome",
  email_ambiguous: "E-mail repetido (ambíguo)",
  source_conflict: "Origem e mapeamento divergem",
};
export const BATCH_LABEL: Record<string, string> = {
  apply_exact: "Vínculos exatos",
  confirm_suggestion: "Sugestões confirmadas",
  reject_suggestion: "Sugestões recusadas",
  revert: "Desvinculação",
};
export const COUNT_LABEL: Record<string, string> = {
  company_links: "empresas ligadas",
  person_links: "apontamentos com pessoa",
  allocation_links: "com alocação",
  suggestions_new: "novas sugestões",
  company_conflicts_new: "conflitos de empresa",
  person_exact_subjects: "usuários com e-mail único",
  person_ambiguous_subjects: "usuários ambíguos",
  confirmed: "confirmadas",
  rows_linked: "registros ligados",
  rejected: "recusadas",
  reverted: "desfeitos",
  skipped_changed_since: "mantidos (mudaram depois)",
};
export const MEMBER_LABEL: Record<string, string> = {
  active: "Ativo",
  inactive: "Histórico (sem acesso)",
};
