import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { readSearchCollection, requireSearchContext } from "./search-collection.server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ItemSchema = z.object({
  entity_type: z.enum(["contact", "company", "deal", "ticket", "activity", "candidate", "job"]),
  entity_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  url: z.string().min(1).max(500),
});

export type RecentPinnedItem = z.infer<typeof ItemSchema>;
function itemUrl(item: RecentPinnedItem) {
  const paths = {
    contact: "contacts",
    company: "companies",
    deal: "deals",
    ticket: "tickets",
    candidate: "candidates",
    job: "jobs",
  };
  return item.entity_type === "activity"
    ? `/activities?highlight=${item.entity_id}`
    : `/${paths[item.entity_type]}/${item.entity_id}`;
}

export const recordRecent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ItemSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireSearchContext(supabase, userId, getRequest().signal);
    const write = await supabase.from("search_recent").upsert(
      {
        user_id: userId,
        entity_type: data.entity_type,
        entity_id: data.entity_id,
        title: data.title,
        url: itemUrl(data),
        opened_at: new Date().toISOString(),
      },
      { onConflict: "user_id,entity_type,entity_id" },
    );
    if (write.error) throw new Error(write.error.message);
    // Prune to last 20
    const { data: rows } = await supabase
      .from("search_recent")
      .select("id")
      .eq("user_id", userId)
      .order("opened_at", { ascending: false })
      .range(20, 999);
    if (rows && rows.length > 0) {
      await supabase
        .from("search_recent")
        .delete()
        .in(
          "id",
          rows.map((r) => (r as { id: string }).id),
        );
    }
    return { ok: true };
  });

export const listRecent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    readSearchCollection(context.supabase, context.userId, "search_recent", getRequest().signal),
  );

export const listPinned = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    readSearchCollection(context.supabase, context.userId, "search_pinned", getRequest().signal),
  );

export const togglePin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ItemSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireSearchContext(supabase, userId, getRequest().signal);
    const { data: existing } = await supabase
      .from("search_pinned")
      .select("id")
      .eq("user_id", userId)
      .eq("entity_type", data.entity_type)
      .eq("entity_id", data.entity_id)
      .maybeSingle();
    if (existing) {
      await supabase
        .from("search_pinned")
        .delete()
        .eq("id", (existing as { id: string }).id);
      return { pinned: false };
    }
    // Enforce 10-item cap
    const { count } = await supabase
      .from("search_pinned")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if ((count ?? 0) >= 10) {
      throw new Error("Limite de 10 itens fixados atingido.");
    }
    const write = await supabase.from("search_pinned").insert({
      user_id: userId,
      entity_type: data.entity_type,
      entity_id: data.entity_id,
      title: data.title,
      url: itemUrl(data),
    });
    if (write.error) throw new Error(write.error.message);
    return { pinned: true };
  });
