import type { SupabaseClient } from "@supabase/supabase-js";
import type { RecentPinnedItem } from "./recent-pinned.functions";

/** Active caller context only; never a privileged data client. */
export async function requireSearchContext(
  client: SupabaseClient,
  userId: string,
  signal?: AbortSignal,
): Promise<{ workspace: string; keys: Record<string, boolean> }> {
  const query = client.rpc("work_access_context");
  const { data, error } = await (signal ? query.abortSignal(signal) : query);
  if (error) throw new Error(error.message);
  const context = data as {
    workspace?: string;
    actor?: string;
    keys?: Record<string, boolean>;
  } | null;
  if (!context?.workspace || context.actor !== userId)
    throw new Error("Sem acesso a um workspace ativo.");
  return { workspace: context.workspace, keys: context.keys ?? {} };
}

const SOURCES = {
  contact: {
    table: "contacts",
    select: "id,first_name,last_name",
    fallback: "Contato",
    path: "contacts",
  },
  company: { table: "companies", select: "id,name", fallback: "Empresa", path: "companies" },
  deal: { table: "deals", select: "id,name", fallback: "Negócio", path: "deals" },
  ticket: { table: "tickets", select: "id,subject", fallback: "Ticket", path: "tickets" },
  activity: {
    table: "activities",
    select: "id,subject",
    fallback: "Atividade",
    path: "activities",
  },
  candidate: {
    table: "ats_candidates",
    select: "id,full_name",
    fallback: "Candidato",
    path: "candidates",
  },
  job: { table: "ats_jobs", select: "id,title", fallback: "Vaga", path: "jobs" },
} as const;

/** Re-read names and visibility with caller RLS. Stored labels are never authority. */
export async function readSearchCollection(
  client: SupabaseClient,
  userId: string,
  table: "search_recent" | "search_pinned",
  signal: AbortSignal,
) {
  const { workspace } = await requireSearchContext(client, userId, signal);
  const timestamp = table === "search_recent" ? "opened_at" : "pinned_at";
  const { data, error } = await client
    .from(table)
    .select(`entity_type,entity_id,${timestamp}`)
    .eq("user_id", userId)
    .order(timestamp, { ascending: false })
    .limit(10)
    .abortSignal(signal);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Array<{
    entity_type: RecentPinnedItem["entity_type"];
    entity_id: string;
    opened_at?: string;
    pinned_at?: string;
  }>;
  const visible = new Map<string, RecentPinnedItem>();
  await Promise.all(
    Object.entries(SOURCES).map(async ([type, source]) => {
      const ids = rows.filter((r) => r.entity_type === type).map((r) => r.entity_id);
      if (!ids.length) return;
      const result = await client
        .from(source.table)
        .select(source.select)
        .eq("workspace_id", workspace)
        .in("id", ids)
        .abortSignal(signal);
      if (result.error) throw new Error(result.error.message);
      for (const record of (result.data ?? []) as unknown as Array<Record<string, unknown>>) {
        const id = String(record.id);
        const name =
          type === "contact"
            ? [record.first_name, record.last_name].filter(Boolean).join(" ")
            : (record.name ?? record.subject ?? record.full_name ?? record.title);
        visible.set(`${type}:${id}`, {
          entity_type: type as RecentPinnedItem["entity_type"],
          entity_id: id,
          title: String(name || source.fallback),
          url: type === "activity" ? `/activities?highlight=${id}` : `/${source.path}/${id}`,
        });
      }
    }),
  );
  return {
    items: rows.flatMap((row) => {
      const item = visible.get(`${row.entity_type}:${row.entity_id}`);
      return item
        ? [
            {
              ...item,
              ...(row.opened_at ? { opened_at: row.opened_at } : {}),
              ...(row.pinned_at ? { pinned_at: row.pinned_at } : {}),
            },
          ]
        : [];
    }),
  };
}
