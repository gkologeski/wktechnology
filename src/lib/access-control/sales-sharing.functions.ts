import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
export const getSalesPublicToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ table: z.enum(["quotes", "proposals"]), id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { workRpc } = await import("./work-core.server");
    return workRpc<string>(context.supabase, "sales_public_token", {
      p_table: data.table,
      p_id: data.id,
      p_rotate: false,
      p_purpose: "share",
    });
  });
