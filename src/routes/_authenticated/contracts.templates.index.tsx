import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, FileStack, Plus, Search, Trash2, Upload } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { ImportContractTemplateDialog } from "@/components/contracts/import-contract-template-dialog";
import {
  listContractTemplates,
  createContractTemplate,
  deleteContractTemplate,
  duplicateContractTemplate,
} from "@/lib/contracts/templates.functions";
import { formatDateTime } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/contracts/templates/")({
  head: () => ({
    meta: [
      { title: "Modelos de contrato" },
      {
        name: "description",
        content: "Modelos de contrato com variáveis reutilizáveis no TechContracts e TechSales.",
      },
      { property: "og:title", content: "Modelos de contrato" },
      {
        property: "og:description",
        content: "Crie modelos de contrato com variáveis e gere contratos em segundos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContractTemplatesPage,
});

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  published: "Publicado",
  archived: "Arquivado",
};

const STATUS_TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  archived: "bg-muted text-muted-foreground",
};

const ROLE_LABEL: Record<string, string> = { provider: "Prestação", client: "Compra" };

function ContractTemplatesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const list = useServerFn(listContractTemplates);
  const createFn = useServerFn(createContractTemplate);
  const removeFn = useServerFn(deleteContractTemplate);
  const dupFn = useServerFn(duplicateContractTemplate);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [openImport, setOpenImport] = useState(false);
  const [creating, setCreating] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["contract-templates", { search, status }],
    queryFn: () =>
      list({
        data: {
          search: search || undefined,
          status:
            status === "all" ? undefined : (status as "draft" | "published" | "archived"),
        },
      }),
  });

  async function createBlank() {
    setCreating(true);
    try {
      const row = await createFn({ data: { name: "Novo modelo de contrato" } });
      qc.invalidateQueries({ queryKey: ["contract-templates"] });
      navigate({ to: "/contracts/templates/$id", params: { id: row.id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-5 p-6">
      <PageHeader
        title="Modelos de contrato"
        description="Modelos com variáveis reutilizáveis para gerar contratos rapidamente."
        count={rows.length}
        countLabel={rows.length === 1 ? "modelo" : "modelos"}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setOpenImport(true)}>
              <Upload className="mr-1 h-4 w-4" /> Importar modelo
            </Button>
            <Button onClick={createBlank} disabled={creating}>
              <Plus className="mr-1 h-4 w-4" /> Novo modelo
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-64 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
            aria-label="Buscar modelos"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <FileStack className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="mt-4 text-lg font-medium">Nenhum modelo ainda</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Crie um modelo em branco ou importe um contrato existente para virar modelo.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <Button variant="outline" onClick={() => setOpenImport(true)}>
                <Upload className="mr-1 h-4 w-4" /> Importar modelo
              </Button>
              <Button onClick={createBlank} disabled={creating}>
                <Plus className="mr-1 h-4 w-4" /> Novo modelo
              </Button>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Serviços vinculados</TableHead>
                <TableHead>Atualizado em</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <Link
                      to="/contracts/templates/$id"
                      params={{ id: t.id }}
                      className="font-medium hover:underline"
                    >
                      {t.name}
                    </Link>
                    {t.imported_from ? (
                      <Badge variant="outline" className="ml-2 h-4 px-1.5 py-0 text-[10px]">
                        Importado
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm">{ROLE_LABEL[t.role] ?? t.role}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_TONE[t.status] ?? ""}>
                      {STATUS_LABEL[t.status] ?? t.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {t.services.length === 0
                      ? "—"
                      : t.services.map((s) => s.name).join(", ")}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTime(t.updated_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Duplicar ${t.name}`}
                        onClick={async () => {
                          try {
                            await dupFn({ data: { id: t.id } });
                            toast.success("Modelo duplicado.");
                            qc.invalidateQueries({ queryKey: ["contract-templates"] });
                          } catch (e) {
                            toast.error((e as Error).message);
                          }
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Excluir ${t.name}`}
                        onClick={async () => {
                          const ok = await confirmDialog({
                            title: "Excluir modelo",
                            description: `O modelo "${t.name}" será removido. Contratos já gerados não são afetados.`,
                            confirmLabel: "Excluir",
                            variant: "destructive",
                          });
                          if (!ok) return;
                          try {
                            await removeFn({ data: { id: t.id } });
                            toast.success("Modelo excluído.");
                            qc.invalidateQueries({ queryKey: ["contract-templates"] });
                          } catch (e) {
                            toast.error((e as Error).message);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <ImportContractTemplateDialog
        open={openImport}
        onOpenChange={(next) => {
          setOpenImport(next);
          if (!next) qc.invalidateQueries({ queryKey: ["contract-templates"] });
        }}
      />

    </div>
  );
}
