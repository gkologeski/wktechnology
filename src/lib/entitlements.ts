// Constantes de keys de entitlements — fonte única de verdade.
// Use estas constantes ao invés de strings soltas para evitar typos.

export const ENT = {
  // Limites de entidades
  LEADS_MAX: "leads.max",
  CONTACTS_MAX: "contacts.max",
  COMPANIES_MAX: "companies.max",
  DEALS_MAX: "deals.max",
  USERS_MAX: "users.max",
  PIPELINES_MAX: "pipelines.max",
  CUSTOM_PROPERTIES_MAX: "custom_properties.max",
  CUSTOM_OBJECTS_MAX: "custom_objects.max",
  EMAIL_TEMPLATES_MAX: "email_templates.max",
  FORMS_MAX: "forms.max",
  DASHBOARDS_MAX: "dashboards.max",
  SEQUENCES_ACTIVE_MAX: "sequences.active.max",
  WORKFLOWS_ACTIVE_MAX: "workflows.active.max",
  WHATSAPP_NUMBERS_MAX: "whatsapp_numbers.max",
  WEBHOOKS_MAX: "webhooks.max",
  API_KEYS_MAX: "api_keys.max",
  AUDIT_LOG_DAYS: "audit_log.days",

  // Cotas mensais
  EMAIL_SENDS_MONTHLY: "email.sends.monthly",
  EMAIL_BROADCASTS_MONTHLY: "email_broadcasts.monthly",
  TWILIO_MINUTES_MONTHLY: "twilio.minutes.monthly",
  ENRICHMENT_MONTHLY: "enrichment.monthly",
  AI_COMPOSE_MONTHLY: "ai_compose.monthly",
  AI_SUMMARIES_MONTHLY: "ai_summaries.monthly",

  // Feature flags
  WHATSAPP_INBOX: "feature.whatsapp_inbox",
  WHATSAPP_CAMPAIGNS: "feature.whatsapp_campaigns",
  SEQUENCES: "feature.sequences",
  WORKFLOWS: "feature.workflows",
  SCORING_RULES: "feature.scoring_rules",
  SCORING_AI: "feature.scoring_ai",
  MACROS: "feature.macros",
  SLA: "feature.sla",
  ROTATION: "feature.rotation",
  PLAYBOOKS: "feature.playbooks",
  SURVEYS: "feature.surveys",
  GOALS: "feature.goals",
  SCHEDULED_EXPORTS: "feature.scheduled_exports",
  SENTIMENT: "feature.sentiment",
  QUOTES: "feature.quotes",
  RECURRING: "feature.recurring",
  ESIGN: "feature.esign",
  TICKETS: "feature.tickets",
  PORTAL: "feature.portal",
  PORTAL_WHITELABEL: "feature.portal_whitelabel",
  BOOKING: "feature.booking",
  HUBSPOT_IMPORT: "feature.hubspot_import",
  GOOGLE_CALENDAR: "feature.google_calendar",
  CUSTOM_ROLES: "feature.custom_roles",
  BRANDING_COLORS: "feature.branding_colors",
  WHITE_LABEL: "feature.white_label",
} as const;

/**
 * Mapa tool (matriz de permissões) → entitlement requerido pelo plano.
 * Quando o plano do workspace não habilita o entitlement, o switch da tool
 * no editor de perfis é forçado a "desligado" e desabilitado, com badge
 * indicando o plano mínimo necessário.
 *
 * Tools sem entrada aqui não têm gate de plano (continuam livres).
 */
export const TOOL_REQUIRED_ENTITLEMENT: Partial<Record<string, string>> = {
  manage_workflows: "feature.workflows",
};

export type EntKey = (typeof ENT)[keyof typeof ENT];

export type PlanCode = "free" | "bronze" | "prata" | "ouro";

export const PLAN_LABELS: Record<PlanCode, string> = {
  free: "Free",
  bronze: "Bronze",
  prata: "Prata",
  ouro: "Ouro",
};

export const PLAN_RANK: Record<PlanCode, number> = {
  free: 0,
  bronze: 1,
  prata: 2,
  ouro: 3,
};

/** Retorna o menor plano que habilita uma key (consulta entitlements). */
export function minPlanFor(
  entitlements: Record<
    string,
    Array<{ plan_code: PlanCode; enabled: boolean; limit_int: number | null }>
  >,
  key: EntKey,
): PlanCode | null {
  const rows = entitlements[key] ?? [];
  const sorted = [...rows].sort((a, b) => PLAN_RANK[a.plan_code] - PLAN_RANK[b.plan_code]);
  const found = sorted.find((r) => r.enabled && (r.limit_int === null || r.limit_int > 0));
  return found?.plan_code ?? null;
}
