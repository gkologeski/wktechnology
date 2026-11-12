import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { usePermissions } from "@/lib/access-control/use-permissions";

// Endereço antigo: campanhas de ligação agora ficam em Captar › Campanhas de Ligação.
export const Route = createFileRoute("/_authenticated/prospecting/campaigns/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/campaigns/calls/$id", params: { id: params.id }, replace: true });
  },
  component: LegacyCallCampaignRedirect,
});

// Só por segurança: o beforeLoad sempre redireciona.
function LegacyCallCampaignRedirect() {
  const { id } = Route.useParams();
  const { canAny } = usePermissions();
  if (!canAny(VIEW_KEYS)) return null;
  return (
    <Link to="/campaigns/calls/$id" params={{ id }}>
      Abrir campanha de ligação
    </Link>
  );
}

const VIEW_KEYS = [
  "techsales.marketing.campaigns.view.own",
  "techsales.marketing.campaigns.view.team",
  "techsales.marketing.campaigns.view.workspace",
];
