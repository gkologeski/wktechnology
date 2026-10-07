import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, FileUp, Link2, Loader2, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  CHOICE_TYPES,
  FIELD_LIBRARY,
  type FieldType,
  type FormSchema,
} from "@/lib/surveys/form-schema";
import { createFormTemplate } from "@/lib/surveys/form-builder.functions";

type Result = {
  schema: FormSchema;
  warnings: string[];
  requiredUnknown: number;
  sourceKind: string;
  sourceName: string;
};
const ACCEPT =
  ".pdf,.docx,.png,.jpg,.jpeg,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg,image/webp";

async function runImport(
  body: object,
  signal: AbortSignal,
  onStage: (s: string) => void,
): Promise<Result> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Entre novamente.");
  const res = await fetch("/api/surveys/import", {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body)
    throw new Error((await res.text().catch(() => "")).slice(0, 200) || `Falha (${res.status}).`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      const msg = JSON.parse(line) as {
        type: string;
        stage?: string;
        result?: Result;
        message?: string;
      };
      if (msg.type === "progress" && msg.stage) onStage(msg.stage);
      if (msg.type === "result" && msg.result) return msg.result;
      if (msg.type === "error") throw new Error(msg.message || "Falha na importação");
    }
    if (done) break;
  }
  throw new Error("A importação terminou sem resultado. Tente novamente.");
}

const toBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    r.readAsDataURL(file);
  });

