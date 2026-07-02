// /workspace → alias histórico. Redireciona para /home (ERP Home unificada).
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/workspace/")({
  beforeLoad: () => {
    throw redirect({ to: "/home" });
  },
});
