// Stage 4 scope only: legacy role fallbacks must not bypass these menu keys.
const resources: Record<string, string> = {
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
  const resource = resources[url];
  return (
    !resource ||
    (ready && ["own", "team", "workspace"].some((s) => keys.has(`${resource}.view.${s}`)))
  );
}
