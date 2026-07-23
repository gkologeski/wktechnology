// Página para importar prestadores da planilha pública de respostas do
// Google Form (cadastro de PJ). Chama importPeopleFromPublicSheet em loop
// até done=true, agregando os totais.
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, AlertCircle, CheckCircle2, Info } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  importPeopleFromPublicSheet,
  reimportBrokenAttachments,
  type ImportBatchResult,
  type ReimportResult,
} from "@/lib/people/import-forms.functions";

const DEFAULT_URL =
  "https://docs.google.com/spreadsheets/d/1J9Tqg7JOehajxk3tfWPodCSK1wI58Iijk2vFcksaiFE/edit";

export const Route = createFileRoute("/_authenticated/people/import-forms")({
  head: () => ({
    meta: [
      { title: "Importar do Google Forms · TechPeople" },
      {
        name: "description",
        content:
          "Importe prestadores da planilha pública de respostas de um Google Form, com anexos vinculados a cada pessoa.",
      },
    ],
  }),
  component: ImportFormsPage,
});

type Totals = {
  created: number;
  updated_fields: number;
  unchanged: number;
  attachments_ok: number;
  attachments_failed: number;
  failures: { cpf: string; name: string; reason: string }[];
};

const zero: Totals = {
  created: 0,
  updated_fields: 0,
  unchanged: 0,
  attachments_ok: 0,
  attachments_failed: 0,
  failures: [],
};

function ImportFormsPage() {
  const runImport = useServerFn(importPeopleFromPublicSheet);
  const [sheetUrl, setSheetUrl] = useState(DEFAULT_URL);
  const [running, setRunning] = useState<null | "dry" | "exec">(null);
  const [totalUnique, setTotalUnique] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [totals, setTotals] = useState<Totals>(zero);
  const [dryResult, setDryResult] = useState<ImportBatchResult | null>(null);

  async function simulate() {
    setRunning("dry");
    setDryResult(null);
    try {
      const r = await runImport({ data: { sheet_url: sheetUrl, dry_run: true } });
      setDryResult(r);
      setTotalUnique(r.total_unique);
      toast.success(`Planilha OK — ${r.total_unique} pessoas únicas encontradas`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na simulação");
    } finally {
      setRunning(null);
    }
  }

  async function execute() {
    if (!window.confirm("Executar a importação? Pode levar alguns minutos.")) return;
    setRunning("exec");
    setTotals(zero);
    setProcessed(0);
    setTotalUnique(0);
    try {
      let offset = 0;
      let done = false;
      const agg: Totals = { ...zero, failures: [] };
      while (!done) {
        const r = await runImport({
          data: { sheet_url: sheetUrl, dry_run: false, offset, batch_size: 8 },
        });
        setTotalUnique(r.total_unique);
        agg.created += r.batch.created;
        agg.updated_fields += r.batch.updated_fields;
        agg.unchanged += r.batch.unchanged;
        agg.attachments_ok += r.batch.attachments_ok;
        agg.attachments_failed += r.batch.attachments_failed;
        agg.failures.push(...r.batch.failures);
        setTotals({ ...agg });
        setProcessed(r.next_offset);
        offset = r.next_offset;
        done = r.done;
      }
      toast.success(
        `Importação concluída — ${agg.created} criadas, ${agg.updated_fields} atualizadas, ${agg.attachments_ok} anexos.`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na importação");
    } finally {
      setRunning(null);
    }
  }

  const pct = totalUnique > 0 ? Math.round((processed / totalUnique) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Importar prestadores do Google Forms"
        description="Extraia respostas de um formulário público e cadastre as pessoas no TechPeople, com anexos vinculados."
      />

      <Card>
        <CardHeader>
          <CardTitle>Fonte dos dados</CardTitle>
          <CardDescription>
            Cole a URL do Google Sheets vinculado às respostas. A planilha e a pasta de anexos
            devem estar como "Qualquer pessoa com o link — Leitor".
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sheet-url">URL da planilha</Label>
            <Input
              id="sheet-url"
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              disabled={running !== null}
              placeholder="https://docs.google.com/spreadsheets/d/..."
            />
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Como funciona a deduplicação</AlertTitle>
            <AlertDescription>
              A chave é o <strong>CPF</strong>. Se a pessoa já existir, os campos preenchidos no
              sistema são preservados — só completamos campos vazios. Reexecutar é seguro.
            </AlertDescription>
          </Alert>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={simulate}
              disabled={running !== null || !sheetUrl}
            >
              {running === "dry" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Simular
            </Button>
            <Button onClick={execute} disabled={running !== null || !sheetUrl}>
              {running === "exec" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Executar importação
            </Button>
          </div>
        </CardContent>
      </Card>

      {dryResult && running !== "exec" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Simulação</CardTitle>
            <CardDescription>
              Prévia das pessoas únicas encontradas na planilha. Nada foi gravado.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Pessoas únicas" value={dryResult.total_unique} />
              <Stat
                label="Anexos totais na planilha"
                value={dryResult.batch.attachments_failed}
              />
            </div>

            {dryResult.people && dryResult.people.length > 0 && (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[96px]">Documento</TableHead>
                      <TableHead>Nome completo</TableHead>
                      <TableHead className="w-[180px]">Celular</TableHead>
                      <TableHead className="w-[160px]">CPF</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dryResult.people.map((p) => (
                      <TableRow key={p.cpf_formatted}>
                        <TableCell>
                          {p.id_doc_drive_id ? (
                            <a
                              href={`https://drive.google.com/file/d/${p.id_doc_drive_id}/view`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <img
                                src={`https://drive.google.com/thumbnail?id=${p.id_doc_drive_id}&sz=w200`}
                                alt={`Documento de ${p.full_name}`}
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                className="h-16 w-16 rounded border object-cover bg-muted"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.display = "none";
                                }}
                              />
                            </a>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{p.full_name}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {p.phone ?? <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{p.cpf_formatted}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}


      {(running === "exec" || processed > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Progresso</CardTitle>
            <CardDescription>
              {processed} de {totalUnique} pessoas processadas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={pct} />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <Stat label="Criadas" value={totals.created} tone="success" />
              <Stat label="Atualizadas" value={totals.updated_fields} tone="info" />
              <Stat label="Sem alteração" value={totals.unchanged} />
              <Stat label="Anexos OK" value={totals.attachments_ok} tone="success" />
              <Stat
                label="Anexos falhos"
                value={totals.attachments_failed}
                tone={totals.attachments_failed > 0 ? "warn" : "muted"}
              />
            </div>

            {totals.failures.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  Falhas ({totals.failures.length})
                </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>CPF</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {totals.failures.slice(0, 50).map((f, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">{f.cpf}</TableCell>
                          <TableCell>{f.name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{f.reason}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {running === null && processed > 0 && processed >= totalUnique && (
              <Alert>
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <AlertTitle>Importação concluída</AlertTitle>
                <AlertDescription>
                  Acesse a lista de pessoas para conferir os registros.{" "}
                  <Badge variant="secondary">tag: form-import</Badge>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "warn" | "info" | "muted";
}) {
  const toneClass =
    tone === "success"
      ? "text-primary"
      : tone === "warn"
        ? "text-destructive"
        : tone === "info"
          ? "text-blue-600 dark:text-blue-400"
          : tone === "muted"
            ? "text-muted-foreground"
            : "";
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}
