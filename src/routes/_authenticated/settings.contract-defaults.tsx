import { createFileRoute } from "@tanstack/react-router";
import { ContractDefaultsPage } from "@/components/contracts/contract-defaults-page";

export const Route = createFileRoute("/_authenticated/settings/contract-defaults")({
  component: ContractDefaultsPage,
});
