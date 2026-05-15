import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Download, Eye, Loader2 } from "lucide-react";
import { previewHubspotLeads, importHubspotLeads } from "@/lib/hubspot.functions";

export const Route = createFileRoute("/_authenticated/leads/import-hubspot")({
  component: ImportHubspotPage,
});

type PreviewRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company_name: string;
  source: string;
};

function ImportHubspotPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const previewFn = useServerFn(previewHubspotLeads);
  const importFn = useServerFn(importHubspotLeads);

  const [maxRecords, setMaxRecords] = useState(200);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importing, setImporting] = useState(false);

  const doPreview = async () => {
    setLoadingPreview(true);
    try {
      const res = await previewFn({ data: { limit: 10 } });
      setPreview(res.contacts);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao carregar preview");
    } finally {
      setLoadingPreview(false);
    }
  };

  const doImport = async () => {
    if (!confirm(`Importar até ${maxRecords} contatos do HubSpot como Leads?`)) return;
    setImporting(true);
    try {
      const res = await importFn({ data: { maxRecords } });
      toast.success(`${res.imported} leads importados${res.skipped ? ` (${res.skipped} ignorados)` : ""}`);
      qc.invalidateQueries({ queryKey: ["leads"] });
      navigate({ to: "/leads" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na importação");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Importar leads do HubSpot"
        description="Traga contatos da sua conta HubSpot conectada como novos leads."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/leads"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link>
          </Button>
        }
      />

      <div className="rounded-lg border bg-card p-6 space-y-6 max-w-3xl">
        <div className="space-y-2">
          <h2 className="font-semibold">Conexão</h2>
          <p className="text-sm text-muted-foreground">
            Esta importação usa a conexão HubSpot configurada no projeto. Cada contato vira um Lead com status "Novo" e fonte "hubspot".
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="max">Quantidade máxima de registros</Label>
          <Input
            id="max"
            type="number"
            min={1}
            max={1000}
            value={maxRecords}
            onChange={(e) => setMaxRecords(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))}
            className="max-w-xs"
          />
          <p className="text-xs text-muted-foreground">Entre 1 e 1000.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={doPreview} disabled={loadingPreview}>
            {loadingPreview ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Eye className="h-4 w-4 mr-1" />}
            Pré-visualizar 10
          </Button>
          <Button onClick={doImport} disabled={importing}>
            {importing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
            Importar agora
          </Button>
        </div>

        {preview && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Pré-visualização ({preview.length})</h3>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Telefone</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Nenhum contato encontrado.</TableCell></TableRow>
                  ) : preview.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{`${c.first_name} ${c.last_name}`.trim() || "—"}</TableCell>
                      <TableCell>{c.email || "—"}</TableCell>
                      <TableCell>{c.company_name || "—"}</TableCell>
                      <TableCell>{c.phone || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
