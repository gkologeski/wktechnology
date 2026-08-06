// Tabela de contratos reutilizável (visão plana) e visão agrupada por
// empresa contraparte ou por serviço do catálogo associado.
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Building2, ChevronDown, Package } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AssigneeCell } from "@/components/entity/assignee-cell";
import { formatCurrency, formatDateTime } from "@/lib/crm";

export type ContractRow = {
  id: string;
  number: string | null;
  title: string;
  role: string;
  status: string;
  total_value: number | string | null;
  currency: string;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  imported_from?: string | null;
  counterparty_company_id?: string | null;
  assigned_to?: string | null;
};

export type ContractGroupings = {
  companies: { id: string; name: string }[];
  companyByContract: { contractId: string; companyId: string }[];
  services: {
    contractId: string;
    serviceId: string;
    serviceName: string;
    catalogId: string | null;
    catalogName: string | null;
  }[];
};

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

export function ContractsTable({ rows }: { rows: ContractRow[] }) {
  return (
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
        {rows.map((c) => (
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
              {formatCurrency(Number(c.total_value ?? 0), c.currency)}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {c.starts_at ? formatDateTime(c.starts_at).split(" ")[0] : "—"}
              {c.ends_at ? ` → ${formatDateTime(c.ends_at).split(" ")[0]}` : ""}
            </TableCell>
            <TableCell>
              <AssigneeCell assignedTo={c.assigned_to} />
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {formatDateTime(c.created_at)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

type Group = { key: string; label: string; rows: ContractRow[]; total: number; currency: string };

function buildGroups(
  rows: ContractRow[],
  groupBy: "company" | "service",
  groupings: ContractGroupings | undefined,
): Group[] {
  const map = new Map<string, Group>();
  const push = (key: string, label: string, row: ContractRow) => {
    const existing = map.get(key);
    const value = Number(row.total_value ?? 0);
    if (existing) {
      existing.rows.push(row);
      existing.total += value;
    } else {
      map.set(key, {
        key,
        label,
        rows: [row],
        total: value,
        currency: row.currency || "BRL",
      });
    }
  };

  if (groupBy === "company") {
    const names = new Map((groupings?.companies ?? []).map((c) => [c.id, c.name]));
    for (const row of rows) {
      const companyId = row.counterparty_company_id ?? null;
      if (companyId) push(companyId, names.get(companyId) ?? "Empresa sem nome", row);
      else push("__none__", "Sem empresa", row);
    }
  } else {
    const byContract = new Map<string, { id: string; name: string }[]>();
    for (const s of groupings?.services ?? []) {
      if (!s.catalogId || !s.catalogName) continue;
      const list = byContract.get(s.contractId) ?? [];
      if (!list.some((i) => i.id === s.catalogId)) list.push({ id: s.catalogId, name: s.catalogName });
      byContract.set(s.contractId, list);
    }
    for (const row of rows) {
      const list = byContract.get(row.id) ?? [];
      if (list.length === 0) push("__none__", "Sem serviço", row);
      else for (const item of list) push(item.id, item.name, row);
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.key === "__none__") return 1;
    if (b.key === "__none__") return -1;
    if (b.rows.length !== a.rows.length) return b.rows.length - a.rows.length;
    return a.label.localeCompare(b.label, "pt-BR");
  });
}

export function ContractsGroupedList({
  rows,
  groupBy,
  groupings,
  isLoading,
  isError,
  onRetry,
}: {
  rows: ContractRow[];
  groupBy: "company" | "service";
  groupings: ContractGroupings | undefined;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}) {
  const groups = useMemo(() => buildGroups(rows, groupBy, groupings), [rows, groupBy, groupings]);

  if (isError) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar o agrupamento dos contratos.
        </p>
        {onRetry ? (
          <Button variant="outline" className="mt-3" onClick={onRetry}>
            Tentar novamente
          </Button>
        ) : null}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
            <div className="h-4 w-48 rounded bg-muted animate-pulse" />
            <div className="h-3 w-full rounded bg-muted animate-pulse" />
            <div className="h-3 w-5/6 rounded bg-muted animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <GroupSection key={g.key} group={g} groupBy={groupBy} />
      ))}
    </div>
  );
}

function GroupSection({ group, groupBy }: { group: Group; groupBy: "company" | "service" }) {
  const [open, setOpen] = useState(true);
  const Icon = groupBy === "company" ? Building2 : Package;
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-lg border bg-card overflow-hidden"
    >
      <CollapsibleTrigger className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
        />
        <Icon aria-hidden="true" className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="font-medium truncate">{group.label}</span>
        <Badge variant="secondary" className="shrink-0">
          {group.rows.length}
        </Badge>
        <span className="ml-auto text-sm text-muted-foreground tabular-nums shrink-0">
          {formatCurrency(group.total, group.currency)}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t">
          <ContractsTable rows={group.rows} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
