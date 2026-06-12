import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { ImagePlus, Loader2, Maximize2, Mic, MicOff, Square, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { BUG_CATEGORIES, BUG_KINDS } from "@/lib/bug-report-taxonomy";
import { useScreenRecorder } from "./use-screen-recorder";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const schema = z.object({
  kind: z.enum(["new_feature", "existing_broken"]),
  category: z.string().min(1),
  subtype: z.string().min(1),
  description: z.string().trim().min(10, "Descreva com pelo menos 10 caracteres").max(4000),
});

function fmtTime(ms: number) {
  const s = Math.floor(ms / 1000);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function BugReportDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const [kind, setKind] = useState<"new_feature" | "existing_broken">("existing_broken");
  const [category, setCategory] = useState<string>("");
  const [subtype, setSubtype] = useState<string>("");
  const [description, setDescription] = useState("");
  const [includeMic, setIncludeMic] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [minimized, setMinimized] = useState(false);

  const recorder = useScreenRecorder();

  const subtypes = useMemo(
    () => BUG_CATEGORIES.find((c) => c.value === category)?.subtypes ?? [],
    [category],
  );

  const resetAll = () => {
    setKind("existing_broken");
    setCategory("");
    setSubtype("");
    setDescription("");
    setIncludeMic(true);
    setMinimized(false);
    recorder.reset();
  };

  const handleClose = (next: boolean) => {
    // Ignore close attempts triggered when we minimize the dialog during recording
    if (!next && minimized) return;
    if (!next) {
      if (recorder.status === "recording") recorder.stop();
      resetAll();
    }
    onOpenChange(next);
  };

  const handleStartRecording = async () => {
    await recorder.start({ includeMic });
  };

  // Once the recorder is actively recording, hide the dialog so the user can
  // interact with the page being recorded. Restore it when recording stops.
  useEffect(() => {
    if (recorder.status === "recording" && open) {
      setMinimized(true);
    } else if (recorder.status === "stopped" || recorder.status === "error") {
      setMinimized(false);
    }
  }, [recorder.status, open]);

  const handleSubmit = async () => {
    if (!user) {
      toast.error("Você precisa estar autenticado.");
      return;
    }
    const parsed = schema.safeParse({ kind, category, subtype, description });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Preencha todos os campos");
      return;
    }

    setSubmitting(true);
    try {
      let recordingPath: string | null = null;
      let hasAudio = false;

      if (recorder.blob) {
        const fileId = crypto.randomUUID();
        const path = `${user.id}/${fileId}.webm`;
        const { error: upErr } = await supabase.storage
          .from("bug-reports")
          .upload(path, recorder.blob, {
            contentType: recorder.blob.type || "video/webm",
            upsert: false,
          });
        if (upErr) throw upErr;
        recordingPath = path;
        hasAudio = includeMic;
      }

      const { error: insErr } = await supabase.from("bug_reports").insert({
        owner_id: user.id,
        kind: parsed.data.kind,
        category: parsed.data.category,
        subtype: parsed.data.subtype,
        description: parsed.data.description,
        recording_path: recordingPath,
        recording_has_audio: hasAudio,
        page_url: typeof window !== "undefined" ? window.location.href : null,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      });
      if (insErr) throw insErr;

      toast.success("Chamado enviado. Obrigado pelo feedback!");
      resetAll();
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Não foi possível enviar o chamado";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const recording = recorder.status === "recording";
  const dialogVisible = open && !minimized;

  return (
    <>
      <Dialog open={dialogVisible} onOpenChange={handleClose}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Abrir chamado</DialogTitle>
            <DialogDescription>
              Descreva o problema ou sugira uma melhoria. Você pode anexar uma gravação de tela.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BUG_KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={category}
                  onValueChange={(v) => { setCategory(v); setSubtype(""); }}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {BUG_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Subtipo</Label>
                <Select value={subtype} onValueChange={setSubtype} disabled={!category}>
                  <SelectTrigger><SelectValue placeholder={category ? "Selecione" : "Escolha a categoria"} /></SelectTrigger>
                  <SelectContent>
                    {subtypes.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="O que você esperava? O que aconteceu? Em qual tela?"
                maxLength={4000}
              />
              <p className="text-xs text-muted-foreground text-right">{description.length}/4000</p>
            </div>

            <div className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Gravação de tela (opcional)</p>
                  <p className="text-xs text-muted-foreground">
                    Ao iniciar, esta janela será ocultada para você gravar a tela livremente. Limite de 2 minutos.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {includeMic ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                  <Switch
                    checked={includeMic}
                    onCheckedChange={setIncludeMic}
                    disabled={recording}
                    aria-label="Incluir microfone"
                  />
                  <span className="text-xs">Microfone</span>
                </div>
              </div>

              {recorder.status === "idle" && (
                <Button type="button" variant="secondary" onClick={handleStartRecording}>
                  <Video className="h-4 w-4 mr-2" /> Iniciar gravação
                </Button>
              )}

              {recorder.status === "stopped" && recorder.previewUrl && (
                <div className="space-y-2">
                  <video src={recorder.previewUrl} controls className="w-full rounded border bg-black" />
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={recorder.reset}>
                      <X className="h-4 w-4 mr-2" /> Descartar e regravar
                    </Button>
                  </div>
                </div>
              )}

              {recorder.status === "error" && recorder.error && (
                <p className="text-sm text-destructive">{recorder.error}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => handleClose(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enviar chamado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floating control while recording — dialog is hidden so the page is visible/recordable */}
      {open && minimized && recording && (
        <div className="fixed bottom-5 right-5 z-[100] flex items-center gap-3 rounded-full bg-background border shadow-lg px-4 py-2">
          <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm tabular-nums font-medium">{fmtTime(recorder.elapsedMs)}</span>
          <span className="text-xs text-muted-foreground">/ {fmtTime(recorder.maxDurationMs)}</span>
          <Button type="button" size="sm" variant="destructive" onClick={recorder.stop}>
            <Square className="h-3.5 w-3.5 mr-1" /> Parar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setMinimized(false)}
            aria-label="Mostrar formulário"
            title="Mostrar formulário"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </>
  );
}
