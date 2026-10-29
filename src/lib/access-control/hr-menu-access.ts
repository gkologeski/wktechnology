// Stage 4 scope only: legacy role fallbacks must not bypass these menu keys.
const resources: Record<string, string> = {
  "/settings/esign": "techcontracts.esign",
  "/projects/spaces": "techprojects.spaces",
  "/projects/settings/rates": "techprojects.rates",
  "/projects/settings/delivery": "techprojects.delivery",
  "/projects/settings/operations": "techprojects.operations",
  "/projects/settings/imports/clockify": "techprojects.clockify_import",
  "/projects/settings/imports/jibble": "techprojects.jibble_import",
  "/projects/settings/imports/clickup": "techprojects.clickup_import",
  "/projects/settings/imports/reconciliation": "techprojects.reconciliation",
  "/contracts/templates": "techcontracts.contract_templates",
  "/contracts/links": "techcontracts.links",
  "/settings/contract-defaults": "techcontracts.defaults",
  "/services": "techservice.services",
  "/contracts": "techcontracts.contracts",
  "/contracts/dashboard": "techcontracts.contracts",
  "/projects": "techprojects.projects",
  "/projects/tasks": "techprojects.tasks",
  "/compliance": "techhire.compliance",
  "/people": "techpeople.people",
  "/people/onboarding": "techpeople.onboarding",
  "/people/offboarding": "techpeople.offboarding",
  "/people/onboarding-templates": "techpeople.onboarding_templates",
  "/candidates": "techhire.candidates",
};
export function canSeeHrMenu(url: string, keys: ReadonlySet<string>, ready: boolean): boolean {
  if (url === "/projects/dashboard")
    return (
      ready &&
      ["techprojects.projects", "techprojects.tasks"].some((r) =>
        ["own", "team", "workspace"].some((s) => keys.has(`${r}.view.${s}`)),
      )
    );
  const sections: Record<string, string[]> = {
    "/projects/settings/time": ["techprojects.time_policy", "techprojects.delivery_templates"],
    "/projects/settings/imports": [
      "techprojects.clockify_import",
      "techprojects.jibble_import",
      "techprojects.clickup_import",
      "techprojects.reconciliation",
    ],
  };
  if (sections[url])
    return (
      ready &&
      sections[url].some((r) =>
        ["own", "team", "workspace"].some((s) => keys.has(`${r}.view.${s}`)),
      )
    );
  const resource = resources[url];
  return (
    !resource ||
    (ready && ["own", "team", "workspace"].some((s) => keys.has(`${resource}.view.${s}`)))
  );
}
