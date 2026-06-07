import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const resolveSlug = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ slug: z.string().min(1).max(60) }).parse(i))
  .handler(async ({ data }) => {
    const { data: row } = await supabaseAdmin
      .rpc("wa_ad_slug_increment", { p_slug: data.slug })
      .maybeSingle();
    if (!row) return null;
    return row as { display_phone_number: string; prefill_message: string | null };
  });

export const Route = createFileRoute("/wa/$slug")({
  loader: async ({ params }) => {
    const row = await resolveSlug({ data: { slug: params.slug } });
    if (!row) throw redirect({ to: "/" });
    const phone = row.display_phone_number.replace(/[^\d]/g, "");
    const text = row.prefill_message ? `?text=${encodeURIComponent(row.prefill_message)}` : "";
    throw redirect({ href: `https://wa.me/${phone}${text}` });
  },
  component: () => null,
});
