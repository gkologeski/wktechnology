// Server functions for per-user grid column preferences.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const gridKeySchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9_-]+$/i);

export const getGridPreference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ gridKey: gridKeySchema }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("user_grid_preferences")
      .select("visible_columns, sort_key, sort_dir")
      .eq("user_id", userId)
      .eq("grid_key", data.gridKey)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const r = (row ?? null) as {
      visible_columns?: string[] | null;
      sort_key?: string | null;
      sort_dir?: string | null;
    } | null;
    return {
      visibleColumns: r?.visible_columns ?? null,
      sortKey: r?.sort_key ?? null,
      sortDir: r?.sort_dir === "asc" || r?.sort_dir === "desc" ? r.sort_dir : null,
    };
  });

export const saveGridPreference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        gridKey: gridKeySchema,
        visibleColumns: z.array(z.string().min(1).max(128)).max(200).optional(),
        sortKey: z.string().min(1).max(128).nullish(),
        sortDir: z.enum(["asc", "desc"]).nullish(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: Record<string, unknown> = {
      user_id: userId,
      grid_key: data.gridKey,
      updated_at: new Date().toISOString(),
    };
    if (data.visibleColumns !== undefined) patch.visible_columns = data.visibleColumns;
    if (data.sortKey !== undefined) patch.sort_key = data.sortKey ?? null;
    if (data.sortDir !== undefined) patch.sort_dir = data.sortDir ?? null;
    const { error } = await supabase
      .from("user_grid_preferences")
      .upsert(patch as never, { onConflict: "user_id,grid_key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetGridPreference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ gridKey: gridKeySchema }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_grid_preferences")
      .delete()
      .eq("user_id", userId)
      .eq("grid_key", data.gridKey);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
