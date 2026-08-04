// Visualizador do arquivo local escolhido na importação de contrato.
// Funciona antes do contrato existir no banco: usa um blob: URL do próprio File.
// PDF renderiza inline; .docx não é renderizável no navegador, então oferece
// download e, quando disponível, o texto já extraído.
// À direita, exibe o progresso da extração por IA e os dados extraídos, com
// atalhos para extrair e para salvar o contrato.
import { useEffect, useState } from "react";
import {
  Download,
  FileText,
  Loader2,
  RotateCcw,
  Save,
  Sparkles,
  AlertTriangle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ExtractedContract } from "@/lib/contracts/import-schemas";
import {
  IDLE_PROGRESS,
  isExtracting,
  type ExtractionProgress,
} from "@/components/contracts/import-progress";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  file: File | null;
  /** Texto já extraído (usado como preview quando o formato não renderiza). */
  text?: string | null;
  /** Progresso compartilhado da extração (fase, percentual e mensagem). */
  progress?: ExtractionProgress;
  /** Campos extraídos pela IA, quando disponíveis. */
  extracted?: ExtractedContract | null;
  /** Dispara a extração por IA do arquivo atual. */
  onExtract?: () => void;
  /** Salva o contrato importado com os dados extraídos. */
  onSave?: () => void;
  saving?: boolean;
};

function isPdf(name: string) {
  return /\.pdf$/i.test(name);
}

const ROLE_LABEL: Record<string, string> = {
  provider: "Prestação (somos contratada)",
  client: "Compra (somos contratante)",
};

function money(v: number | null | undefined, currency?: string | null) {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: currency || "BRL",
    }).format(v);
  } catch {
    return String(v);
  }
}

function date(v: string | null | undefined) {
  if (!v) return null;
  const d = new Date(`${v}T00:00:00`);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString("pt-BR");
}

function summaryRows(f: ExtractedContract): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string | null }> = [
    { label: "Título", value: f.title ?? null },
    { label: "Nosso papel", value: f.role ? (ROLE_LABEL[f.role] ?? f.role) : null },
    { label: "Contraparte", value: f.counterparty_name ?? null },
    { label: "CNPJ da contraparte", value: f.counterparty_cnpj ?? null },
    { label: "Início", value: date(f.starts_at) },
    { label: "Fim", value: date(f.ends_at) },
    {
      label: "Renovação automática",
      value: typeof f.auto_renew === "boolean" ? (f.auto_renew ? "Sim" : "Não") : null,
    },
    {
      label: "Aviso prévio",
      value: typeof f.notice_days === "number" ? `${f.notice_days} dias` : null,
    },
    { label: "Valor mensal", value: money(f.monthly_value, f.currency) },
    { label: "Valor total", value: money(f.total_value, f.currency) },
    {
      label: "Horas mensais",
      value: typeof f.hours_per_month === "number" ? String(f.hours_per_month) : null,
    },
    {
      label: "Dia do pagamento",
      value: typeof f.payment_day === "number" ? String(f.payment_day) : null,
    },
    { label: "Método de pagamento", value: f.payment_method?.toUpperCase() ?? null },
    { label: "Índice de reajuste", value: f.readjustment_index ?? null },
    { label: "Periodicidade do reajuste", value: f.readjustment_period ?? null },
    {
      label: "Multa compensatória",
      value: typeof f.penalty_percent === "number" ? `${f.penalty_percent}%` : null,
    },
    { label: "Tipo de serviço", value: f.service_type ?? null },
    { label: "Local de execução", value: f.service_location ?? null },
    { label: "Escopo", value: f.service_scope ?? null },
    { label: "Lei aplicável", value: f.governing_law ?? null },
    { label: "Foro", value: f.jurisdiction ?? null },
    { label: "Provedor de assinatura", value: f.signature_provider ?? null },
  ];
  return rows.filter((r): r is { label: string; value: string } => Boolean(r.value));
}

