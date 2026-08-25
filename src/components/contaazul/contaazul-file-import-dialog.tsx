import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FILE_FIELD_LABELS,
  REQUIRED_FILE_FIELDS,
  type FileField,
  fileRowToEntry,
  parseDelimited,
  suggestMapping,
} from "@/lib/integrations/contaazul-map";
import { contaAzulImportFileEntries } from "@/lib/integrations/contaazul.functions";

const NONE = "__none__";

type Parsed = { headers: string[]; rows: string[][]; fileName: string };

/**
 * Fallback de importação por arquivo (CSV/planilha exportada do Conta Azul).
 * O parse e o mapeamento acontecem no cliente; o servidor recebe apenas
 * lançamentos já normalizados e valida novamente antes de gravar.
 */
export function ContaAzulFileImportDialog({ disabled }: { disabled?: boolean }) {
  const qc = useQueryClient();
  const importEntries = useServerFn(contaAzulImportFileEntries);

  const [open, setOpen] = useState(false);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [direction, setDirection] = useState<"receivable" | "payable">("receivable");
  const [mapping, setMapping] = useState<Partial<Record<FileField, number>>>({});
  const [busy, setBusy] = useState(false);

  const fields = Object.keys(FILE_FIELD_LABELS) as FileField[];

  const preview = useMemo(() => {
    if (!parsed) return { ok: 0, failed: 0, errors: [] as string[] };
    let ok = 0;
    const errors: string[] = [];
    parsed.rows.forEach((cells, i) => {
      const res = fileRowToEntry(cells, mapping, direction, i + 2);
      if (res.ok) ok += 1;
      else if (errors.length < 5) errors.push(`Linha ${res.line}: ${res.errors.join(", ")}`);
    });
    return { ok, failed: parsed.rows.length - ok, errors };
  }, [parsed, mapping, direction]);

  const missingRequired = REQUIRED_FILE_FIELDS.filter((f) => mapping[f] === undefined);

  async function handleFile(file: File) {
    const text = await file.text();
    const { headers, rows } = parseDelimited(text);
    if (!headers.length || !rows.length) {
      toast.error("Arquivo vazio ou sem cabeçalho reconhecível.");
      return;
    }
    setParsed({ headers, rows, fileName: file.name });
    setMapping(suggestMapping(headers));
  }

  async function handleImport() {
    if (!parsed) return;
    const entries = parsed.rows
      .map((cells, i) => fileRowToEntry(cells, mapping, direction, i + 2))
      .filter((r): r is Extract<typeof r, { ok: true }> => r.ok)
      .map((r) => r.entry);
    if (!entries.length) {
      toast.error("Nenhuma linha válida para importar.");
      return;
    }
    setBusy(true);
    try {
      const result = await importEntries({ data: { direction, entries } });
      toast.success(
        `Importação concluída: ${result.imported} criados, ${result.updated} atualizados, ${result.failed} com erro.`,
      );
      await qc.invalidateQueries({ queryKey: ["contaazul"] });
      setOpen(false);
      setParsed(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha na importação do arquivo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setParsed(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          <Upload className="mr-2 h-4 w-4" />
          Importar por arquivo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar lançamentos por arquivo</DialogTitle>
          <DialogDescription>
            Use a exportação de contas a pagar/receber do Conta Azul (CSV separado por ponto e
            vírgula). O mapeamento de colunas é sugerido automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ca-file">Arquivo (CSV)</Label>
              <Input
                id="ca-file"
                type="file"
                accept=".csv,.txt,text/csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ca-direction">Tipo de lançamento</Label>
              <Select
                value={direction}
                onValueChange={(v) => setDirection(v as "receivable" | "payable")}
              >
                <SelectTrigger id="ca-direction">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receivable">Contas a receber</SelectItem>
                  <SelectItem value="payable">Contas a pagar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {parsed ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="secondary">{parsed.fileName}</Badge>
                <span>{parsed.rows.length} linhas</span>
                <Badge variant="outline">{preview.ok} válidas</Badge>
                {preview.failed > 0 ? (
                  <Badge variant="destructive">{preview.failed} com erro</Badge>
                ) : null}
              </div>

              <div className="max-h-64 space-y-3 overflow-y-auto rounded-md border p-3">
                {fields.map((field) => (
                  <div key={field} className="grid items-center gap-2 sm:grid-cols-2">
                    <Label htmlFor={`map-${field}`} className="text-sm">
                      {FILE_FIELD_LABELS[field]}
                      {REQUIRED_FILE_FIELDS.includes(field) ? (
                        <span className="ml-1 text-destructive">*</span>
                      ) : null}
                    </Label>
                    <Select
                      value={mapping[field] === undefined ? NONE : String(mapping[field])}
                      onValueChange={(v) =>
                        setMapping((prev) => {
                          const next = { ...prev };
                          if (v === NONE) delete next[field];
                          else next[field] = Number(v);
                          return next;
                        })
                      }
                    >
                      <SelectTrigger id={`map-${field}`}>
                        <SelectValue placeholder="Não importar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Não importar</SelectItem>
                        {parsed.headers.map((h, i) => (
                          <SelectItem key={`${h}-${i}`} value={String(i)}>
                            {h || `Coluna ${i + 1}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {preview.errors.length ? (
                <ul className="space-y-1 text-xs text-destructive">
                  {preview.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Selecione um arquivo para configurar o mapeamento das colunas.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button
            onClick={() => void handleImport()}
            disabled={busy || !parsed || preview.ok === 0 || missingRequired.length > 0}
          >
            {busy ? "Importando..." : `Importar ${preview.ok} lançamentos`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
