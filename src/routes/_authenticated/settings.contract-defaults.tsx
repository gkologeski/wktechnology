import { HrScreenAccess as Order3ScreenAccess } from "@/components/hr-access";
import { createFileRoute } from "@tanstack/react-router";
import { ContractDefaultsPage } from "@/components/contracts/contract-defaults-page";

export const Route = createFileRoute("/_authenticated/settings/contract-defaults")({
  component: Order3RouteAccess,
});

const Order3Page = ContractDefaultsPage;
function Order3RouteAccess() {
  return (
    <Order3ScreenAccess resources={["techcontracts.defaults"]}>
      <Order3Page />
    </Order3ScreenAccess>
  );
}
