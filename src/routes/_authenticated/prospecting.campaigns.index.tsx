import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { usePermissions } from "@/lib/access-control/use-permissions";

// Endereço antigo: campanhas de ligação agora ficam em Captar › Campanhas de Ligação.
export const Route = createFileRoute("/_authenticated/prospecting/campaigns/")({
  beforeLoad: () => {
    throw redirect({ to: "/campaigns/calls", replace: true });
  },
  component: LegacyCallCampaignsRedirect,
});

// Só por segurança: o beforeLoad sempre redireciona.
function LegacyCallCampaignsRedirect() {
  const { canAny } = usePermissions();
  if (!canAny(VIEW_KEYS)) return null;
  return <Link to="/campaigns/calls">Abrir Campanhas de Ligação</Link>;
}

const VIEW_KEYS = [
  "techsales.marketing.campaigns.view.own",
  "techsales.marketing.campaigns.view.team",
  "techsales.marketing.campaigns.view.workspace",
];
