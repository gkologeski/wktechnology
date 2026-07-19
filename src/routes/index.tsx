// Single-host: sempre aterrissa na ERP Home unificada; o usuário escolhe
// o módulo pelo grid ou pelo ModuleSwitcher.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/home" });
  },
});
