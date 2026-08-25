// Wizard de importação de contrato a partir de .docx
// Passo 1: upload do arquivo .docx → extração via mammoth (browser)
// Passo 2: detecção de placeholders + edição/criação de campos variáveis
// Passo 3: metadados (título, valor, validade) e criação
import { useCallback, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  FileText,
  Wand2,
  Plus,
  Trash2,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { createProposal } from "@/lib/proposals.functions";

type VarType = "text" | "number" | "date" | "currency";

type FieldDef = {
  key: string; // placeholder key (slug) — ex.: "contratante"
  label: string; // label amigável
  type: VarType;
  defaultValue: string;
  required: boolean;
};

// Reconhece {{x}}, {x}, [X], <<x>>
const PLACEHOLDER_RE =
  /\{\{\s*([a-zA-Z0-9_\-.]+)\s*\}\}|\{\s*([a-zA-Z0-9_\-.]+)\s*\}|\[\s*([A-Z0-9_\-. ]{2,40})\s*\]|<<\s*([a-zA-Z0-9_\-.]+)\s*>>/g;

// Palavras-chave PT-BR que viram sugestões mesmo sem placeholder explícito
const KEYWORD_HINTS: Array<{ key: string; label: string; type: VarType; rx: RegExp }> = [
  { key: "contratante", label: "Contratante", type: "text", rx: /\bcontratante\b/i },
  { key: "contratada", label: "Contratada", type: "text", rx: /\bcontratad[ao]\b/i },
  {
    key: "cnpj_contratante",
    label: "CNPJ contratante",
    type: "text",
    rx: /\bcnpj\b.{0,40}contratante/i,
  },
  {
    key: "cnpj_contratada",
    label: "CNPJ contratada",
    type: "text",
    rx: /\bcnpj\b.{0,40}contratad/i,
  },
  { key: "objeto", label: "Objeto do contrato", type: "text", rx: /\bobjeto\b/i },
  { key: "valor", label: "Valor", type: "currency", rx: /\bvalor\b/i },
  { key: "prazo", label: "Prazo", type: "text", rx: /\bprazo\b/i },
  { key: "vigencia", label: "Vigência", type: "date", rx: /\bvig[êe]ncia\b/i },
  { key: "data_inicio", label: "Data de início", type: "date", rx: /\bdata\s+de\s+in[ií]cio\b/i },
  {
    key: "data_assinatura",
    label: "Data de assinatura",
    type: "date",
    rx: /\bdata\s+da?\s+assinatura\b/i,
  },
  { key: "foro", label: "Foro", type: "text", rx: /\bforo\b/i },
];

const TYPE_LABEL: Record<VarType, string> = {
  text: "Texto",
  number: "Número",
  date: "Data",
  currency: "Moeda",
};

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

function detectFields(text: string): FieldDef[] {
  const found = new Map<string, FieldDef>();
  // 1) placeholders explícitos
  for (const m of text.matchAll(PLACEHOLDER_RE)) {
    const raw = (m[1] ?? m[2] ?? m[3] ?? m[4] ?? "").trim();
    if (!raw) continue;
    const key = slugify(raw);
    if (!key || found.has(key)) continue;
    const label = raw
      .replace(/[_\-.]+/g, " ")
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());
    found.set(key, { key, label, type: "text", defaultValue: "", required: true });
  }
  // 2) sugestões por palavras-chave
  for (const h of KEYWORD_HINTS) {
    if (found.has(h.key)) continue;
    if (h.rx.test(text)) {
      found.set(h.key, {
        key: h.key,
        label: h.label,
        type: h.type,
        defaultValue: "",
        required: false,
      });
    }
  }
  return [...found.values()];
}

// Reescreve qualquer placeholder reconhecido para o formato canônico {{key}}.
// Mantém o restante do texto intacto.
function normalizePlaceholders(text: string, fields: FieldDef[]): string {
  let out = text;
  const known = new Set(fields.map((f) => f.key));
  out = out.replace(PLACEHOLDER_RE, (full, a, b, c, d) => {
    const raw = (a ?? b ?? c ?? d ?? "").trim();
    const key = slugify(raw);
    if (known.has(key)) return `{{${key}}}`;
    return full;
  });
  return out;
}

