// Sincroniza status de convites LinkedIn enviados via Unipile.
import { createFileRoute } from "@tanstack/react-router";
import { requireCronAuth } from "@/lib/cron-auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadAccountCtx, listSentInvitations } from "@/lib/unipile/client.server";
import { runCronWithLogging, logCronRejection } from "@/lib/cron-observability.server";

export const Route = createFileRoute("/api/public/hooks/unipile-invites-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronAuth(request);
        if (unauth) {
          await logCronRejection("unipile-invites-sync");
          return unauth;
        }
        const run = await runCronWithLogging("unipile-invites-sync", async () => {
          const cutoff = new Date(Date.now() - 30 * 86400_000).toISOString();
          const { data: pending } = await supabaseAdmin
            .from("unipile_message_log")
            .select("id, owner_id, provider_invite_id, sent_at, candidate_id")
            .eq("kind", "invite")
            .eq("status", "pending")
            .gte("sent_at", cutoff)
            .limit(500);

          const rows = (pending ?? []) as Array<{
            id: string;
            owner_id: string;
            provider_invite_id: string | null;
            sent_at: string | null;
            candidate_id: string | null;
          }>;

          const byOwner = new Map<string, typeof rows>();
          for (const r of rows) {
            if (!r.provider_invite_id) continue;
            const arr = byOwner.get(r.owner_id) ?? [];
            arr.push(r);
            byOwner.set(r.owner_id, arr);
          }

          let checked = 0;
          let accepted = 0;
          const errors: string[] = [];

          for (const [ownerId, list] of byOwner) {
            try {
              const ctx = await loadAccountCtx(ownerId);
              const pendingSet = new Set<string>();
              let cursor: string | undefined = undefined;
              let pages = 0;
              do {
                const resp: any = await listSentInvitations(ctx, { cursor, limit: 100 });
                const items: any[] = Array.isArray(resp?.items)
                  ? resp.items
                  : Array.isArray(resp?.data)
                    ? resp.data
                    : [];
                for (const it of items) {
                  const id = String(it?.invitation_id ?? it?.invite_id ?? it?.id ?? "");
                  if (id) pendingSet.add(id);
                }
                cursor = resp?.cursor ?? resp?.next_cursor ?? undefined;
                pages += 1;
              } while (cursor && pages < 3);

              for (const r of list) {
                checked += 1;
                if (!pendingSet.has(String(r.provider_invite_id))) {
                  const acceptedAt = new Date().toISOString();
                  await supabaseAdmin
                    .from("unipile_message_log")
                    .update({ status: "accepted", accepted_at: acceptedAt } as never)
                    .eq("id", r.id);
                  accepted += 1;
                }
              }
            } catch (err) {
              errors.push(
                `owner ${ownerId}: ${err instanceof Error ? err.message : String(err)}`.slice(
                  0,
                  200,
                ),
              );
            }
          }

          return { checked, accepted, errors: errors.length } as unknown as Record<string, unknown>;
        });
        if (run.status === "error")
          return Response.json({ ok: false, error: run.error }, { status: 500 });
        return Response.json({ ok: true, duration_ms: run.duration_ms, ...run.metrics });
      },
      GET: async () => Response.json({ ok: true, info: "POST with Bearer CRON_SECRET" }),
    },
  },
});
