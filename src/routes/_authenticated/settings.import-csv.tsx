import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, ArrowRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  DEDUPE_KEYS,
  ENTITY_FIELDS,
  executeCsvImport,
  previewCsvImport,
  type CsvEntity,
  type DedupeStrategy,
} from "@/lib/csv-import.functions";

export const Route = createFileRoute("/_authenticated/settings/import-csv")({
  component: ImportCsvPage,
});

type CsvRow = Record<string, string | null>;
type Preview = Awaited<ReturnType<typeof previewCsvImport>>;
type ResultType = Awaited<ReturnType<typeof executeCsvImport>>;

function ImportCsvPage() {
  const previewFn = useServerFn(previewCsvImport);
  const executeFn = useServerFn(executeCsvImport);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [entity, setEntity] = useState<CsvEntity>("contacts");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [dedupeKey, setDedupeKey] = useState<string>("email");
  const [strategy, setStrategy] = useState<DedupeStrategy>("skip");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<ResultType | null>(null);
  const [loading, setLoading] = useState<"preview" | "execute" | null>(null);

  const fields = ENTITY_FIELDS[entity];
  const dedupeOptions = DEDUPE_KEYS[entity];

  const mappedTargets = useMemo(() => new Set(Object.values(mapping)), [mapping]);

  function reset() {
    setHeaders([]); setRows([]); setMapping({}); setPreview(null); setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function changeEntity(e: CsvEntity) {
    setEntity(e);
    setMapping({});
    setDedupeKey(DEDUPE_KEYS[e][0]);
    setPreview(null);
    setResult(null);
  }

  function handleFile(file: File) {
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        const hdrs = (res.meta.fields ?? []).map((h) => h.trim()).filter(Boolean);
        const data = (res.data as CsvRow[]).slice(0, 5000);
        setHeaders(hdrs);
        setRows(data);
        // auto-map por igualdade de nome
        const auto: Record<string, string> = {};
        const taken = new Set<string>();
        for (const h of hdrs) {
          const low = h.toLowerCase().replace(/[\s-]+/g, "_");
          const match = fields.find((f) => f.key === low || f.label.toLowerCase() === h.toLowerCase());
          if (match && !taken.has(match.key)) { auto[h] = match.key; taken.add(match.key); }
        }
        setMapping(auto);
        setPreview(null);
        setResult(null);
        toast.success(`${data.length} linhas carregadas`);
      },
      error: (err) => toast.error(`Erro ao ler CSV: ${err.message}`),
    });
  }

  async function runPreview() {
    if (rows.length === 0) return toast.error("Carregue um CSV primeiro");
    const required = fields.filter((f) => f.required).map((f) => f.key);
    const missing = required.filter((k) => !Object.values(mapping).includes(k));
    if (missing.length > 0) return toast.error(`Mapeie os campos obrigatórios: ${missing.join(", ")}`);
    if (!Object.values(mapping).includes(dedupeKey)) {
      return toast.error(`Mapeie uma coluna para o campo de dedupe: ${dedupeKey}`);
    }
    setLoading("preview");
    try {
      const p = await previewFn({ data: { entity, rows, mapping, dedupeKey } });
      setPreview(p);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao analisar");
    } finally { setLoading(null); }
  }

  async function runExecute() {
    if (!preview) return;
    setLoading("execute");
    try {
      const r = await executeFn({ data: { entity, rows, mapping, dedupeKey, strategy } });
      setResult(r);
      toast.success(`Importação concluída: ${r.inserted} criados, ${r.updated} atualizados, ${r.skipped} ignorados`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao importar");
    } finally { setLoading(null); }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold">Importar CSV</h1>
        <p className="text-sm text-muted-foreground">Importe leads, contatos ou empresas com mapeamento de colunas e deduplicação automática.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Entidade e arquivo</CardTitle>
          <CardDescription>Escolha o tipo de registro e selecione o arquivo CSV.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Entidade</Label>
              <Select value={entity} onValueChange={(v) => changeEntity(v as CsvEntity)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="leads">Leads</SelectItem>
                  <SelectItem value="contacts">Contatos</SelectItem>
                  <SelectItem value="companies">Empresas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Arquivo CSV</Label>
              <Input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>
          </div>
          {headers.length > 0 && (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Upload className="h-4 w-4" /> {rows.length} linhas · {headers.length} colunas detectadas
              <Button variant="ghost" size="sm" onClick={reset}>Limpar</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {headers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>2. Mapeamento de colunas</CardTitle>
            <CardDescription>Associe cada coluna do CSV a um campo do CRM. Deixe em branco para ignorar.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {headers.map((h) => (
                <div key={h} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <div className="text-sm font-mono truncate" title={h}>{h}</div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <Select
                    value={mapping[h] ?? "__none__"}
                    onValueChange={(v) => {
                      setMapping((prev) => {
                        const next = { ...prev };
                        if (v === "__none__") delete next[h];
                        else {
                          // remove qualquer outro CSV mapeado para esse mesmo campo
                          for (const k of Object.keys(next)) if (next[k] === v) delete next[k];
                          next[h] = v;
                        }
                        return next;
                      });
                      setPreview(null);
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="— ignorar —" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— ignorar —</SelectItem>
                      {fields.map((f) => (
                        <SelectItem key={f.key} value={f.key} disabled={mappedTargets.has(f.key) && mapping[h] !== f.key}>
                          {f.label}{f.required ? " *" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {headers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>3. Deduplicação</CardTitle>
            <CardDescription>Defina como tratar registros já existentes no workspace.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Chave de dedupe</Label>
                <Select value={dedupeKey} onValueChange={(v) => { setDedupeKey(v); setPreview(null); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {dedupeOptions.map((k) => (
                      <SelectItem key={k} value={k}>{k}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Estratégia quando duplicado</Label>
                <Select value={strategy} onValueChange={(v) => setStrategy(v as DedupeStrategy)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip">Ignorar duplicados</SelectItem>
                    <SelectItem value="update">Atualizar registros existentes</SelectItem>
                    <SelectItem value="create_new">Criar mesmo assim</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={runPreview} disabled={loading !== null} variant="outline">
                {loading === "preview" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Analisar
              </Button>
              {preview && (
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="secondary">Total: {preview.totalRows}</Badge>
                  <Badge variant="default">Novos: {preview.newRecords}</Badge>
                  <Badge variant="outline">Duplicados: {preview.duplicates}</Badge>
                  {preview.invalidRows > 0 && <Badge variant="destructive">Inválidos: {preview.invalidRows}</Badge>}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle>4. Executar</CardTitle>
            <CardDescription>
              {strategy === "skip" && `Serão criados ${preview.newRecords} registros. ${preview.duplicates} duplicados serão ignorados.`}
              {strategy === "update" && `Serão criados ${preview.newRecords} e atualizados ${preview.duplicates} registros existentes.`}
              {strategy === "create_new" && `Serão criados ${preview.newRecords + preview.duplicates} registros (incluindo duplicados).`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={runExecute} disabled={loading !== null || preview.newRecords + (strategy === "update" ? preview.duplicates : 0) === 0}>
              {loading === "execute" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Importar agora
            </Button>
            {result && (
              <div className="mt-4 flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                {result.inserted} criados · {result.updated} atualizados · {result.skipped} ignorados · {result.invalid} inválidos
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
