import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ItemSchema = z.object({
  entity_type: z.string().min(1).max(32),
  entity_id: z.string().min(1).max(64),
  title: z.string().min(1).max(200),
  url: z.string().min(1).max(500),
});

export type RecentPinnedItem = z.infer<typeof ItemSchema>;

export const recordRecent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ItemSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase.from("search_recent").upsert(
      {
        user_id: userId,
        entity_type: data.entity_type,
        entity_id: data.entity_id,
        title: data.title,
        url: data.url,
        opened_at: new Date().toISOString(),
      },
      { onConflict: "user_id,entity_type,entity_id" },
    );
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
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("search_recent")
      .select("entity_type, entity_id, title, url, opened_at")
      .eq("user_id", userId)
      .order("opened_at", { ascending: false })
      .limit(10);
    return { items: (data ?? []) as Array<RecentPinnedItem & { opened_at: string }> };
  });

export const listPinned = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("search_pinned")
      .select("entity_type, entity_id, title, url, pinned_at")
      .eq("user_id", userId)
      .order("pinned_at", { ascending: false })
      .limit(10);
    return { items: (data ?? []) as Array<RecentPinnedItem & { pinned_at: string }> };
  });

export const togglePin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ItemSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
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
    await supabase.from("search_pinned").insert({
      user_id: userId,
      entity_type: data.entity_type,
      entity_id: data.entity_id,
      title: data.title,
      url: data.url,
    });
    return { pinned: true };
  });
