// Stage 4 scope only: legacy role fallbacks must not bypass these menu keys.
const resources: Record<string, string> = {
  "/compliance": "techhire.compliance",
  "/people": "techpeople.people",
  "/people/onboarding": "techpeople.onboarding",
  "/people/offboarding": "techpeople.offboarding",
  "/people/onboarding-templates": "techpeople.onboarding_templates",
  "/candidates": "techhire.candidates",
};
export function canSeeHrMenu(url: string, keys: ReadonlySet<string>, ready: boolean): boolean {
  const resource = resources[url];
  return (
    !resource ||
    (ready && ["own", "team", "workspace"].some((s) => keys.has(`${resource}.view.${s}`)))
  );
}
