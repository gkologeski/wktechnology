// Public capability checked atomically against offer state, document and expiry.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { offerRpc } from "./offer-rpc.server";
export const getOfferByToken = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ token: z.string().min(32).max(128) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return offerRpc<{
      signing_token: string | null;
      title: string;
      body: string;
      status: string;
      salary_amount: number | null;
      salary_currency: string;
      start_date: string | null;
      sent_at: string | null;
      signed_at: string | null;
      declined_at: string | null;
    }>(supabaseAdmin, "ats_offer_public", { _token: data.token });
  });
