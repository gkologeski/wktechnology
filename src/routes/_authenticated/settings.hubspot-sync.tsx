// Consolidado no detalhe da integração, dentro de Configurações.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/settings/hubspot-sync")({
  beforeLoad: () => {
    throw redirect({
      to: "/settings/integrations/$slug",
      params: { slug: "hubspot" },
      replace: true,
    });
  },
  component: () => null,
});
