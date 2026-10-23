import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getHrPrivateCapabilities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        resource: z.enum(["people_sensitive", "one_on_ones_private", "allocations_financial"]),
        ids: z.array(z.string().uuid()).max(200),
        parent: z.boolean().default(false),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { readHrPrivate } = await import("./hr-private.server");
    const rows = await readHrPrivate(context.supabase, data.resource, data.ids, data.parent);
    return [...rows.values()].map(({ id, can_view, can_update }) => ({ id, can_view, can_update }));
  });
