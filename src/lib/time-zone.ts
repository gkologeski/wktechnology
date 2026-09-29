// Fuso padrão da plataforma. Workspaces ainda não têm fuso próprio salvo;
// quando tiverem, os cálculos devem receber o fuso do workspace e usar este
// valor apenas como fallback.
export const DEFAULT_TIME_ZONE = "America/Sao_Paulo";

// Deslocamento fixo de Brasília (GMT-3, sem horário de verão desde 2019),
// usado em agregações diárias no servidor, que roda em UTC.
export const DEFAULT_UTC_OFFSET_MS = 3 * 60 * 60 * 1000;
