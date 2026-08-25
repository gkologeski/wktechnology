import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getSurveyByToken = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ token: z.string().min(8).max(64) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: survey, error } = await supabaseAdmin
      .from("survey_responses")
      .select("id, token, kind, score, comment, responded_at, ticket_id")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw error;
    if (!survey) throw new Error("Pesquisa não encontrada.");
    const { data: ticket } = await supabaseAdmin
      .from("tickets")
      .select("subject")
      .eq("id", survey.ticket_id)
      .maybeSingle();
    return { survey, ticketSubject: ticket?.subject ?? null };
  });

export const submitSurvey = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        token: z.string().min(8).max(64),
        score: z.number().int().min(0).max(10),
        comment: z.string().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing, error: e1 } = await supabaseAdmin
      .from("survey_responses")
      .select("id, kind, responded_at")
      .eq("token", data.token)
      .maybeSingle();
    if (e1) throw e1;
    if (!existing) throw new Error("Pesquisa não encontrada.");
    if (existing.responded_at) throw new Error("Pesquisa já respondida.");
    const max = existing.kind === "nps" ? 10 : 5;
    if (data.score > max) throw new Error(`Pontuação deve estar entre 0 e ${max}.`);
    const { error: e2 } = await supabaseAdmin
      .from("survey_responses")
      .update({
        score: data.score,
        comment: data.comment ?? null,
        responded_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (e2) throw e2;
    return { ok: true };
  });
