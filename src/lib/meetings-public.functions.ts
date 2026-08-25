import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
// Carrega o cliente admin sob demanda (mantém o bundle do cliente limpo).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sbAdmin(): Promise<any> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/**
 * Public lookup — no auth. Validates token + expiry, returns the room name
 * for the guest page. Never exposes internals.
 */
export const getPublicMeeting = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ token: z.string().min(8).max(64) }).parse(input))
  .handler(async ({ data }) => {
    const supabaseAdmin = await sbAdmin();
    const { data: m, error } = await supabaseAdmin
      .from("meetings")
      .select("id, title, room_name, recording_consent, expires_at, status")
      .eq("public_token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!m) return { ok: false as const, reason: "not_found" as const };
    if (m.status === "cancelled") return { ok: false as const, reason: "cancelled" as const };
    if (m.expires_at && new Date(m.expires_at) < new Date()) {
      return { ok: false as const, reason: "expired" as const };
    }
    return {
      ok: true as const,
      meeting: {
        id: m.id,
        title: m.title,
        room_name: m.room_name,
        recording_consent: m.recording_consent,
      },
    };
  });

/** Registers a guest participant. No auth — protected by token validation. */
export const registerPublicParticipant = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        token: z.string().min(8).max(64),
        display_name: z.string().min(1).max(120),
        email: z.string().email().max(255).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const supabaseAdmin = await sbAdmin();
    const { data: m } = await supabaseAdmin
      .from("meetings")
      .select("id, owner_id, expires_at, status")
      .eq("public_token", data.token)
      .maybeSingle();
    if (!m || m.status === "cancelled" || (m.expires_at && new Date(m.expires_at) < new Date())) {
      throw new Error("Reunião indisponível");
    }
    await supabaseAdmin.from("meeting_participants").insert({
      meeting_id: m.id,
      owner_id: m.owner_id,
      display_name: data.display_name,
      email: data.email ?? null,
    });
    // mark live on first join
    await supabaseAdmin
      .from("meetings")
      .update({
        status: "live",
        started_at: new Date().toISOString(),
      })
      .eq("id", m.id)
      .is("started_at", null);
    return { ok: true };
  });