// Extrai o alinhamento de cada <w:p> do document.xml original e aplica
// como `style="text-align: …"` nos blocos correspondentes do HTML gerado
// pelo mammoth. Mantém a ordem dos parágrafos (mammoth gera um bloco por
// w:p, incluindo itens de lista).
async function applyParagraphAlignment(buf: ArrayBuffer, html: string): Promise<string> {
  try {
    const { unzipSync, strFromU8 } = await import("fflate");
    const files = unzipSync(new Uint8Array(buf), {
      filter: (f) => f.name === "word/document.xml",
    });
    const xmlBytes = files["word/document.xml"];
    if (!xmlBytes) return html;
    const xml = strFromU8(xmlBytes);
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const paragraphs = Array.from(doc.getElementsByTagNameNS("*", "p"));
    const alignments: Array<string | null> = paragraphs.map((p) => {
      const jc = p.getElementsByTagNameNS("*", "jc")[0];
      const val = jc?.getAttribute("w:val") ?? jc?.getAttribute("val") ?? null;
      if (!val) return null;
      if (val === "both" || val === "distribute") return "justify";
      if (val === "left" || val === "start") return "left";
      if (val === "right" || val === "end") return "right";
      if (val === "center") return "center";
      return null;
    });
    const container = document.createElement("div");
    container.innerHTML = html;
    const blocks: HTMLElement[] = [];
    const walk = (el: Element) => {
      for (const child of Array.from(el.children)) {
        const tag = child.tagName.toLowerCase();
        if (["p", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "li", "pre"].includes(tag)) {
          blocks.push(child as HTMLElement);
          if (tag === "li") walk(child); // listas aninhadas
        } else if (["ul", "ol", "table", "thead", "tbody", "tr", "td", "th"].includes(tag)) {
          walk(child);
        }
      }
    };
    walk(container);
    const n = Math.min(blocks.length, alignments.length);
    for (let i = 0; i < n; i++) {
      const align = alignments[i];
      if (!align || align === "left") continue;
      const existing = blocks[i].getAttribute("style") ?? "";
      blocks[i].setAttribute(
        "style",
        `${existing}${existing && !existing.trim().endsWith(";") ? ";" : ""}text-align:${align};`,
      );
    }
    return container.innerHTML;
  } catch {
    return html;
  }
}

