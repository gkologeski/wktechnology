// Configurações do TechProjects: por enquanto só importações.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/projects/settings/")({
  beforeLoad: () => {
    throw redirect({ to: "/projects/settings/imports", replace: true });
  },
  component: () => null,
});
