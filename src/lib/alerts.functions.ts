// Sprint 7 — Alertas operacionais consolidados.
// Retorna listas de contratos expirando, lançamentos vencidos e projetos em risco.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadOperationalAlerts } from "./operational-alerts.server";

export const getOperationalAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return loadOperationalAlerts(context.supabase, context.userId);
  });
