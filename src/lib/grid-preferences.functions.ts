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
      .select("visible_columns")
      .eq("user_id", userId)
      .eq("grid_key", data.gridKey)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { visibleColumns: (row?.visible_columns as string[] | null) ?? null };
  });

export const saveGridPreference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        gridKey: gridKeySchema,
        visibleColumns: z.array(z.string().min(1).max(128)).max(200),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("user_grid_preferences").upsert(
      {
        user_id: userId,
        grid_key: data.gridKey,
        visible_columns: data.visibleColumns,
      } as never,
      { onConflict: "user_id,grid_key" },
    );
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
