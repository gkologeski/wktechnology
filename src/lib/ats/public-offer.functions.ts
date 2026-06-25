// Acesso público da oferta via token (Fase 2): visualizar e aceitar/recusar.
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

function publicClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export const getOfferByToken = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ token: z.string().min(8) }).parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: row, error } = await sb
      .from("ats_offers")
      .select("id, title, body, status, salary_amount, salary_currency, start_date, sent_at, signed_at, declined_at, viewed_at, public_token, candidate_id, job_id")
      .eq("public_token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Oferta não encontrada");
    // marca como visualizada na primeira vez
    if (!row.viewed_at) {
      await sb.from("ats_offers").update({ viewed_at: new Date().toISOString() }).eq("id", row.id);
    }
    return row;
  });
