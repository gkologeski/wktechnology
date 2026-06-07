import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Phone, FileText, Loader2, AudioLines } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listCallHistory } from "@/lib/call-history.functions";
import { formatDateTime } from "@/lib/crm";
import { useState } from "react";

type Entity = "contact" | "lead" | "deal" | "ticket";

interface Props {
  entity: Entity;
  entityId: string;
  limit?: number;
}

function fmtDuration(seconds: number | null, ms?: number | null) {
  const total = seconds ?? (ms ? Math.round(ms / 1000) : 0);
  if (!total) return "—";
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function CallHistoryPanel({ entity, entityId, limit = 25 }: Props) {
  const fetchFn = useServerFn(listCallHistory);
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["call-history", entity, entityId, limit],
    queryFn: () => fetchFn({ data: { entity, entity_id: entityId, limit } }),
  });
  const [openTranscript, setOpenTranscript] = useState<Record<string, boolean>>({});

  const calls = data ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Phone className="h-4 w-4" />
          Histórico de chamadas
          {calls.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {calls.length}
            </Badge>
          )}
        </CardTitle>
        <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : "Atualizar"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" /> Carregando…
          </div>
        ) : calls.length === 0 ? (
          <div className="text-sm text-muted-foreground">Nenhuma chamada registrada ainda.</div>
        ) : (
          calls.map((c) => {
            const transcriptOpen = openTranscript[c.id];
            return (
              <div key={c.id} className="rounded-md border p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{c.subject || "Ligação"}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{formatDateTime(c.created_at)}</span>
                  <Badge variant="outline" className="font-mono text-xs">
                    {fmtDuration(c.recording_duration_seconds, c.duration_ms)}
                  </Badge>
                  {c.outcome && <Badge variant="secondary">{c.outcome}</Badge>}
                  {c.disposition && <Badge variant="outline">{c.disposition}</Badge>}
                </div>

                {c.recording_url ? (
                  <div className="flex items-center gap-2">
                    <AudioLines className="h-4 w-4 text-muted-foreground shrink-0" />
                    <audio controls preload="none" src={c.recording_url} className="h-8 w-full max-w-md" />
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground italic">
                    Sem gravação disponível.
                  </div>
                )}

                {c.body && <div className="text-sm whitespace-pre-wrap">{c.body}</div>}

                {(c.transcription || c.transcription_status) && (
                  <div className="text-xs">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenTranscript((p) => ({ ...p, [c.id]: !transcriptOpen }))
                      }
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <FileText className="h-3 w-3" />
                      {c.transcription_status === "pending"
                        ? "Transcrição em andamento…"
                        : c.transcription_status === "failed"
                          ? "Transcrição indisponível"
                          : transcriptOpen
                            ? "Ocultar transcrição"
                            : "Ver transcrição"}
                    </button>
                    {transcriptOpen && c.transcription && (
                      <div className="mt-2 whitespace-pre-wrap rounded bg-muted p-2 text-sm leading-relaxed">
                        {c.transcription}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
