import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileStack, FileText, Link2, Plus, Search, Upload } from "lucide-react";

import { PageHeader } from "@/components/page-header";
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
import { listContracts, listContractGroupings } from "@/lib/contracts.functions";
import { QuickCreateContractDialog } from "@/components/contracts/quick-create-contract-dialog";
import { ImportContractFileDialog } from "@/components/contracts/import-contract-file-dialog";
import { BatchImportContractsDialog } from "@/components/contracts/batch-import-contracts-dialog";
import { ApplyContractTemplateDialog } from "@/components/contracts/apply-contract-template-dialog";
import { AssigneeFilter, useAssigneeFilter } from "@/components/entity/assignee-filter";
import {
  ContractsTable,
  ContractsGroupedList,
  type ContractRow,
} from "@/components/contracts/contracts-grouped-list";
import { ContractsBulkBar } from "@/components/contracts/contracts-bulk-bar";
import { useCanDelete } from "@/lib/access-control/use-can-delete";
import { Checkbox } from "@/components/ui/checkbox";


type GroupBy = "none" | "company" | "service" | "job_profile" | "seniority";

const GROUP_BY_VALUES: GroupBy[] = ["none", "company", "service", "job_profile", "seniority"];

export const Route = createFileRoute("/_authenticated/contracts/")({
  validateSearch: (search: Record<string, unknown>) => {
    const raw = String(search["groupBy"] ?? "none");
    const groupBy: GroupBy = (GROUP_BY_VALUES as string[]).includes(raw)
      ? (raw as GroupBy)
      : "none";
    return { groupBy };
  },
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

function ContractsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate({ from: Route.fullPath });
  const { groupBy } = Route.useSearch();
  const list = useServerFn(listContracts);
  const groupings = useServerFn(listContractGroupings);
  const { assignee, setAssignee, filterRows } = useAssigneeFilter();
  const { canDeleteRecord, isLoading: deletePermLoading } = useCanDelete("techcontracts.contracts");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [openNew, setOpenNew] = useState(false);
  const [openImport, setOpenImport] = useState(false);
  const [openBatch, setOpenBatch] = useState(false);
  const [openTemplate, setOpenTemplate] = useState(false);
  const [nestAmendments, setNestAmendments] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());


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

  const filtered = useMemo(() => filterRows(rows) as ContractRow[], [rows, filterRows]);

  const contractIds = useMemo(() => filtered.map((c) => c.id), [filtered]);

  const groupQuery = useQuery({
    queryKey: ["contracts", "groupings", contractIds],
    queryFn: () => groupings({ data: { contractIds } }),
    enabled: groupBy !== "none" && contractIds.length > 0,
  });

  const selection = useMemo(
    () => ({
      selectedIds,
      onToggle: (id: string) =>
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        }),
      onToggleMany: (ids: string[], checked: boolean) =>
        setSelectedIds((prev) => {
          const next = new Set(prev);
          for (const id of ids) {
            if (checked) next.add(id);
            else next.delete(id);
          }
          return next;
        }),
    }),
    [selectedIds],
  );

  const selectedRows = useMemo(
    () => filtered.filter((c) => selectedIds.has(c.id)),
    [filtered, selectedIds],
  );



  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Contratos"
        description="Ciclo de vida de contratos com clientes e fornecedores."
        count={filtered.length}
        countLabel={filtered.length === 1 ? "contrato" : "contratos"}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setOpenTemplate(true)}>
              <FileStack className="h-4 w-4 mr-1" /> Gerar de modelo
            </Button>
            <Button variant="outline" onClick={() => setOpenImport(true)}>
              <Upload className="h-4 w-4 mr-1" /> Importar contrato
            </Button>
            <Button variant="outline" onClick={() => setOpenBatch(true)}>
              <Upload className="h-4 w-4 mr-1" /> Importar em lote
            </Button>
            <Button variant="outline" asChild>
              <Link to="/contracts/links">
                <Link2 className="h-4 w-4 mr-1" /> Vincular contratos
              </Link>
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
        <div className="flex items-center gap-2">
          <Label htmlFor="contracts-group-by" className="text-sm text-muted-foreground">
            Agrupar por
          </Label>
          <Select
            value={groupBy}
            onValueChange={(next) => navigate({ search: { groupBy: next as GroupBy } })}
          >
            <SelectTrigger id="contracts-group-by" className="w-44">
              <SelectValue placeholder="Nenhum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              <SelectItem value="company">Empresa</SelectItem>
              <SelectItem value="service">Serviço</SelectItem>
              <SelectItem value="job_profile">Cargo</SelectItem>
              <SelectItem value="seniority">Senioridade</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          Carregando…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium">Nenhum contrato ainda</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Comece criando um contrato ou gere um a partir de um negócio ganho.
          </p>
          <Button className="mt-4" onClick={() => setOpenNew(true)}>
            <Plus className="h-4 w-4 mr-1" /> Novo contrato
          </Button>
        </div>
      ) : groupBy === "none" ? (
        <div className="rounded-lg border bg-card">
          <ContractsTable rows={filtered} />
        </div>
      ) : (
        <ContractsGroupedList
          rows={filtered}
          groupBy={groupBy}
          groupings={groupQuery.data}
          isLoading={groupQuery.isLoading}
          isError={groupQuery.isError}
          onRetry={() => groupQuery.refetch()}
        />
      )}

      <QuickCreateContractDialog
        open={openNew}
        onOpenChange={setOpenNew}
        onCreated={() => qc.invalidateQueries({ queryKey: ["contracts"] })}
      />

      <ApplyContractTemplateDialog
        open={openTemplate}
        onOpenChange={(next) => {
          setOpenTemplate(next);
          if (!next) qc.invalidateQueries({ queryKey: ["contracts"] });
        }}
      />

      <BatchImportContractsDialog
        open={openBatch}
        onOpenChange={setOpenBatch}
        onImported={() => qc.invalidateQueries({ queryKey: ["contracts"] })}
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
