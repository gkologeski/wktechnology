// /catalog/job-profiles — rota preservada por compatibilidade.
// A gestão de cargos passou a viver na aba "Cargos e funções" da central
// unificada /catalog/contracting-presets. Links antigos continuam válidos.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/catalog/job-profiles")({
  beforeLoad: () => {
    throw redirect({
      to: "/catalog/contracting-presets",
      search: { tab: "cargos" },
      replace: true,
    });
  },
});
