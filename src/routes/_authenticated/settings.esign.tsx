import { createFileRoute, Navigate } from "@tanstack/react-router";
import { HrScreenAccess } from "@/components/hr-access";
export const Route = createFileRoute("/_authenticated/settings/esign")({
  validateSearch: (s: Record<string, unknown>) => ({
    document:
      typeof s.document === "string" && /^[0-9a-f-]{36}$/i.test(s.document)
        ? s.document
        : undefined,
  }),
  component: LegacyEsignRedirect,
});
function LegacyEsignRedirect() {
  const search = Route.useSearch();
  return (
    <HrScreenAccess resources={["techcontracts.esign"]}>
      <Navigate to="/contracts/signatures" search={search} replace />
    </HrScreenAccess>
  );
}
