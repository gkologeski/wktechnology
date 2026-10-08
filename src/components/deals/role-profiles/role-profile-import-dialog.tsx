import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileUp, Link2, Loader2, MessageSquare, Sparkles, Type } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listRoleProfileConversations } from "@/lib/role-profiles/role-profiles.functions";
import type { ImportedProfile } from "@/lib/role-profiles/import";
import { isKnownBlockingUrl, parseSiteBlocked } from "@/lib/surveys/import/site-block";

export type ImportResult = ImportedProfile & {
  importId: string;
  sourceName: string;
  sourceKind: string;
  reused?: boolean;
};

type Body =
  | { kind: "text"; text: string }
  | { kind: "url"; url: string }
  | { kind: "file"; filename: string; base64: string }
  | { kind: "conversation"; activityIds: string[] };

async function runImport(
  dealId: string,
  body: Body,
  onStage: (s: string) => void,
  signal: AbortSignal,
): Promise<ImportResult> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Entre novamente.");
  const res = await fetch("/api/role-profiles/import", {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ dealId, ...body }),
  });
  if (!res.ok || !res.body)
    throw new Error(res.status === 400 ? "Conteúdo inválido." : `Falha (${res.status}).`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const l of lines) {
      if (!l.trim()) continue;
      const m = JSON.parse(l) as {
        type: string;
        stage?: string;
        message?: string;
        result?: ImportResult;
      };
      if (m.type === "progress" && m.stage) onStage(m.stage);
      if (m.type === "error") throw new Error(m.message);
      if (m.type === "result" && m.result) return m.result;
    }
  }
  throw new Error("A importação terminou sem resultado.");
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    r.readAsDataURL(file);
  });
}

const STATUS_LABEL = { found: "Encontrado", doubtful: "Duvidoso", missing: "Ausente" } as const;

