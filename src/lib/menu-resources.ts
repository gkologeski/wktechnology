// Mapa URL do menu → recursos de permissão (`modulo.recurso`).
//
// Serve exclusivamente ao diagnóstico de RBAC (/settings/rbac-diagnostics):
// garante que TODO item de menu tenha uma matriz de ações (Exibir, Criar,
// Editar, Excluir...), inclusive os itens que hoje só têm gate por papel ou
// nenhum gate. NÃO altera a visibilidade real do menu — `canSee` ignora este
// mapa por completo.
//
// As chaves derivadas destes recursos existem em `public.permissions`.

/** Itens exclusivos de plataforma: sem catálogo granular, apenas papel. */
export const PLATFORM_ONLY_URLS: readonly string[] = [
  "/admin/workspaces",
  "/admin/bug-reports",
  "/admin/status",
  "/admin/alerts",
  "/admin/security-scans",
  "/admin/quotas",
  "/admin/sandbox",
];

/** Itens de conta pessoal do usuário — não têm permissão de workspace. */
export const PERSONAL_URLS: readonly string[] = [
  "/settings",
  "/settings/security",
  "/settings/privacy",
  "/my-bug-reports",
];

export const MENU_RESOURCES_BY_URL: Record<string, readonly string[]> = {
  // --- TechSales -------------------------------------------------------------
  "/leads": ["techsales.leads"],
  "/landing-pages": ["techsales.marketing.landing_pages"],
  "/forms": ["techsales.marketing.forms"],
  "/surveys": ["techsales.surveys"],
  "/campaigns/email": ["techsales.marketing.campaigns"],
  "/campaigns/whatsapp": ["techsales.marketing.campaigns"],
  "/agents/sdr": ["techsales.marketing.sdr_agent"],
  "/contacts": ["techsales.contacts"],
  "/companies": ["techsales.companies"],
  "/inbox": ["techsales.inbox"],
  "/inbox/email": ["techsales.inbox.email"],
  "/inbox/whatsapp": ["techsales.inbox.whatsapp"],
  "/inbox/chat": ["techsales.inbox.chat"],
  "/communications": ["techsales.communications"],
  "/notes": ["techsales.notes"],
  "/meetings": ["techsales.meetings"],
  "/settings/email": ["techsales.email_accounts"],
  "/deals": ["techsales.deals"],
  "/settings/quotes": ["techsales.quotes"],
  "/invoices": ["techsales.invoices"],
  "/tickets": ["techsales.tickets"],
  "/tasks": ["techsales.tasks"],
  "/tasks/queues": ["techsales.task_queues"],
  "/dashboard": ["techsales.dashboard"],
  "/catalog/products": ["techsales.catalog.products"],
  "/catalog/services": ["techsales.catalog.services"],
  "/catalog/job-profiles": ["techsales.catalog.services"],
  "/catalog/contracting-presets": ["techsales.catalog.services"],
  "/settings/products": ["techsales.catalog.products"],
  "/services/products": ["techsales.catalog.products"],
  "/leads/import-hubspot": ["system.import"],
  "/prospecting": [
    "techsales.prospecting_queue",
    "techsales.prospecting_cadences",
    "techsales.prospecting_questionnaires",
    "techsales.prospecting_scoring",
    "techsales.prospecting_playbooks",
    "techsales.prospecting_enrichment",
    "techsales.prospecting_search",
    "techsales.prospecting_scripts",
    "techsales.prospecting_voice",
  ],
  "/settings/prospecting": [
    "techsales.prospecting_search",
    "techsales.prospecting_enrichment",
  ],



  // --- Sistema / workspace ---------------------------------------------------
  "/home": ["system.home"],
  "/modules": ["system.modules"],
  "/files": ["system.files"],
  "/marketplace": ["system.marketplace"],
  "/integrations": ["system.integrations"],
  "/settings/whatsapp": ["system.whatsapp"],
  "/settings/integrations/linkedin": ["system.linkedin"],
  "/settings/hubspot-sync": ["system.hubspot_sync"],
  "/settings/widget": ["system.widget"],
  "/settings/branding": ["system.branding"],
  "/settings/legal-entities": ["system.legal_entities"],
  "/settings/legal-entity-groups": ["system.legal_entity_groups"],
  "/settings/language": ["system.language"],
  "/settings/billing": ["system.billing"],
  "/settings/pipelines": ["system.pipelines"],
  "/settings/custom-properties": ["system.custom_properties"],
  "/settings/custom-objects": ["system.custom_objects"],
  "/settings/portal": ["system.portal"],
  "/settings/snippets": ["system.snippets"],
  "/settings/teams": ["system.members"],
  "/settings/user-groups": ["system.user_groups"],
  "/settings/permissions": ["system.roles"],
  "/settings/rbac-diagnostics": ["system.rbac_diagnostics"],
  "/settings/kb": ["system.kb.articles"],
  "/settings/calendars": ["system.calendars"],
  "/settings/booking": ["system.booking"],
  "/settings/workflows": ["system.workflows"],
  "/settings/sequences": ["system.automation.sequences"],
  "/settings/rotation": ["system.automation.rotation"],
  "/settings/sla": ["system.automation.sla"],
  "/settings/macros": ["system.automation.macros"],
  "/settings/email-templates": ["system.automation.email_templates"],
  "/settings/onboarding-templates": ["system.onboarding_templates"],
  "/dashboards": ["system.analytics.dashboards"],
  "/reports": ["system.analytics.reports"],
  "/analytics": ["system.analytics.insights"],

  // --- TechHire --------------------------------------------------------------
  "/ats-dashboard": ["techhire.dashboard"],
  "/jobs": ["techhire.jobs"],
  "/candidates": ["techhire.candidates"],
  "/pipelines": ["techhire.pipelines"],
  "/scorecards": ["techhire.scorecards"],
  "/interview-kits": ["techhire.interview_kits"],
  "/scheduling": ["techhire.scheduling"],
  "/sourcing/inbox": ["techhire.sourcing.inbox"],
  "/sourcing/pools": ["techhire.sourcing.pools"],
  "/sourcing/sequences": ["techhire.sourcing.sequences"],
  "/sourcing/referrals": ["techhire.sourcing.referrals"],
  "/sourcing/multi-posting": ["techhire.sourcing.multi_posting"],
  "/sourcing/analytics": ["techhire.sourcing.analytics"],
  "/hunting": ["techhire.hunting"],
  "/hunting/search": ["techhire.hunting.search"],
  "/hunting/captures": ["techhire.hunting.captures"],
  "/hunting/templates": ["techhire.hunting.templates"],
  "/hunting/observability": ["techhire.hunting.observability"],
  "/offers": ["techhire.offers"],
  "/stage-emails": ["techhire.stage_emails"],
  "/careers": ["techhire.careers"],
  "/briefing": ["techhire.briefing"],
  "/copilot": ["techhire.copilot"],
  "/match-scores": ["techhire.match_scores"],
  "/fraud-flags": ["techhire.fraud_flags"],
  "/notetaker": ["techhire.notetaker"],
  "/insights": ["techhire.insights"],
  "/dei-analytics": ["techhire.dei_analytics"],
  "/compliance": ["techhire.compliance"],

  // --- TechContracts / TechServices -----------------------------------------
  "/contracts": ["techcontracts.contracts"],
  "/contracts/templates": ["techcontracts.contract_templates"],
  "/services": ["techservice.services"],

  // --- TechProjects ----------------------------------------------------------
  "/projects": ["techprojects.projects"],
  "/projects/$id/entrega": ["techprojects.project_updates", "techsales.deal_delivery"],
  "/projects/my-work": ["techprojects.my_work"],
  "/projects/spaces": ["techprojects.spaces"],
  "/projects/tasks": ["techprojects.tasks"],
  "/projects/timesheet": ["techprojects.timesheet"],

  // --- TechFinance -----------------------------------------------------------
  "/finance": ["techfinance.entries"],
  "/finance/receivable": ["techfinance.invoices"],
  "/finance/payable": ["techfinance.payments"],
  "/finance/recurrences": ["techfinance.recurrences"],
  "/finance/dre": ["techfinance.reports"],
  "/finance/cash-flow": ["techfinance.reports"],
  "/finance/categories": ["techfinance.categories"],
  "/finance/cost-centers": ["techfinance.cost_centers"],
  "/finance/legal-entities": ["techfinance.legal_entities"],
  "/finance/legal-entity-groups": ["techfinance.legal_entity_groups"],
  "/finance/bank-accounts": ["techfinance.bank_accounts"],
  "/finance/banking": ["techfinance.banking"],
  "/finance/banking/reconciliation": ["techfinance.banking"],
  "/finance/nfse": ["techfinance.nfse"],
  "/finance/audit": ["techfinance.audit"],
  "/settings/dunning": ["techfinance.dunning"],
  "/settings/charging-templates": ["techfinance.charging_templates"],

  // --- TechPeople ------------------------------------------------------------
  "/people": ["techpeople.people"],
  "/people/my-team": ["techpeople.my_team"],
  "/people/onboarding": ["techpeople.onboarding"],
  "/people/offboarding": ["techpeople.offboarding"],
  "/people/documents": ["techpeople.documents"],
  "/people/onboarding-templates": ["techpeople.onboarding_templates"],
  "/people/import-forms": ["techpeople.import"],
  "/people/psychosocial": ["techpeople.wellbeing.assessments"],
  "/people/incidents": ["techpeople.wellbeing.incidents"],
  "/people/benefits": ["techpeople.benefits"],
  "/people/billing": ["techpeople.timesheet"],
  "/people/contract-margin": ["techpeople.allocations"],
  "/people/analytics": ["techpeople.analytics"],
};

/** Recursos declarados para uma URL de menu (vazio quando não mapeada). */
export function resourcesForUrl(url: string): readonly string[] {
  return MENU_RESOURCES_BY_URL[url] ?? [];
}

export function isPlatformOnlyUrl(url: string): boolean {
  return PLATFORM_ONLY_URLS.includes(url);
}

export function isPersonalUrl(url: string): boolean {
  return PERSONAL_URLS.includes(url);
}
