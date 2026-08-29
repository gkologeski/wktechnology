// Migrado para dentro de Configurações. Mantido como redirect para links antigos.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/integrations/$slug")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/settings/integrations/$slug", params: { slug: params.slug }, replace: true });
  },
  component: () => null,
});
