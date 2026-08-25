// Página pública: candidato confirma horário ou grava respostas em vídeo (async).
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Video, Square, Send, Loader2, CheckCircle2 } from "lucide-react";

type Question = {
  id: string;
  text: string;
  kind?: "text" | "video";
  time_limit_sec?: number;
  max_takes?: number;
};

type Info = {
  ok: boolean;
  interview_id?: string;
  status?: string;
  slots?: string[];
  duration_min?: number;
  kind?: string;
  job_title?: string | null;
  candidate_name?: string | null;
  questions?: Question[];
  submitted_question_ids?: string[];
  error?: string;
};

export const Route = createFileRoute("/interview/$token")({
  head: () => ({
    meta: [
      { title: "Entrevista" },
      { name: "description", content: "Confirme seu horário ou grave suas respostas." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: InterviewPage,
});

function InterviewPage() {
  const { token } = Route.useParams();
  const [info, setInfo] = useState<Info | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const reload = () => {
    fetch(`/api/public/interview/${token}`)
      .then((r) => r.json() as Promise<Info>)
      .then(setInfo)
      .catch(() => setInfo({ ok: false, error: "Erro de rede" }));
  };
  useEffect(() => {
    reload();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!info) return <div className="p-8 text-center text-muted-foreground">Carregando…</div>;
  if (!info.ok) {
    return (
      <div className="p-8 max-w-md mx-auto text-center">
        <h1 className="text-xl font-semibold mb-2">Link indisponível</h1>
        <p className="text-muted-foreground">
          {info.error === "expired"
            ? "Este link de agendamento expirou. Entre em contato com o recrutador."
            : "Não foi possível carregar."}
        </p>
      </div>
    );
  }

  if (info.kind === "async") {
    return <AsyncInterviewView token={token} info={info} onUploaded={reload} />;
  }

  return (
    <SlotPickerView token={token} info={info} confirmed={confirmed} setConfirmed={setConfirmed} />
  );
}

// ============================================================================
// Slot picker (entrevista síncrona)
// ============================================================================

function SlotPickerView({
  token,
  info,
  confirmed,
  setConfirmed,
}: {
  token: string;
  info: Info;
  confirmed: boolean;
  setConfirmed: (b: boolean) => void;
}) {
  const [selected, setSelected] = useState("");
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    if (!selected) return;
    setConfirming(true);
    try {
      const r = await fetch(`/api/public/interview/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot: selected }),
      });
      const data = (await r.json()) as { ok: boolean; error?: string };
      if (!data.ok) toast.error(data.error || "Erro ao confirmar");
      else {
        setConfirmed(true);
        toast.success("Horário confirmado!");
      }
    } finally {
      setConfirming(false);
    }
  };

  if (info.status !== "pending_candidate" || confirmed) {
    return (
      <div className="p-8 max-w-md mx-auto text-center">
        <h1 className="text-xl font-semibold mb-2">Entrevista confirmada ✓</h1>
        <p className="text-muted-foreground">Você receberá os detalhes por e-mail.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-1">Escolha seu horário</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {info.job_title ? `Vaga: ${info.job_title}` : ""}
        {info.duration_min ? ` · ${info.duration_min} min` : ""}
      </p>
      <div className="space-y-2">
        {(info.slots ?? []).map((s) => {
          const d = new Date(s);
          return (
            <label
              key={s}
              className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition ${
                selected === s ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              }`}
            >
              <input
                type="radio"
                name="slot"
                value={s}
                checked={selected === s}
                onChange={() => setSelected(s)}
              />
              <span className="font-medium">
                {d.toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short" })}
              </span>
            </label>
          );
        })}
      </div>
      <Button className="w-full mt-6" onClick={handleConfirm} disabled={!selected || confirming}>
        {confirming ? "Confirmando…" : "Confirmar horário"}
      </Button>
    </div>
  );
}

// ============================================================================
// Vídeo assíncrono
// ============================================================================

function AsyncInterviewView({
  token,
  info,
  onUploaded,
}: {
  token: string;
  info: Info;
  onUploaded: () => void;
}) {
  const questions = info.questions ?? [];
  const submitted = new Set(info.submitted_question_ids ?? []);
  const pending = questions.filter((q) => !submitted.has(q.id));
  const allDone = pending.length === 0 && questions.length > 0;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Entrevista em vídeo</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {info.job_title ? `Vaga: ${info.job_title}` : ""}
        {info.candidate_name ? ` · ${info.candidate_name}` : ""}
      </p>

      {questions.length === 0 && (
        <p className="text-muted-foreground">Nenhuma pergunta configurada para esta entrevista.</p>
      )}

      {allDone && (
        <div className="border rounded-lg p-6 text-center bg-primary/5 border-primary">
          <CheckCircle2 className="h-8 w-8 mx-auto text-primary mb-2" />
          <p className="font-semibold">Todas as respostas foram enviadas. Obrigado!</p>
          <p className="text-sm text-muted-foreground mt-1">
            O recrutador receberá uma notificação.
          </p>
        </div>
      )}

      <ol className="space-y-6">
        {questions.map((q, idx) => (
          <li key={q.id} className="border rounded-lg p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="text-xs text-muted-foreground">
                  Pergunta {idx + 1} de {questions.length}
                </div>
                <h2 className="font-semibold">{q.text}</h2>
                {q.time_limit_sec && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Limite: {q.time_limit_sec}s
                  </div>
                )}
              </div>
              {submitted.has(q.id) && (
                <span className="inline-flex items-center gap-1 text-xs text-primary font-medium">
                  <CheckCircle2 className="h-4 w-4" /> Enviada
                </span>
              )}
            </div>
            {!submitted.has(q.id) && (
              <VideoRecorder
                token={token}
                questionId={q.id}
                maxSec={q.time_limit_sec ?? 120}
                onUploaded={onUploaded}
              />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function VideoRecorder({
  token,
  questionId,
  maxSec,
  onUploaded,
}: {
  token: string;
  questionId: string;
  maxSec: number;
  onUploaded: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  const [state, setState] = useState<"idle" | "ready" | "recording" | "review" | "uploading">(
    "idle",
  );
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);

  const cleanup = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };
  useEffect(() => () => cleanup(), []);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        await videoRef.current.play();
      }
      setState("ready");
    } catch {
      toast.error("Não foi possível acessar câmera/microfone.");
    }
  };

  const record = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : "video/webm";
    const rec = new MediaRecorder(streamRef.current, { mimeType: mime });
    recorderRef.current = rec;
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const b = new Blob(chunksRef.current, { type: mime });
      setBlob(b);
      setPreviewUrl(URL.createObjectURL(b));
      setState("review");
      cleanup();
    };
    rec.start();
    setState("recording");
    setElapsed(0);
    timerRef.current = window.setInterval(() => {
      setElapsed((e) => {
        if (e + 1 >= maxSec) {
          stop();
          return maxSec;
        }
        return e + 1;
      });
    }, 1000);
  };

  const stop = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const retake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setBlob(null);
    setState("idle");
  };

  const upload = async () => {
    if (!blob) return;
    setState("uploading");
    const form = new FormData();
    form.append("question_id", questionId);
    form.append("duration_sec", String(elapsed));
    form.append("file", new File([blob], `${questionId}.webm`, { type: blob.type }));
    try {
      const r = await fetch(`/api/public/interview/${token}`, { method: "POST", body: form });
      const data = (await r.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        toast.error(data.error || "Erro ao enviar");
        setState("review");
        return;
      }
      toast.success("Resposta enviada!");
      onUploaded();
    } catch {
      toast.error("Falha de rede ao enviar.");
      setState("review");
    }
  };

  return (
    <div>
      <video
        ref={videoRef}
        src={previewUrl ?? undefined}
        controls={state === "review"}
        className="w-full aspect-video bg-black rounded mb-3"
      />
      <div className="flex flex-wrap items-center gap-2">
        {state === "idle" && (
          <Button type="button" onClick={start}>
            <Video className="h-4 w-4 mr-2" /> Iniciar câmera
          </Button>
        )}
        {state === "ready" && (
          <Button type="button" onClick={record}>
            <Video className="h-4 w-4 mr-2" /> Gravar (máx {maxSec}s)
          </Button>
        )}
        {state === "recording" && (
          <>
            <Button type="button" variant="destructive" onClick={stop}>
              <Square className="h-4 w-4 mr-2" /> Parar
            </Button>
            <span className="text-sm tabular-nums">
              {elapsed}s / {maxSec}s
            </span>
          </>
        )}
        {state === "review" && (
          <>
            <Button type="button" variant="outline" onClick={retake}>
              Regravar
            </Button>
            <Button type="button" onClick={upload}>
              <Send className="h-4 w-4 mr-2" /> Enviar
            </Button>
          </>
        )}
        {state === "uploading" && (
          <Button type="button" disabled>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando…
          </Button>
        )}
      </div>
    </div>
  );
}