export function LocalContractFileViewerDialog({
  open,
  onOpenChange,
  file,
  text,
  progress = IDLE_PROGRESS,
  extracted = null,
  onExtract,
  onSave,
  saving = false,
}: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open || !file) {
      setUrl(null);
      setError(null);
      setLoading(false);
      return;
    }
    let objectUrl: string | null = null;
    setLoading(true);
    setError(null);
    try {
      objectUrl = URL.createObjectURL(file);
      setUrl(objectUrl);
    } catch {
      setError("Não foi possível abrir o arquivo selecionado.");
    } finally {
      setLoading(false);
    }
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, file, attempt]);

  const name = file?.name ?? "Contrato";
  const pdf = file ? isPdf(name) : false;
  const running = isExtracting(progress);
  const rows = extracted ? summaryRows(extracted) : [];
  const confidence = typeof extracted?.confidence === "number" ? extracted.confidence : null;
  const warnings = Array.isArray(extracted?.warnings) ? extracted.warnings : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[85vh] flex flex-col gap-3">
        <DialogHeader className="pr-10">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate">{name}</span>
          </DialogTitle>
          <DialogDescription>
            Visualização do arquivo enviado. Fechar não altera os dados extraídos.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          {url ? (
            <Button asChild variant="outline" size="sm">
              <a href={url} download={name}>
                <Download className="h-4 w-4 mr-1" /> Baixar arquivo
              </a>
            </Button>
          ) : null}
          {error ? (
            <Button variant="outline" size="sm" onClick={() => setAttempt((a) => a + 1)}>
              <RotateCcw className="h-4 w-4 mr-1" /> Tentar novamente
            </Button>
          ) : null}
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-3 overflow-hidden">
          <div className="min-h-48 lg:min-h-0 rounded-md border bg-muted/20 overflow-hidden">
            {loading ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Carregando arquivo…
              </div>
            ) : error ? (
              <div className="h-full flex items-center justify-center p-6 text-center text-sm text-destructive">
                {error}
              </div>
            ) : !file || !url ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Nenhum arquivo selecionado.
              </div>
            ) : pdf ? (
              <iframe src={url} title={name} className="h-full w-full border-0" />
            ) : text ? (
              <pre className="h-full w-full overflow-auto whitespace-pre-wrap p-4 text-xs leading-relaxed">
                {text}
              </pre>
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-2 p-6 text-center">
                <FileText className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Arquivos .docx não são exibidos pelo navegador. Baixe o arquivo para conferir o
                  conteúdo original.
                </p>
              </div>
            )}
          </div>

          <aside className="min-h-0 rounded-md border bg-card flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b p-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Dados extraídos
              </h3>
              {confidence !== null ? (
                <Badge variant="outline">Confiança: {(confidence * 100).toFixed(0)}%</Badge>
              ) : null}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
              {running || progress.phase === "error" ? (
                <div className="space-y-2" aria-live="polite">
                  <Progress value={progress.percent} />
                  <p className="text-xs font-medium">{progress.message}</p>
                  {progress.detail ? (
                    <p className="text-xs text-destructive">{progress.detail}</p>
                  ) : null}
                </div>
              ) : null}

              {warnings.length > 0 ? (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2.5 text-xs text-amber-800 dark:text-amber-300">
                  <div className="flex items-center gap-2 font-medium mb-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> Avisos da extração
                  </div>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {rows.length > 0 ? (
                <dl className="space-y-2">
                  {rows.map((r) => (
                    <div key={r.label} className="space-y-0.5">
                      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {r.label}
                      </dt>
                      <dd className="text-sm break-words">{r.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : !running && progress.phase !== "error" ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                  <Sparkles className="h-7 w-7 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum dado extraído ainda. Rode a extração por IA para preencher os campos do
                    contrato.
                  </p>
                </div>
              ) : null}
            </div>

            {onExtract || onSave ? (
              <>
                <Separator />
                <div className="flex flex-wrap items-center gap-2 p-3">
                  {onExtract ? (
                    <Button
                      size="sm"
                      variant={rows.length > 0 ? "outline" : "default"}
                      onClick={onExtract}
                      disabled={!file || running || saving}
                    >
                      {running ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Extraindo…
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-1" />
                          {rows.length > 0 ? "Extrair novamente" : "Extrair com IA"}
                        </>
                      )}
                    </Button>
                  ) : null}
                  {onSave ? (
                    <Button
                      size="sm"
                      onClick={onSave}
                      disabled={rows.length === 0 || running || saving}
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Salvando…
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-1" /> Salvar contrato
                        </>
                      )}
                    </Button>
                  ) : null}
                </div>
              </>
            ) : null}
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
