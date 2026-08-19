import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { Check, ChevronsUpDown, ImagePlus, Loader2, Maximize2, Mic, MicOff, Square, Video, X } from "lucide-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { RichHtmlEditor, htmlToPlain } from "@/components/rich-html-editor";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { BUG_CATEGORIES, BUG_KINDS } from "@/lib/bug-report-taxonomy";
import { useScreenRecorder } from "./use-screen-recorder";


export type BugReportQaContext = {
  testCaseId: string;
  testCaseTitle: string;
  /** Optional pre-filled HTML description (will replace empty description on open). */
  prefillDescriptionHtml?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  qaContext?: BugReportQaContext | null;
  onSubmitted?: (info: { bugReportId: string | null; qaContext?: BugReportQaContext | null }) => void;
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

type ComboOption = { value: string; label: string };

function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  emptyLabel,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: ComboOption[];
  placeholder: string;
  emptyLabel: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !current && "text-muted-foreground",
          )}
        >
          <span className="truncate">{current?.label ?? placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[--radix-popover-trigger-width]"
        align="start"
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >

        <Command
          filter={(itemValue, search) => {
            const opt = options.find((o) => o.value === itemValue);
            const hay = `${opt?.label ?? itemValue}`.toLowerCase();
            return hay.includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Buscar..." />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.value}
                  onSelect={(v) => {
                    onChange(v);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === o.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}


export function BugReportDialog({ open, onOpenChange, qaContext, onSubmitted }: Props) {
  const { user } = useAuth();
  const [kind, setKind] = useState<"new_feature" | "existing_broken">("existing_broken");
  const [category, setCategory] = useState<string>("");
  const [subtype, setSubtype] = useState<string>("");
  const [description, setDescription] = useState("");
  const [includeMic, setIncludeMic] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [images, setImages] = useState<{ file: File; url: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const recorder = useScreenRecorder();

  const subtypes = useMemo(
    () => BUG_CATEGORIES.find((c) => c.value === category)?.subtypes ?? [],
    [category],
  );

  const clearImages = () => {
    images.forEach((i) => URL.revokeObjectURL(i.url));
    setImages([]);
  };

  const resetAll = () => {
    setKind("existing_broken");
    setCategory("");
    setSubtype("");
    setDescription(qaContext?.prefillDescriptionHtml ?? "");
    setIncludeMic(true);
    setMinimized(false);
    clearImages();
    recorder.reset();
  };

  // When opening with a QA context, prefill the description once
  useEffect(() => {
    if (open && qaContext?.prefillDescriptionHtml) {
      setDescription(qaContext.prefillDescriptionHtml);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, qaContext?.testCaseId]);

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
    const parsed = schema.safeParse({ kind, category, subtype, description: htmlToPlain(description) });
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

      const imagePaths: string[] = [];
      for (const img of images) {
        const ext =
          (img.file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") ||
          "png";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("bug-reports").upload(path, img.file, {
          contentType: img.file.type || `image/${ext}`,
          upsert: false,
        });
        if (upErr) throw upErr;
        imagePaths.push(path);
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("active_workspace_id")
        .eq("id", user.id)
        .maybeSingle();
      const workspaceId =
        (profile as { active_workspace_id: string | null } | null)?.active_workspace_id ?? null;
      if (!workspaceId) {
        throw new Error("Nenhum workspace ativo. Selecione um workspace e tente novamente.");
      }

      const { data: inserted, error: insErr } = await supabase
        .from("bug_reports")
        .insert({
          owner_id: user.id,
          workspace_id: workspaceId,
          kind: parsed.data.kind,
          category: parsed.data.category,
          subtype: parsed.data.subtype,
          description: description,
          recording_path: recordingPath,
          recording_has_audio: hasAudio,
          image_paths: imagePaths,
          page_url: typeof window !== "undefined" ? window.location.href : null,
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
          qa_test_case_id: qaContext?.testCaseId ?? null,
          qa_test_case_title: qaContext?.testCaseTitle ?? null,
        })
        .select("id")
        .maybeSingle();
      if (insErr) throw insErr;

      toast.success("Chamado enviado. Obrigado pelo feedback!");
      onSubmitted?.({ bugReportId: inserted?.id ?? null, qaContext });
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
        <DialogContent className="max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Abrir chamado</DialogTitle>
            <DialogDescription>
              Descreva o problema ou sugira uma melhoria. Você pode anexar imagens e/ou uma gravação
              de tela.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {qaContext && (
              <div className="rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-900 p-3 text-sm">
                <div className="font-medium text-amber-900 dark:text-amber-200">
                  Vinculando ao caso de teste {qaContext.testCaseId}
                </div>
                <div className="text-amber-800/90 dark:text-amber-200/80 line-clamp-2">
                  {qaContext.testCaseTitle}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BUG_KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <SearchableSelect
                  value={category}
                  onChange={(v) => {
                    setCategory(v);
                    setSubtype("");
                  }}
                  options={BUG_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
                  placeholder="Selecione"
                  emptyLabel="Nenhuma categoria encontrada"
                />
              </div>
              <div className="space-y-2">
                <Label>Subtipo</Label>
                <SearchableSelect
                  value={subtype}
                  onChange={setSubtype}
                  options={subtypes.map((s) => ({ value: s.value, label: s.label }))}
                  placeholder={category ? "Selecione" : "Escolha a categoria"}
                  emptyLabel="Nenhum subtipo encontrado"
                  disabled={!category}
                />
              </div>
            </div>


            <div className="space-y-2">
              <Label>Descrição</Label>
              <RichHtmlEditor
                value={description}
                onChange={setDescription}
                minHeight={160}
                placeholder="O que você esperava? O que aconteceu? Em qual tela?"
              />
              <p className="text-xs text-muted-foreground text-right">{htmlToPlain(description).length}/4000</p>
            </div>

            <div className="rounded-lg border p-3 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Imagens (opcional)</p>
                  <p className="text-xs text-muted-foreground">
                    Anexe uma ou mais capturas de tela. Máx. 10 MB por imagem.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={submitting}
                >
                  <ImagePlus className="h-4 w-4 mr-2" /> Adicionar imagens
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    const valid: { file: File; url: string }[] = [];
                    for (const f of files) {
                      if (!f.type.startsWith("image/")) continue;
                      if (f.size > 10 * 1024 * 1024) {
                        toast.error(`${f.name}: imagem maior que 10 MB`);
                        continue;
                      }
                      valid.push({ file: f, url: URL.createObjectURL(f) });
                    }
                    setImages((prev) => [...prev, ...valid]);
                    e.target.value = "";
                  }}
                />
              </div>
              {images.length > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {images.map((img, idx) => (
                    <div key={img.url} className="relative group">
                      <img
                        src={img.url}
                        alt={`Anexo ${idx + 1}`}
                        className="h-24 w-full rounded border object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          URL.revokeObjectURL(img.url);
                          setImages((prev) => prev.filter((_, i) => i !== idx));
                        }}
                        className="absolute top-1 right-1 rounded-full bg-background/90 border p-0.5 shadow opacity-0 group-hover:opacity-100 transition"
                        aria-label="Remover imagem"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Gravação de tela (opcional)</p>
                  <p className="text-xs text-muted-foreground">
                    Ao iniciar, esta janela será ocultada para você gravar a tela livremente. Limite
                    de 2 minutos.
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
                  <video
                    src={recorder.previewUrl}
                    controls
                    className="w-full rounded border bg-black"
                  />
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
