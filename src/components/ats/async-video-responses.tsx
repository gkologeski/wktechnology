// Mini-player de respostas em vídeo assíncrono enviadas pelo candidato.
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Video, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listAsyncVideoResponses } from "@/lib/ats/async-video.functions";

type Resp = {
  id: string;
  question_id: string;
  duration_sec: number | null;
  signed_url: string | null;
  created_at: string;
};

export function AsyncVideoResponses({
  interviewId,
  snapshot,
}: {
  interviewId: string;
  snapshot?: Array<{ id: string; text: string }> | null;
}) {
  const fetchFn = useServerFn(listAsyncVideoResponses);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Resp[] | null>(null);

  useEffect(() => {
    if (!open || rows) return;
    fetchFn({ data: { interview_id: interviewId } })
      .then((r) => setRows(r as Resp[]))
      .catch(() => setRows([]));
  }, [open, rows, fetchFn, interviewId]);

  const labelFor = (qid: string) => snapshot?.find((q) => q.id === qid)?.text ?? `Pergunta ${qid}`;

  return (
    <div className="mt-2">
      <Button
        size="sm"
        variant="outline"
        className="h-6 px-2 text-xs"
        onClick={() => setOpen((v) => !v)}
      >
        <Video className="h-3 w-3 mr-1" />
        {open ? "Ocultar vídeos" : "Ver vídeos"}
      </Button>

      {open && (
        <div className="mt-2 space-y-3">
          {rows === null && (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Carregando…
            </div>
          )}
          {rows && rows.length === 0 && (
            <div className="text-xs text-muted-foreground">Nenhuma resposta enviada ainda.</div>
          )}
          {rows?.map((r) => (
            <div key={r.id} className="border rounded p-2">
              <div className="text-xs font-medium mb-1 line-clamp-2">{labelFor(r.question_id)}</div>
              {r.signed_url ? (
                <video src={r.signed_url} controls className="w-full max-h-80 rounded bg-black" />
              ) : (
                <div className="text-xs text-muted-foreground">Vídeo indisponível</div>
              )}
              {r.duration_sec ? (
                <div className="text-xs text-muted-foreground mt-1">{r.duration_sec}s</div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
