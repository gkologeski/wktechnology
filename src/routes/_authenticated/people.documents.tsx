// /people/documents — visão global de documentos a vencer/vencidos.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileCheck2, Download, AlertTriangle } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  listExpiringDocuments,
  getDocumentDownloadUrl,
  type ExpiringDocumentRow,
} from "@/lib/people/documents.functions";
import { Checkbox } from "@/components/ui/checkbox";
import { useGridSelection } from "@/components/grid/use-grid-selection";
import { GridBulkBar } from "@/components/grid/grid-bulk-bar";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/people/documents")({
  head: () => ({
    meta: [
      { title: "Documentos a vencer · TechPeople" },
      {
        name: "description",
        content: "Documentos de pessoas com validade próxima ou vencida.",
      },
    ],
  }),
  component: DocumentsPage,
});

type Filter = "all" | "expired" | "expiring";

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function DocumentsPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const listFn = useServerFn(listExpiringDocuments);
  const downloadFn = useServerFn(getDocumentDownloadUrl);

  const { data = [], isLoading } = useQuery({
    queryKey: ["people-docs-expiring", filter],
    queryFn: () => listFn({ data: { status: filter, limit: 200 } }),
    staleTime: 30_000,
  });

  // Seleção múltipla / ações em massa (padrão de grids).
  const qc = useQueryClient();
  const { canAny } = usePermissions();
  const selection = useGridSelection(data as ExpiringDocumentRow[]);
  const selectAllFiltered = () => selection.setSelectedIds(new Set(data.map((d) => d.id)));

  async function handleDownload(id: string) {
    try {
      const { url } = await downloadFn({ data: { id } });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar link");
    }
  }

  return (
    <div className="container max-w-6xl mx-auto p-6 space-y-4">
      <PageHeader
        title="Documentos a vencer"
        description="Monitore certidões, contratos e documentos com validade nos próximos 60 dias."
      />

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="expiring">A vencer</TabsTrigger>
          <TabsTrigger value="expired">Vencidos</TabsTrigger>
        </TabsList>
      </Tabs>

      {selection.hasSelection && (
        <GridBulkBar
          table="people_documents"
          ids={selection.ids}
          rows={selection.selectedRows}
          entityLabel="documento(s)"
          onClear={selection.clear}
          onDone={() => void qc.invalidateQueries({ queryKey: ["people-docs-expiring"] })}
          totalMatching={data.length}
          onSelectAll={selectAllFiltered}
          canUpdate={canAny([
            "techpeople.documents.update.workspace",
            "techpeople.documents.update.team",
            "techpeople.documents.update.own",
          ])}
          canDelete={canAny([
            "techpeople.documents.delete.workspace",
            "techpeople.documents.delete.own",
          ])}
        />
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-sm text-muted-foreground text-center">Carregando…</div>
          ) : data.length === 0 ? (
            <div className="p-10 text-sm text-muted-foreground text-center">
              <FileCheck2 className="h-8 w-8 mx-auto mb-2 opacity-60" />
              Nenhum documento nessa condição.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      aria-label="Selecionar todos os documentos exibidos"
                      checked={
                        selection.allOnPageSelected
                          ? true
                          : selection.someOnPageSelected
                            ? "indeterminate"
                            : false
                      }
                      onCheckedChange={selection.toggleAllOnPage}
                    />
                  </TableHead>
                  <TableHead>Pessoa</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((d: ExpiringDocumentRow) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <Checkbox
                        aria-label={`Selecionar documento ${d.doc_type}`}
                        checked={selection.selectedIds.has(d.id)}
                        onCheckedChange={() => selection.toggleOne(d.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <Link
                        to="/people/$id"
                        params={{ id: d.person_id }}
                        className="flex items-center gap-2 hover:underline"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={d.person_photo_url ?? undefined} />
                          <AvatarFallback>{initials(d.person_name)}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{d.person_name}</span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{d.doc_type}</div>
                      <div className="text-xs text-muted-foreground">{d.doc_number ?? "—"}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {d.expires_at}
                      {d.days_left != null ? (
                        <span className="text-xs text-muted-foreground ml-2">
                          {d.days_left < 0
                            ? `${Math.abs(d.days_left)}d atrás`
                            : `em ${d.days_left}d`}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          d.status === "expired"
                            ? "bg-rose-500/10 text-rose-700"
                            : d.status === "expiring"
                              ? "bg-amber-500/10 text-amber-700"
                              : ""
                        }
                      >
                        {d.status === "expired" ? (
                          <>
                            <AlertTriangle className="h-3 w-3 mr-1" /> Vencido
                          </>
                        ) : d.status === "expiring" ? (
                          "A vencer"
                        ) : (
                          "Válido"
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {d.file_url ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownload(d.id)}
                          title="Baixar"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
