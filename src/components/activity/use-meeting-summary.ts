// Geração de resumo com IA a partir da gravação da reunião vinculada a uma
// atividade da timeline.
// Extraído de `activity-timeline.tsx` sem mudança de comportamento.
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import type { Activity } from "@/lib/db-types";
import {
  generateMeetingSummary,
  summarizeCalendarEventRecording,
} from "@/lib/meetings.functions";

export function useMeetingSummary(items: Activity[], onSummarized: () => void) {
  const summarizeMeetingFn = useServerFn(generateMeetingSummary);
  const summarizeCalEventFn = useServerFn(summarizeCalendarEventRecording);

  return async (activityId: string) => {
    const a = items.find((i) => i.id === activityId);
    const ext = ((a as unknown as { external_ids?: Record<string, unknown> } | undefined)
      ?.external_ids ?? {}) as Record<string, unknown>;
    const meetingId = typeof ext.meeting_id === "string" ? ext.meeting_id : null;
    const calendarEventId =
      typeof ext.calendar_event_id === "string" ? ext.calendar_event_id : null;
    try {
      if (meetingId) {
        toast.message("Gerando resumo com IA…");
        await summarizeMeetingFn({ data: { meeting_id: meetingId } });
        toast.success("Resumo gerado. Veja em Reuniões.");
        return;
      }
      if (calendarEventId) {
        toast.message("Baixando gravação do Drive e gerando resumo com IA…");
        await summarizeCalEventFn({ data: { calendar_event_id: calendarEventId } });
        toast.success("Resumo gerado a partir da gravação do Drive.");
        onSummarized();
        return;
      }
      toast.error("Esta reunião não tem gravação vinculada para resumir.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao resumir reunião");
    }
  };
}
