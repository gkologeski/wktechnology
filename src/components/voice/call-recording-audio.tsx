// Player da gravação de uma ligação do agente de voz (link assinado sob demanda).
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { getCallRecordingPlayUrl } from "@/lib/prospecting/calls/call-recording.functions";

export function CallRecordingAudio({ attemptId }: { attemptId: string }) {
  const q = useQuery({
    queryKey: ["call-recording-url", attemptId],
    queryFn: () => getCallRecordingPlayUrl({ data: { attempt_id: attemptId } }),
    staleTime: 20 * 60 * 1000,
  });
  if (q.isLoading)
    return (
      <p className="flex items-center gap-1 text-xs text-muted-foreground" role="status">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Carregando gravação…
      </p>
    );
  if (q.isError)
    return (
      <p className="text-xs text-destructive" role="alert">
        Gravação indisponível no momento.{" "}
        <button type="button" className="underline" onClick={() => q.refetch()}>
          Tentar de novo
        </button>
      </p>
    );
  if (!q.data?.url) return null;
  return (
    <audio
      controls
      preload="metadata"
      src={q.data.url}
      className="h-10 w-full max-w-md"
      aria-label="Gravação da ligação"
    />
  );
}
