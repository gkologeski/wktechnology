import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ENTITY = z.enum(["contact", "lead", "deal", "ticket"]);

export type CallHistoryEntry = {
  id: string;
  subject: string | null;
  body: string | null;
  outcome: string | null;
  disposition: string | null;
  duration_ms: number | null;
  created_at: string;
  recording_url: string | null;
  recording_sid: string | null;
  recording_duration_seconds: number | null;
  transcription: string | null;
  transcription_status: string | null;
  call_sid: string | null;
};

/**
 * Release 11 — call history linked to a contact / lead / deal / ticket.
 * Returns latest call activities with recording + transcription metadata so
 * the detail page can render an audio player and the agent's notes inline.
 */
export const listCallHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        entity: ENTITY,
        entity_id: z.string().uuid(),
        limit: z.number().int().min(1).max(100).default(25),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const col =
      data.entity === "contact"
        ? "related_contact_id"
        : data.entity === "lead"
          ? "related_lead_id"
          : data.entity === "deal"
            ? "related_deal_id"
            : "related_ticket_id";

    const { data: rows, error } = await supabase
      .from("activities")
      .select(
        "id, subject, body, outcome, disposition, duration_ms, created_at, recording_url, recording_sid, recording_duration_seconds, transcription, transcription_status, external_ids",
      )
      .eq("type", "call")
      .eq(col, data.entity_id)
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (error) throw new Error(error.message);

    return (rows ?? []).map((r) => {
      const ext = (r.external_ids ?? {}) as { twilio_call_sid?: string };
      return {
        id: r.id,
        subject: r.subject,
        body: r.body,
        outcome: r.outcome,
        disposition: r.disposition,
        duration_ms: r.duration_ms,
        created_at: r.created_at,
        recording_url: r.recording_url,
        recording_sid: r.recording_sid,
        recording_duration_seconds: r.recording_duration_seconds,
        transcription: r.transcription,
        transcription_status: r.transcription_status,
        call_sid: ext.twilio_call_sid ?? null,
      } satisfies CallHistoryEntry;
    });
  });