export function RoleProfileImportDialog({
  open,
  onOpenChange,
  dealId,
  onReview,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  dealId: string;
  onReview: (r: ImportResult) => void;
}) {
  const [tab, setTab] = useState("text");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [blocked, setBlocked] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [stage, setStage] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const listConv = useServerFn(listRoleProfileConversations);
  const conv = useQuery({
    queryKey: ["role-profile-conversations", dealId],
    queryFn: () => listConv({ data: { dealId } }),
    enabled: open && tab === "conversation",
  });

  async function start() {
    let body: Body;
    try {
      if (tab === "text") body = { kind: "text", text };
      else if (tab === "url") body = { kind: "url", url };
      else if (tab === "file") {
        if (!file) throw new Error("Escolha um arquivo.");
        if (file.size > 10 * 1024 * 1024) throw new Error("Arquivo acima de 10 MB.");
        body = { kind: "file", filename: file.name, base64: await toBase64(file) };
      } else body = { kind: "conversation", activityIds: selected };
    } catch (e) {
      return toast.error((e as Error).message);
    }
    const ac = new AbortController();
    abortRef.current = ac;
    setStage("Enviando");
    setResult(null);
    try {
      setResult(await runImport(dealId, body, setStage, ac.signal));
    } catch (e) {
      if (!ac.signal.aborted) {
        const p = parseSiteBlocked((e as Error).message);
        if (p.blocked) setBlocked(p.text);
        toast.error(p.text);
      }
    } finally {
      setStage(null);
    }
  }

  const close = (o: boolean) => {
    if (!o) {
      abortRef.current?.abort();
      setResult(null);
    }
    onOpenChange(o);
  };

  const counts = result
    ? Object.values(result.fieldStatus).reduce(
        (a, s) => ({ ...a, [s]: (a[s] ?? 0) + 1 }),
        {} as Record<string, number>,
      )
    : {};

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden /> Importar perfil com IA
          </DialogTitle>
          <DialogDescription>
            A IA propõe; você revisa no formulário antes de salvar. Nada é publicado nem enviado.
            Valores não escritos na fonte ficam em branco.
          </DialogDescription>
        </DialogHeader>
        {!result ? (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="flex-wrap">
              <TabsTrigger value="text">
                <Type className="mr-1 h-3.5 w-3.5" aria-hidden />
                Texto
              </TabsTrigger>
              <TabsTrigger value="url">
                <Link2 className="mr-1 h-3.5 w-3.5" aria-hidden />
                URL
              </TabsTrigger>
              <TabsTrigger value="file">
                <FileUp className="mr-1 h-3.5 w-3.5" aria-hidden />
                Arquivo
              </TabsTrigger>
              <TabsTrigger value="conversation">
                <MessageSquare className="mr-1 h-3.5 w-3.5" aria-hidden />
                Conversas
              </TabsTrigger>
            </TabsList>
            <TabsContent value="text" className="mt-3">
              <Label htmlFor="rpi-text" className="sr-only">
                Descrição da vaga
              </Label>
              <Textarea
                id="rpi-text"
                rows={8}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Cole aqui a descrição da vaga ou o e-mail do cliente…"
              />
            </TabsContent>
            <TabsContent value="url" className="mt-3 space-y-1">
              <Label htmlFor="rpi-url">Endereço público da página</Label>
              <Input
                id="rpi-url"
                type="url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setBlocked(null);
                }}
                placeholder="https://…"
              />
              <p className="text-[11px] text-text-tertiary">
                Somente páginas públicas http/https; endereços internos são bloqueados.
              </p>
              {(blocked || isKnownBlockingUrl(url)) && (
                <div
                  role="status"
                  aria-live="polite"
                  className="mt-2 space-y-2 rounded-md border border-border bg-muted p-2 text-xs text-foreground"
                >
                  <p>
                    {blocked ??
                      "Este site costuma bloquear leitura automática. Prefira colar o texto da vaga ou enviar um PDF ou print."}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setText((t) => (t.trim() ? t : `Fonte: ${url}\n\n`));
                      setBlocked(null);
                      setTab("text");
                    }}
                  >
                    Colar texto em vez disso
                  </Button>
                </div>
              )}
            </TabsContent>
            <TabsContent value="file" className="mt-3 space-y-1">
              <Label htmlFor="rpi-file">PDF, DOCX, PNG, JPG ou WebP (até 10 MB)</Label>
              <Input
                id="rpi-file"
                type="file"
                accept=".pdf,.docx,.png,.jpg,.jpeg,.webp"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-[11px] text-text-tertiary">
                O arquivo fica guardado em área privada para auditoria.
              </p>
            </TabsContent>
            <TabsContent value="conversation" className="mt-3">
              <p className="mb-2 text-xs text-text-secondary">
                Somente conversas deste negócio. Marque as que devem ser lidas.
              </p>
              {conv.isLoading ? (
                <p className="py-4 text-xs text-text-tertiary">
                  <Loader2 className="mr-1 inline h-3 w-3 animate-spin" aria-hidden />
                  Carregando…
                </p>
              ) : conv.isError ? (
                <div className="py-3 text-xs text-destructive">
                  Erro ao carregar.{" "}
                  <Button variant="link" size="sm" onClick={() => conv.refetch()}>
                    Tentar de novo
                  </Button>
                </div>
              ) : (conv.data ?? []).length === 0 ? (
                <p className="py-4 text-xs text-text-tertiary">
                  Este negócio não tem conversas registradas.
                </p>
              ) : (
                <ul className="max-h-60 space-y-1 overflow-y-auto">
                  {(conv.data ?? []).map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted"
                    >
                      <Checkbox
                        id={`rpi-${a.id}`}
                        checked={selected.includes(a.id)}
                        onCheckedChange={(v) =>
                          setSelected((s) => (v ? [...s, a.id] : s.filter((x) => x !== a.id)))
                        }
                      />
                      <Label
                        htmlFor={`rpi-${a.id}`}
                        className="flex-1 truncate text-sm font-normal"
                      >
                        {a.subject || "(sem assunto)"}
                      </Label>
                      <Badge variant="outline" className="text-[10px]">
                        {a.type}
                      </Badge>
                      <span className="text-[11px] tabular-nums text-text-tertiary">
                        {a.created_at.slice(0, 10)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-3" aria-live="polite">
            <div className="rounded-lg border border-border-subtle p-3">
              <p className="text-sm font-semibold text-text-primary">{result.header.title}</p>
              <p className="text-xs text-text-secondary">
                Fonte: {result.sourceName}
                {result.reused ? " · leitura reaproveitada" : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {(["found", "doubtful", "missing"] as const).map((s) => (
                  <Badge key={s} variant="outline">
                    {STATUS_LABEL[s]}: {counts[s] ?? 0}
                  </Badge>
                ))}
              </div>
            </div>
            {result.warnings.length ? (
              <ul className="list-disc space-y-1 pl-5 text-xs text-text-secondary">
                {result.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : null}
            <p className="text-xs text-text-tertiary">
              Ao continuar, o formulário abre preenchido. O rascunho só é criado quando você salvar.
            </p>
          </div>
        )}
        <DialogFooter>
          {stage ? (
            <span
              role="status"
              className="mr-auto inline-flex items-center gap-2 text-xs text-text-secondary"
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              {stage}…
            </span>
          ) : null}
          {stage ? (
            <Button variant="ghost" onClick={() => abortRef.current?.abort()}>
              Cancelar
            </Button>
          ) : result ? (
            <>
              <Button variant="ghost" onClick={() => setResult(null)}>
                Ler outra fonte
              </Button>
              <Button
                onClick={() => {
                  onReview(result);
                  close(false);
                }}
              >
                Revisar no formulário
              </Button>
            </>
          ) : (
            <Button
              onClick={start}
              disabled={
                (tab === "text" && text.trim().length < 20) ||
                (tab === "url" && url.length < 8) ||
                (tab === "file" && !file) ||
                (tab === "conversation" && !selected.length)
              }
            >
              Ler com IA
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
