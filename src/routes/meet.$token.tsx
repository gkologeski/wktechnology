import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getPublicMeeting,
  registerPublicParticipant,
} from "@/lib/meetings-public.functions";

export const Route = createFileRoute("/meet/$token")({
  component: PublicMeetPage,
  head: () => ({
    meta: [
      { title: "Sala de vídeo" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function PublicMeetPage() {
  const { token } = Route.useParams();
  const lookup = useServerFn(getPublicMeeting);
  const register = useServerFn(registerPublicParticipant);

  const [state, setState] = useState<"loading" | "ready" | "joined" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [meeting, setMeeting] = useState<{ id: string; title: string; room_name: string; recording_consent: boolean } | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await lookup({ data: { token } });
        if (!alive) return;
        if (!res.ok) {
          setError(
            res.reason === "expired"
              ? "Este link expirou."
              : res.reason === "cancelled"
                ? "Esta reunião foi cancelada."
                : "Reunião não encontrada.",
          );
          setState("error");
          return;
        }
        setMeeting(res.meeting);
        setState("ready");
      } catch (e: any) {
        setError(e?.message ?? "Erro ao carregar reunião");
        setState("error");
      }
    })();
    return () => { alive = false; };
  }, [token, lookup]);

  async function join() {
    if (!meeting || !name.trim()) return;
    setSubmitting(true);
    try {
      await register({
        data: { token, display_name: name.trim(), email: email.trim() || null },
      });
      setState("joined");
    } catch (e: any) {
      setError(e?.message ?? "Falha ao entrar");
    } finally {
      setSubmitting(false);
    }
  }

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state === "error" || !meeting) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Não foi possível entrar</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state === "ready") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-muted/30">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" /> {meeting.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Seu nome *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Como aparecer na sala"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail (opcional)</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@empresa.com"
              />
            </div>
            {meeting.recording_consent && (
              <p className="text-xs text-muted-foreground">
                Esta reunião pode ser <strong>gravada</strong>. Ao entrar, você consente
                com a gravação para fins de registro.
              </p>
            )}
            <Button onClick={join} disabled={submitting || !name.trim()} className="w-full">
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Video className="mr-2 h-4 w-4" />}
              Entrar na sala
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // joined → embed Jitsi
  const jitsiUrl = `https://meet.jit.si/${meeting.room_name}#userInfo.displayName=%22${encodeURIComponent(name)}%22&config.prejoinPageEnabled=false${meeting.recording_consent ? "&config.fileRecordingsEnabled=true" : ""}`;

  return (
    <div className="h-screen w-screen">
      <iframe
        ref={iframeRef}
        src={jitsiUrl}
        allow="camera; microphone; fullscreen; display-capture; autoplay"
        className="h-full w-full border-0"
        title={meeting.title}
      />
    </div>
  );
}
