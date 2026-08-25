import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireCronAuth } from "@/lib/cron-auth.server";
import { runCronWithLogging } from "@/lib/cron-observability.server";
import { runContaAzulSteps } from "@/lib/integrations/contaazul-steps.server";
import type { CaEntity } from "@/lib/integrations/contaazul-map";

/** Entidades sincronizadas de forma incremental pelo cron. */
const INCREMENTAL: CaEntity[] = [
  "categories",
  "cost-centers",
  "bank-accounts",
  "receivable",
  "payable",
  "statements",
];

/** Janela padrão de sincronização incremental (dias). */
const WINDOW_DAYS = 30;

export const Route = createFileRoute("/api/public/hooks/contaazul-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronAuth(request);
        if (unauth) return unauth;

        const run = await runCronWithLogging("contaazul-tick", async () => {
          const { data: rows, error } = await supabaseAdmin
            .from("integrations")
            .select("owner_id, oauth_tokens, config")
            .eq("provider", "contaazul")
            .eq("status", "connected");
          if (error) throw new Error(error.message);

          const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
          let workspaces = 0;
          let imported = 0;
          let updated = 0;
          let failed = 0;

          for (const row of (rows ?? []) as Array<{
            owner_id: string;
            oauth_tokens: { access_token?: string } | null;
            config: { connected_by?: string } | null;
          }>) {
            if (!row.oauth_tokens?.access_token) continue;
            workspaces += 1;
            const results = await runContaAzulSteps(
              {
                supabase: supabaseAdmin,
                workspaceId: row.owner_id,
                userId: row.config?.connected_by ?? row.owner_id,
                since,
              },
              INCREMENTAL,
            );
            for (const r of results) {
              imported += r.imported;
              updated += r.updated;
              failed += r.failed;
            }
          }

          return { workspaces, imported, updated, failed } as unknown as Record<string, unknown>;
        });

        if (run.status === "error") {
          return Response.json({ ok: false, error: run.error }, { status: 500 });
        }
        return Response.json({ ok: true, duration_ms: run.duration_ms, ...run.metrics });
      },
      GET: async () => Response.json({ ok: true, info: "POST with Bearer CRON_SECRET" }),
    },
  },
});
