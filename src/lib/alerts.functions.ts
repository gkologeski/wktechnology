// Sprint 7 — Alertas operacionais consolidados.
// Retorna listas de contratos expirando, lançamentos vencidos e projetos em risco.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getOperationalAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadOperationalAlerts } = await import("./operational-alerts.server");
    return loadOperationalAlerts(context.supabase, context.userId);
  });
