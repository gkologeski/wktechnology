import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/settings/hubspot-sync")({
  beforeLoad: () => {
    throw redirect({
      to: "/integrations/$slug",
      params: { slug: "hubspot" },
    });
  },
});
