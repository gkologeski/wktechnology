import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({ event_id: z.string().uuid() });

export const refreshEventRecording = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    // Verify the caller owns the event (RLS-scoped client).
    const { data: ev, error } = await context.supabase
      .from("calendar_events")
      .select("id")
      .eq("id", data.event_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!ev) throw new Error("Evento não encontrado ou sem acesso");

    const { syncRecordingForEvent } = await import("@/lib/calendar/engine.server");
    return syncRecordingForEvent(data.event_id);
  });
