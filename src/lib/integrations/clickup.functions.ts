// ClickUp — POST /api/v2/list/{list_id}/task
// Personal token: header Authorization: pk_xxx (sem "Bearer")
// Docs: https://developer.clickup.com/reference/createtask
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CLICKUP_BASE = "https://api.clickup.com/api/v2";

async function cuFetch(path: string, init?: RequestInit) {
  const token = process.env.CLICKUP_API_TOKEN;
  if (!token) throw new Error("ClickUp não conectado.");
  const res = await fetch(`${CLICKUP_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: token,
      "Content-Type": "application/json",
      accept: "application/json",
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(`ClickUp erro [${res.status}]: ${JSON.stringify(data).slice(0, 300)}`);
  return data;
}

export const listClickUpTeams = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const r = await cuFetch("/team");
    return r as { teams: { id: string; name: string }[] };
  });

export const listClickUpSpaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ team_id: z.string() }).parse(i))
  .handler(async ({ data }) => {
    return await cuFetch(`/team/${encodeURIComponent(data.team_id)}/space`);
  });

export const listClickUpLists = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ space_id: z.string() }).parse(i))
  .handler(async ({ data }) => {
    return await cuFetch(`/space/${encodeURIComponent(data.space_id)}/list`);
  });

export const createClickUpTasksForDeals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        deal_ids: z.array(z.string().uuid()).min(1).max(100),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: integ } = await supabase
      .from("integrations")
      .select("config")
      .eq("provider", "clickup")
      .maybeSingle();
    const listId = (integ?.config as { list_id?: string } | null)?.list_id;
    if (!listId) throw new Error("Selecione uma lista padrão do ClickUp na tela de integração.");

    const { data: deals, error } = await supabase
      .from("deals")
      .select("id, name, value, currency, expected_close_date, notes")
      .in("id", data.deal_ids);
    if (error) throw new Error(error.message);

    const { data: job } = await supabase
      .from("enrichment_jobs")
      .insert({
        owner_id: userId,
        provider: "clickup",
        kind: "sync",
        entity: "deal",
        status: "running",
        total: deals?.length ?? 0,
        started_at: new Date().toISOString(),
        scope: { ids: data.deal_ids } as never,
      })
      .select("id")
      .single();

    let succeeded = 0,
      failed = 0;
    for (const d of deals ?? []) {
      try {
        const due = d.expected_close_date ? new Date(d.expected_close_date).getTime() : null;
        await cuFetch(`/list/${encodeURIComponent(listId)}/task`, {
          method: "POST",
          body: JSON.stringify({
            name: `[CRM] ${d.name}`,
            description: `Negócio do CRM\nValor: ${d.currency} ${d.value}\n\n${d.notes ?? ""}`,
            due_date: due,
          }),
        });
        succeeded++;
      } catch {
        failed++;
      }
    }

    await supabase
      .from("enrichment_jobs")
      .update({
        status: failed === 0 ? "done" : succeeded === 0 ? "failed" : "partial",
        processed: succeeded + failed,
        succeeded,
        failed,
        finished_at: new Date().toISOString(),
      })
      .eq("id", job!.id);

    return { succeeded, failed };
  });
