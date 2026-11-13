// Cartão da ligação na Inbox unificada: lê a tentativa pelo cliente do usuário (RLS de
// prospecting_call_attempts) e monta o mesmo texto do cartão da Inbox do WhatsApp.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buildCallInboxBody } from "@/lib/prospecting/calls/call-inbox";
import { formatDateTime } from "@/lib/crm";

export function useCallAttemptCard(attemptId: string) {
  return useQuery({
    queryKey: ["inbox-unified", "call", attemptId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospecting_call_attempts")
        .select(
          "status, duration_seconds, summary, transcript, recording_url, meeting_status, meeting_start_at, script:prospecting_scripts(name)",
        )
        .eq("id", attemptId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Ligação não encontrada.");
      const script = data.script as { name?: string | null } | null;
      return {
        body: buildCallInboxBody({
          status: data.status,
          duration_seconds: data.duration_seconds,
          script_name: script?.name ?? null,
          summary: data.summary,
          transcript: data.transcript,
          meeting_when:
            data.meeting_status === "booked" && data.meeting_start_at
              ? formatDateTime(data.meeting_start_at)
              : null,
        }),
        recordingUrl: data.recording_url,
      };
    },
  });
}