export function ImportContractWizard() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fileName, setFileName] = useState("");
  const [rawText, setRawText] = useState("");
  const [rawHtml, setRawHtml] = useState("");
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [title, setTitle] = useState("");
  const [currency, setCurrency] = useState("BRL");
  const [amount, setAmount] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [parsing, setParsing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const qc = useQueryClient();
  const navigate = useNavigate();
  const create = useServerFn(createProposal);

  const reset = useCallback(() => {
    setStep(1);
    setFileName("");
    setRawText("");
    setRawHtml("");
    setFields([]);
    setTitle("");
    setAmount("");
    setExpiresAt("");
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith(".docx")) {
        toast.error("Envie um arquivo .docx");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Arquivo muito grande (máx. 10MB)");
        return;
      }
      setParsing(true);
      try {
        const mammoth = await import("mammoth/mammoth.browser");
        const buf = await file.arrayBuffer();
        // Style map para preservar mais formatação (cabeçalhos, alinhamento,
        // citações, código) e converter imagens em data URIs para que
        // sobrevivam à serialização do HTML no editor WYSIWYG.
        const styleMap = [
          "p[style-name='Title'] => h1.doc-title:fresh",
          "p[style-name='Subtitle'] => h2.doc-subtitle:fresh",
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh",
          "p[style-name='Heading 4'] => h4:fresh",
          "p[style-name='Heading 5'] => h5:fresh",
          "p[style-name='Heading 6'] => h6:fresh",
          "p[style-name='Quote'] => blockquote:fresh",
          "p[style-name='Intense Quote'] => blockquote.intense:fresh",
          "r[style-name='Strong'] => strong",
          "r[style-name='Emphasis'] => em",
          "r[style-name='Code'] => code",
          "p[style-name='Code'] => pre:fresh",
          "p[style-name='List Paragraph'] => p.list-paragraph:fresh",
        ];
        const convertImage = mammoth.images.imgElement(async (image) => {
          const base64 = await image.read("base64");
          return { src: `data:${image.contentType};base64,${base64}` };
        });
        const [{ value: html }, { value: text }] = await Promise.all([
          mammoth.convertToHtml(
            { arrayBuffer: buf },
            {
              styleMap,
              includeDefaultStyleMap: true,
              includeEmbeddedStyleMap: true,
              convertImage,
              ignoreEmptyParagraphs: false,
            },
          ),
          mammoth.extractRawText({ arrayBuffer: buf }),
        ]);
        // Pós-processamento: extrai alinhamento de parágrafo do document.xml
        // original e aplica como style="text-align: …" nos elementos
        // correspondentes (mammoth não preserva alinhamento por padrão).
        const enriched = await applyParagraphAlignment(buf, html);
        setRawHtml(enriched);
        setRawText(text);
        setFileName(file.name);
        const detected = detectFields(text);
        setFields(detected);
        if (!title) setTitle(file.name.replace(/\.docx$/i, ""));
        setStep(2);
      } catch (e) {
        toast.error("Falha ao ler o arquivo: " + (e as Error).message);
      } finally {
        setParsing(false);
      }
    },
    [title],
  );

  const addField = () => {
    setFields((prev) => [
      ...prev,
      {
        key: `campo_${prev.length + 1}`,
        label: `Campo ${prev.length + 1}`,
        type: "text",
        defaultValue: "",
        required: false,
      },
    ]);
  };

  const updateField = (idx: number, patch: Partial<FieldDef>) => {
    setFields((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  const removeField = (idx: number) => {
    setFields((prev) => prev.filter((_, i) => i !== idx));
  };

  const normalizedBody = useMemo(
    () => normalizePlaceholders(rawHtml || rawText, fields),
    [rawHtml, rawText, fields],
  );

  const variables = useMemo(() => {
    const out: Record<string, { label: string; type: VarType; value: string; required: boolean }> =
      {};
    for (const f of fields) {
      if (!f.key) continue;
      out[f.key] = { label: f.label, type: f.type, value: f.defaultValue, required: f.required };
    }
    return out;
  }, [fields]);

  const createM = useMutation({
    mutationFn: () =>
      create({
        data: {
          title,
          body: normalizedBody,
          currency,
          totalAmount: amount ? Number(amount) : null,
          expiresAt: expiresAt || null,
          variables,
        },
      }),
    onSuccess: (prop) => {
      toast.success("Contrato criado a partir do .docx");
      qc.invalidateQueries({ queryKey: ["proposals"] });
      setOpen(false);
      reset();
      if (prop?.id) navigate({ to: "/proposals/$id", params: { id: prop.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" /> Importar .docx
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-4 w-4" /> Importar contrato — passo {step} de 3
          </DialogTitle>
        </DialogHeader>

        {/* Stepper visual */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {[
            { n: 1, label: "Upload" },
            { n: 2, label: "Campos variáveis" },
            { n: 3, label: "Revisar e criar" },
          ].map((s, i, arr) => (
            <div key={s.n} className="flex items-center gap-2">
              <div
                className={`grid h-6 w-6 place-items-center rounded-full border text-[11px] font-semibold ${step >= s.n ? "bg-primary text-primary-foreground border-primary" : "bg-muted"}`}
              >
                {step > s.n ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.n}
              </div>
              <span className={step === s.n ? "text-foreground font-medium" : ""}>{s.label}</span>
              {i < arr.length - 1 && <div className="h-px w-8 bg-border" />}
            </div>
          ))}
        </div>

        {/* PASSO 1 */}
        {step === 1 && (
          <div className="space-y-3 py-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-10 text-center hover:bg-muted/30 transition-colors"
            >
              <FileText className="h-10 w-10 text-muted-foreground" />
              <div className="font-medium">Clique para selecionar um arquivo .docx</div>
              <div className="text-xs text-muted-foreground">
                Use placeholders como{" "}
                <code className="px-1 rounded bg-muted">{`{{contratante}}`}</code>,{" "}
                <code className="px-1 rounded bg-muted">[VALOR]</code> ou deixe-nos detectar
                automaticamente
              </div>
              {parsing && <Badge variant="secondary">Lendo arquivo…</Badge>}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".docx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>
        )}

        {/* PASSO 2 */}
        {step === 2 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Campos detectados ({fields.length})
                </Label>
                <Button size="sm" variant="ghost" onClick={addField}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                </Button>
              </div>
              <ScrollArea className="h-[340px] rounded-md border">
                <div className="p-2 space-y-2">
                  {fields.length === 0 && (
                    <p className="text-xs text-muted-foreground p-4 text-center">
                      Nenhum campo detectado. Adicione manualmente.
                    </p>
                  )}
                  {fields.map((f, idx) => (
                    <Card key={idx}>
                      <CardContent className="p-3 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[10px]">Chave</Label>
                            <Input
                              value={f.key}
                              onChange={(e) => updateField(idx, { key: slugify(e.target.value) })}
                              className="h-8 text-xs font-mono"
                            />
                          </div>
                          <div>
                            <Label className="text-[10px]">Rótulo</Label>
                            <Input
                              value={f.label}
                              onChange={(e) => updateField(idx, { label: e.target.value })}
                              className="h-8 text-xs"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                          <div>
                            <Label className="text-[10px]">Tipo</Label>
                            <Select
                              value={f.type}
                              onValueChange={(v: VarType) => updateField(idx, { type: v })}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {(Object.keys(TYPE_LABEL) as VarType[]).map((t) => (
                                  <SelectItem key={t} value={t} className="text-xs">
                                    {TYPE_LABEL[t]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button size="icon" variant="ghost" onClick={() => removeField(idx)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <div>
                          <Label className="text-[10px]">Valor padrão (opcional)</Label>
                          <Input
                            value={f.defaultValue}
                            onChange={(e) => updateField(idx, { defaultValue: e.target.value })}
                            className="h-8 text-xs"
                            placeholder="Ex.: Empresa XYZ Ltda."
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Pré-visualização ({fileName})
              </Label>
              <ScrollArea className="h-[340px] rounded-md border bg-card">
                {rawHtml ? (
                  <div
                    className="prose prose-sm max-w-none p-3 text-xs"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(rawHtml, { ADD_TAGS: ["style"] }),
                    }}
                  />
                ) : (
                  <pre className="p-3 text-xs whitespace-pre-wrap">{rawText}</pre>
                )}
              </ScrollArea>
              <p className="text-[11px] text-muted-foreground">
                Os placeholders reconhecidos serão normalizados para{" "}
                <code className="px-1 rounded bg-muted">{`{{chave}}`}</code> ao salvar.
              </p>
            </div>
          </div>
        )}

        {/* PASSO 3 */}
        {step === 3 && (
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Título</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contrato Acme — Setembro/2026"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Valor</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Moeda</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BRL">BRL</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Validade</Label>
                <Input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>
            </div>

            <Card>
              <CardContent className="p-3 space-y-1 text-xs">
                <div className="font-semibold uppercase tracking-wider text-muted-foreground text-[10px]">
                  Resumo
                </div>
                <div>
                  📄 Arquivo: <span className="font-mono">{fileName}</span>
                </div>
                <div>
                  🔑 Campos variáveis: <strong>{fields.length}</strong>
                  {fields.length > 0 && (
                    <span className="ml-2 inline-flex flex-wrap gap-1">
                      {fields.slice(0, 8).map((f) => (
                        <Badge
                          key={f.key}
                          variant="outline"
                          className="text-[10px]"
                        >{`{{${f.key}}}`}</Badge>
                      ))}
                      {fields.length > 8 && (
                        <Badge variant="outline" className="text-[10px]">
                          +{fields.length - 8}
                        </Badge>
                      )}
                    </span>
                  )}
                </div>
                <div>📝 Tamanho do corpo: {(normalizedBody.length / 1024).toFixed(1)} KB</div>
              </CardContent>
            </Card>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between sm:justify-between gap-2">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))}
            disabled={step === 1}
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          {step < 3 ? (
            <Button
              onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
              disabled={step === 1 ? !rawText : false}
            >
              Avançar <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={() => createM.mutate()} disabled={!title || createM.isPending}>
              {createM.isPending ? "Criando…" : "Criar contrato"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