export function ImportSurveyDialog({
  open,
  onOpenChange,
  onAppend,
  currentTitle,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Presente no construtor: permite adicionar à pesquisa atual após revisão. */
  onAppend?: (schema: FormSchema) => void;
  currentTitle?: string;
}) {
  const navigate = useNavigate();
  const createFn = useServerFn(createFormTemplate);
  const [mode, setMode] = useState<"url" | "file">("file");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [creating, setCreating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const reset = () => {
    setStage(null);
    setError(null);
    setResult(null);
    setFile(null);
    setUrl("");
  };
  const close = (v: boolean) => {
    if (!v) {
      abortRef.current?.abort();
      reset();
    }
    onOpenChange(v);
  };

  const start = async () => {
    setError(null);
    setResult(null);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      let body: object;
      if (mode === "url") body = { kind: "url", url: url.trim() };
      else {
        if (!file) throw new Error("Selecione um arquivo.");
        if (file.size > 10 * 1024 * 1024) throw new Error("Arquivo acima de 10 MB.");
        setStage("Enviando arquivo");
        body = { kind: "file", filename: file.name, base64: await toBase64(file) };
      }
      setStage("Iniciando");
      setResult(await runImport(body, ac.signal, setStage));
    } catch (e) {
      setError(ac.signal.aborted ? "Importação cancelada." : (e as Error).message);
    } finally {
      setStage(null);
    }
  };

  const setField = (i: number, p: Partial<FormSchema["fields"][number]>) =>
    result &&
    setResult({
      ...result,
      schema: {
        ...result.schema,
        fields: result.schema.fields.map((f, j) => (j === i ? { ...f, ...p } : f)),
      },
    });

  const create = async () => {
    if (!result) return;
    setCreating(true);
    try {
      const { id } = await createFn({ data: { schema: result.schema } });
      toast.success("Pesquisa criada como rascunho. Nada foi publicado ou enviado.");
      close(false);
      void navigate({ to: "/survey-builder/$id", params: { id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90dvh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar pesquisa com IA</DialogTitle>
          <DialogDescription>
            Lê perguntas de uma página ou arquivo e cria um rascunho para revisão. Nada é publicado
            nem enviado. Limites: arquivo até 10 MB (PDF, DOCX, PNG, JPG, WebP); página HTML pública
            até 2 MB, sem login. Formulários dinâmicos podem não ser lidos.
          </DialogDescription>
        </DialogHeader>
        {!result && (
          <div className="space-y-4">
            <Tabs value={mode} onValueChange={(v) => setMode(v as "url" | "file")}>
              <TabsList>
                <TabsTrigger value="file">
                  <FileUp className="mr-1 size-4" />
                  Arquivo
                </TabsTrigger>
                <TabsTrigger value="url">
                  <Link2 className="mr-1 size-4" />
                  URL
                </TabsTrigger>
              </TabsList>
              <TabsContent value="file" className="pt-3">
                <Label htmlFor="imp-file">Arquivo da pesquisa</Label>
                <Input
                  id="imp-file"
                  type="file"
                  accept={ACCEPT}
                  className="mt-1.5"
                  disabled={!!stage}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </TabsContent>
              <TabsContent value="url" className="pt-3">
                <Label htmlFor="imp-url">Endereço da página</Label>
                <Input
                  id="imp-url"
                  type="url"
                  placeholder="https://"
                  className="mt-1.5"
                  disabled={!!stage}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  A página só é lida; nenhuma resposta é enviada ao site.
                </p>
              </TabsContent>
            </Tabs>
            {stage && (
              <p className="flex items-center gap-2 text-sm" aria-live="polite">
                <Loader2 className="size-4 animate-spin" />
                {stage}…
              </p>
            )}
            {error && (
              <p
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive"
              >
                {error}
              </p>
            )}
          </div>
        )}
        {result && (
          <div className="space-y-3" data-import-review>
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <Label htmlFor="imp-title">Título</Label>
                <Input
                  id="imp-title"
                  className="mt-1"
                  value={result.schema.title}
                  onChange={(e) =>
                    setResult({ ...result, schema: { ...result.schema, title: e.target.value } })
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Origem: {result.sourceName} · {result.schema.fields.length} itens · pontuação
                desligada
              </p>
            </div>
            {(result.warnings.length > 0 || result.requiredUnknown > 0) && (
              <div className="rounded-md border border-warning/40 bg-warning/10 p-2 text-xs">
                <p className="flex items-center gap-1 font-medium">
                  <AlertTriangle className="size-3.5" />
                  Revise antes de criar
                </p>
                {result.requiredUnknown > 0 && (
                  <p>
                    {result.requiredUnknown} pergunta(s) sem indicação de obrigatoriedade na origem
                    ficaram opcionais.
                  </p>
                )}
                {result.warnings.map((w) => (
                  <p key={w}>{w}</p>
                ))}
              </div>
            )}
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Trecho de origem</span>
              <span>Pergunta proposta</span>
            </div>
            {result.schema.fields.map((f, i) => (
              <div
                key={f.id}
                className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 rounded-md border border-border-subtle p-2"
              >
                <div className="text-xs text-muted-foreground">
                  {f.source?.page ? (
                    <span className="mr-1 font-medium">p. {f.source.page}</span>
                  ) : null}
                  {f.source?.excerpt ?? "—"}
                  {f.source?.confidence === "baixa" && (
                    <p className="mt-1 flex items-center gap-1 text-warning">
                      <AlertTriangle className="size-3" />
                      Baixa confiança
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <div className="flex gap-1">
                    <Input
                      aria-label={`Enunciado ${i + 1}`}
                      value={f.label}
                      className="h-8"
                      onChange={(e) => setField(i, { label: e.target.value })}
                    />
                    <Select
                      value={f.type}
                      onValueChange={(v) =>
                        setField(i, {
                          type: v as FieldType,
                          options: CHOICE_TYPES.includes(v as FieldType)
                            ? f.options?.length
                              ? f.options
                              : [{ id: crypto.randomUUID(), label: "Opção 1" }]
                            : f.options,
                        })
                      }
                    >
                      <SelectTrigger aria-label={`Tipo ${i + 1}`} className="h-8 w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_LIBRARY.map((t) => (
                          <SelectItem key={t.type} value={t.type}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`Remover item ${i + 1}`}
                      onClick={() =>
                        setResult({
                          ...result,
                          schema: {
                            ...result.schema,
                            fields: result.schema.fields.filter((_, j) => j !== i),
                          },
                        })
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  {(CHOICE_TYPES.includes(f.type) || f.type === "matrix") && (
                    <Input
                      aria-label={`Opções ${i + 1} separadas por ;`}
                      className="h-8 text-xs"
                      value={(f.options ?? []).map((o) => o.label).join("; ")}
                      onChange={(e) =>
                        setField(i, {
                          options: e.target.value
                            .split(";")
                            .map((l, k) => ({
                              id: f.options?.[k]?.id ?? crypto.randomUUID(),
                              label: l.trim(),
                              points: f.options?.[k]?.points ?? null,
                            }))
                            .filter((o) => o.label),
                        })
                      }
                    />
                  )}
                  <label className="flex items-center gap-2 text-xs">
                    <Switch
                      checked={!!f.required}
                      onCheckedChange={(required) => setField(i, { required })}
                      aria-label={`Obrigatória ${i + 1}`}
                    />{" "}
                    Obrigatória
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
        <DialogFooter className="gap-2">
          {!result && stage && (
            <Button variant="outline" onClick={() => abortRef.current?.abort()}>
              Cancelar importação
            </Button>
          )}
          {!result && !stage && (
            <Button
              onClick={() => void start()}
              disabled={mode === "url" ? url.trim().length < 8 : !file}
            >
              {error ? "Tentar novamente" : "Ler pesquisa"}
            </Button>
          )}
          {result && (
            <>
              <Button variant="ghost" onClick={reset}>
                Descartar
              </Button>
              {onAppend && (
                <Button
                  variant="outline"
                  disabled={!result.schema.fields.length}
                  onClick={() => {
                    onAppend(result.schema);
                    close(false);
                  }}
                >
                  Adicionar ao fim de “{currentTitle}”
                </Button>
              )}
              <Button
                disabled={creating || !result.schema.fields.length || !result.schema.title.trim()}
                onClick={() => void create()}
              >
                {creating && <Loader2 className="animate-spin" />} Criar como nova pesquisa
                (rascunho)
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
