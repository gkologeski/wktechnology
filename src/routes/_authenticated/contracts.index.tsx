import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Plus, Search, Upload } from "lucide-react";

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
import { listContracts } from "@/lib/contracts.functions";
import { QuickCreateContractDialog } from "@/components/contracts/quick-create-contract-dialog";
import { ImportContractFileDialog } from "@/components/contracts/import-contract-file-dialog";
import { AssigneeFilter, useAssigneeFilter } from "@/components/entity/assignee-filter";
import { AssigneeCell } from "@/components/entity/assignee-cell";
import { formatCurrency, formatDateTime } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/contracts/")({
  head: () => ({
    meta: [
      { title: "Contratos" },
      { name: "description", content: "Gestão do ciclo de vida de contratos." },
    ],
  }),
  component: ContractsPage,
});

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  in_review: "Em revisão",
  in_negotiation: "Em negociação",
  awaiting_signature: "Aguard. assinatura",
  active: "Ativo",
  renewing: "Renovando",
  ended: "Encerrado",
  terminated: "Rescindido",
};

const STATUS_TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  in_review: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  in_negotiation: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  awaiting_signature: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  renewing: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400",
  ended: "bg-muted text-muted-foreground",
  terminated: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
};

const ROLE_LABEL: Record<string, string> = {
  provider: "Prestação",
  client: "Compra",
};

function ContractsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listContracts);
  const { assignee, setAssignee, filterRows } = useAssigneeFilter();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [openNew, setOpenNew] = useState(false);
  const [openImport, setOpenImport] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["contracts", { role, status, search }],
    queryFn: () =>
      list({
        data: {
          role: role === "all" ? undefined : (role as "provider" | "client"),
          status:
            status === "all"
              ? undefined
              : (status as
                  | "draft"
                  | "in_review"
                  | "in_negotiation"
                  | "awaiting_signature"
                  | "active"
                  | "renewing"
                  | "ended"
                  | "terminated"),
          search: search || undefined,
        },
      }),
  });

  const filtered = useMemo(() => filterRows(rows), [rows, filterRows]);

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Contratos"
        description="Ciclo de vida de contratos com clientes e fornecedores."
        count={filtered.length}
        countLabel={filtered.length === 1 ? "contrato" : "contratos"}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setOpenImport(true)}>
              <Upload className="h-4 w-4 mr-1" /> Importar contrato
            </Button>
            <Button onClick={() => setOpenNew(true)}>
              <Plus className="h-4 w-4 mr-1" /> Novo contrato
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título ou número…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="provider">Prestação</SelectItem>
            <SelectItem value="client">Compra</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-52">
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
        <AssigneeFilter value={assignee} onChange={setAssignee} />
      </div>

      <div className="rounded-lg border bg-card">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">Nenhum contrato ainda</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Comece criando um contrato ou gere um a partir de um negócio ganho.
            </p>
            <Button className="mt-4" onClick={() => setOpenNew(true)}>
              <Plus className="h-4 w-4 mr-1" /> Novo contrato
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Vigência</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Criado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id} className="cursor-pointer">
                  <TableCell className="font-mono text-xs">
                    <Link to="/contracts/$id" params={{ id: c.id }} className="hover:underline">
                      {c.number ?? "—"}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Link
                        to="/contracts/$id"
                        params={{ id: c.id }}
                        className="font-medium hover:underline"
                      >
                        {c.title}
                      </Link>
                      {c.imported_from ? (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                          Importado
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{ROLE_LABEL[c.role] ?? c.role}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_TONE[c.status] ?? ""}>
                      {STATUS_LABEL[c.status] ?? c.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(Number(c.total_value), c.currency)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.starts_at ? formatDateTime(c.starts_at).split(" ")[0] : "—"}
                    {c.ends_at ? ` → ${formatDateTime(c.ends_at).split(" ")[0]}` : ""}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTime(c.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <QuickCreateContractDialog
        open={openNew}
        onOpenChange={setOpenNew}
        onCreated={() => qc.invalidateQueries({ queryKey: ["contracts"] })}
      />

      <ImportContractFileDialog
        open={openImport}
        onOpenChange={(next) => {
          setOpenImport(next);
          if (!next) qc.invalidateQueries({ queryKey: ["contracts"] });
        }}
      />
    </div>
  );
}
