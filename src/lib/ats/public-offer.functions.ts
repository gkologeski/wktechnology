// Acesso público da oferta via token (Fase 2): visualizar e aceitar/recusar.
// O token é validado no handler; o cliente admin é usado para contornar RLS,
// porque a política anon foi removida (acesso público acontece apenas via
// server functions que checam o token antes de devolver dados).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getOfferByToken = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ token: z.string().min(8) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("ats_offers")
      .select(
        "id, title, body, status, salary_amount, salary_currency, start_date, sent_at, signed_at, declined_at, viewed_at, public_token, candidate_id, job_id",
      )
      .eq("public_token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Oferta não encontrada");
    if (!row.viewed_at) {
      await supabaseAdmin
        .from("ats_offers")
        .update({ viewed_at: new Date().toISOString() })
        .eq("id", row.id);
    }
    return row;
  });
