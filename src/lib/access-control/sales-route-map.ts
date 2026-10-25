/** Actual route gate, shared with navigation. Longest prefix wins. */
const routes: Record<string, readonly string[]> = {
  "/dashboard": ["techsales.dashboard"],
  "/leads/import-hubspot": ["system.hubspot_sync"],
  "/leads": ["techsales.leads"],
  "/contacts": ["techsales.contacts"],
  "/companies": ["techsales.companies"],
  "/deals": ["techsales.deals"],
  "/quotes": ["techsales.quotes"],
  "/proposals": ["techsales.proposals"],
  "/activities": ["techsales.activities", "techsales.tasks", "techsales.notes"],
  "/tasks": ["techsales.tasks"],
  "/notes": ["techsales.notes"],
  "/tickets": ["techsales.tickets"],
  "/meetings": ["techsales.meetings"],
  "/communications": ["techsales.communications"],
  "/inbox/email": ["techsales.inbox.email"],
  "/inbox/whatsapp": ["techsales.inbox.whatsapp"],
  "/inbox/chat": ["techsales.inbox.chat"],
  "/inbox": ["techsales.inbox.email", "techsales.inbox.whatsapp", "techsales.inbox.chat"],
  "/campaigns/email": ["techsales.marketing.campaigns"],
  "/campaigns/whatsapp": ["techsales.marketing.campaigns"],
  "/agents/sdr": ["techsales.marketing.sdr_agent"],
  "/agents/prototype": ["techsales.marketing.sdr_agent"],
  "/prospecting/campaigns": ["techsales.marketing.campaigns"],
  "/prospecting": [
    "techsales.prospecting_queue",
    "techsales.prospecting_cadences",
    "techsales.prospecting_questionnaires",
    "techsales.prospecting_search",
    "techsales.prospecting_scripts",
    "techsales.prospecting_scoring",
    "techsales.prospecting_enrichment",
    "techsales.prospecting_voice",
    "techsales.marketing.campaigns",
  ],
  "/forms": ["techsales.marketing.forms"],
  "/surveys": ["techsales.surveys"],
  "/landing-pages": ["techsales.marketing.landing_pages"],
  "/settings/email": ["techsales.email_accounts"],
  "/settings/email-templates": ["system.automation.email_templates"],
  "/settings/whatsapp": ["system.whatsapp"],
  "/settings/voice-agent": ["techsales.prospecting_voice"],
  "/settings/prospecting": ["techsales.prospecting_search"],
  "/settings/prospecting-scripts": ["techsales.prospecting_scripts"],
  "/settings/segments": ["techsales.segments"],
  "/settings/sequences": ["system.automation.sequences"],
  "/settings/scoring": ["techsales.prospecting_scoring"],
  "/settings/goals": ["techsales.goals"],
  "/settings/rotation": ["system.automation.rotation"],
  "/settings/forms": ["techsales.marketing.forms"],
  "/settings/surveys": ["techsales.surveys"],
  "/settings/quotes": ["techsales.quotes"],
  "/settings/quote-templates": ["techsales.quote_templates"],
  "/settings/proposal-templates": ["techsales.proposal_templates"],
  "/settings/pipelines": ["system.pipelines"],
  "/settings/lead-sources": ["techsales.lead_sources"],
  "/settings/deal-loss-reasons": ["techsales.deal_loss_reasons"],
  "/integrations": ["system.integrations"],
  "/settings/portal": ["system.portal"],
  "/settings/integrations": ["system.integrations"],
  "/settings/hubspot-sync": ["system.hubspot_sync"],
  "/settings/webhooks": ["system.webhooks"],
  "/settings/workflows": ["system.workflows"],
  "/settings/workflow-subscriptions": ["system.workflows"],
  "/settings/booking": ["system.booking"],
  "/settings/calendars": ["system.calendars"],
  "/calendar": ["system.calendars"],
  "/reports": ["system.analytics.reports"],
  "/dashboards": ["system.analytics.dashboards"],
  "/analytics": ["system.analytics.insights"],
  "/settings/exports": ["system.analytics.reports"],
  "/settings/enrichment": ["techsales.prospecting_enrichment"],
};
const prefixes = Object.keys(routes).sort((a, b) => b.length - a.length);
export function salesRouteResources(url: string): readonly string[] | undefined {
  const path = url.split(/[?#]/, 1)[0].replace(/\/$/, "");
  const prefix = prefixes.find((p) => path === p || path.startsWith(p + "/"));
  return prefix ? routes[prefix] : undefined;
}
export function canViewSalesRoute(url: string, permissions: ReadonlySet<string>, ready: boolean) {
  const resources = salesRouteResources(url);
  return (
    !resources ||
    (ready &&
      resources.some((r) =>
        ["own", "team", "workspace"].some((s) => permissions.has(`${r}.view.${s}`)),
      ))
  );
}
