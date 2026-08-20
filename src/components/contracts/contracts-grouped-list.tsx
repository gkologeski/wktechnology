// Tabela de contratos reutilizável (visão plana) e visão agrupada por
// empresa contraparte, serviço do catálogo, cargo ou senioridade.
// A tabela suporta seleção múltipla e edição inline dos campos operacionais
// (status, responsável, vigência e valor). A gravação usa as server functions
// existentes, que continuam validando permissão e workspace.
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Briefcase, Building2, ChevronDown, CornerDownRight, Layers, Package } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { AssigneeCell } from "@/components/entity/assignee-cell";
import { AssigneeField } from "@/components/entity/assignee-field";
import { formatCurrency, formatDateTime } from "@/lib/crm";
import { SENIORITY_LABEL, SENIORITY_OPTIONS } from "@/lib/job-profiles-shared";
import { updateContract } from "@/lib/contracts.functions";

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
  document_kind?: string | null;
  amendment_of_id?: string | null;
  parent_contract_id?: string | null;
  amendment_number?: string | null;
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
    jobProfileId?: string | null;
    jobProfileName?: string | null;
    seniority?: string | null;
  }[];
};

export type ContractGroupBy = "company" | "service" | "job_profile" | "seniority";

export type ContractsSelection = {
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleMany: (ids: string[], checked: boolean) => void;
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

const STATUS_VALUES = Object.keys(STATUS_LABEL);

function dateOnly(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

export type ArrangedContract = {
  row: ContractRow;
  depth: number;
  linkKind: "amendment" | "purchase" | null;
  /** Numeração hierárquica de apresentação: "1", "1.1", "1.3.1"… */
  path: string;
};

/** Ordena irmãos: aditivos primeiro (por número), depois contratos de compra. */
function compareSiblings(
  a: { row: ContractRow; linkKind: ArrangedContract["linkKind"] },
  b: { row: ContractRow; linkKind: ArrangedContract["linkKind"] },
) {
  if (a.linkKind !== b.linkKind) return a.linkKind === "amendment" ? -1 : 1;
  const numOf = (r: ContractRow) => {
    const raw = r.amendment_number ?? r.number ?? "";
    const digits = String(raw).match(/\d+/);
    return digits ? Number(digits[0]) : Number.POSITIVE_INFINITY;
  };
  const na = numOf(a.row);
  const nb = numOf(b.row);
  if (na !== nb) return na - nb;
  return (a.row.created_at ?? "").localeCompare(b.row.created_at ?? "");
}

/**
 * Ordena as linhas montando a árvore de vínculos: aditivos e contratos de
 * compra ficam imediatamente abaixo do contrato ao qual estão vinculados
 * (quando ele está na lista). Retorna profundidade, tipo de vínculo e a
 * numeração hierárquica (1, 1.1, 1.3, 1.3.1…).
 */
export function arrangeContractLinks(rows: ContractRow[], nest: boolean): ArrangedContract[] {
  if (!nest) return rows.map((row) => ({ row, depth: 0, linkKind: null, path: "" }));
  const byId = new Map(rows.map((r) => [r.id, r]));

  const parentOf = (r: ContractRow): { id: string; kind: "amendment" | "purchase" } | null => {
    const amendmentId = r.amendment_of_id ?? null;
    if (amendmentId && amendmentId !== r.id && byId.has(amendmentId)) {
      return { id: amendmentId, kind: "amendment" };
    }
    const parentId = r.parent_contract_id ?? null;
    if (r.role === "client" && parentId && parentId !== r.id && byId.has(parentId)) {
      return { id: parentId, kind: "purchase" };
    }
    return null;
  };

  type Child = { row: ContractRow; linkKind: ArrangedContract["linkKind"] };
  const childrenByParent = new Map<string, Child[]>();
  for (const r of rows) {
    const parent = parentOf(r);
    if (!parent) continue;
    const list = childrenByParent.get(parent.id) ?? [];
    list.push({ row: r, linkKind: parent.kind });
    childrenByParent.set(parent.id, list);
  }
  for (const list of childrenByParent.values()) list.sort(compareSiblings);

  const out: ArrangedContract[] = [];
  const seen = new Set<string>();
  function push(
    row: ContractRow,
    depth: number,
    linkKind: ArrangedContract["linkKind"],
    path: string,
  ) {
    if (seen.has(row.id)) return; // guarda contra ciclos
    seen.add(row.id);
    out.push({ row, depth, linkKind, path });
    const children = childrenByParent.get(row.id) ?? [];
    children.forEach((child, i) => {
      push(child.row, depth + 1, child.linkKind, `${path}.${i + 1}`);
    });
  }
  let rootIndex = 0;
  for (const r of rows) {
    if (parentOf(r)) continue; // entra sob o pai
    rootIndex += 1;
    push(r, 0, null, String(rootIndex));
  }
  // qualquer linha não visitada (ciclo) entra na raiz
  for (const r of rows) {
    if (seen.has(r.id)) continue;
    rootIndex += 1;
    push(r, 0, null, String(rootIndex));
  }
  return out;
}


export function ContractsTable({
  rows,
  selection,
  editable = false,
  nestLinks = false,
  onChanged,
}: {
  rows: ContractRow[];
  selection?: ContractsSelection;
  editable?: boolean;
  nestLinks?: boolean;
  onChanged?: () => void;
}) {
  const arranged = useMemo(() => arrangeContractLinks(rows, nestLinks), [rows, nestLinks]);

  const ids = useMemo(() => rows.map((r) => r.id), [rows]);
  const allSelected = selection
    ? ids.length > 0 && ids.every((id) => selection.selectedIds.has(id))
    : false;
  const someSelected = selection ? ids.some((id) => selection.selectedIds.has(id)) : false;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {selection ? (
            <TableHead className="w-10">
              <Checkbox
                aria-label="Selecionar todos os contratos"
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={(checked) => selection.onToggleMany(ids, checked === true)}
              />
            </TableHead>
          ) : null}
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
        {arranged.map(({ row: c, depth, linkKind, path }) => (
          <ContractTableRow
            key={c.id}
            contract={c}
            depth={depth}
            linkKind={linkKind}
            path={path}
            selection={selection}
            editable={editable}
            onChanged={onChanged}
          />
        ))}
      </TableBody>
    </Table>
  );
}

function ContractTableRow({
  contract: c,
  depth,
  linkKind,
  path,
  selection,
  editable,
  onChanged,
}: {
  contract: ContractRow;
  depth: number;
  linkKind: ArrangedContract["linkKind"];
  path?: string;
  selection?: ContractsSelection;
  editable: boolean;
  onChanged?: () => void;
}) {
  const qc = useQueryClient();
  const update = useServerFn(updateContract);
  const [saving, setSaving] = useState(false);

  const isAmendment = c.document_kind === "amendment" || Boolean(c.amendment_of_id);
  const selected = selection?.selectedIds.has(c.id) ?? false;

  async function patch(patchData: Record<string, unknown>, label: string) {
    setSaving(true);
    try {
      await update({ data: { id: c.id, patch: patchData as never } });
      toast.success(`${label} atualizado.`);
      await qc.invalidateQueries({ queryKey: ["contracts"] });
      await qc.invalidateQueries({ queryKey: ["contract", c.id] });
      onChanged?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <TableRow data-state={selected ? "selected" : undefined}>
      {selection ? (
        <TableCell className="w-10">
          <Checkbox
            aria-label={`Selecionar contrato ${c.title}`}
            checked={selected}
            onCheckedChange={() => selection.onToggle(c.id)}
          />
        </TableCell>
      ) : null}
      <TableCell className="font-mono text-xs">
        <Link to="/contracts/$id" params={{ id: c.id }} className="hover:underline">
          {c.number ?? "—"}
        </Link>
      </TableCell>
      <TableCell>
        <div
          className="flex items-center gap-2"
          style={depth > 0 ? { paddingLeft: depth * 20 } : undefined}
        >
          {depth > 0 ? (
            <CornerDownRight
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          ) : null}
          {path ? (
            <span className="shrink-0 font-mono text-xs text-muted-foreground">{path}</span>
          ) : null}
          <Link
            to="/contracts/$id"
            params={{ id: c.id }}
            className="font-medium hover:underline truncate"
          >
            {c.title}
          </Link>
          {isAmendment ? (
            <Badge variant="outline" className="h-4 shrink-0 px-1.5 py-0 text-[10px]">
              Aditivo{c.amendment_number ? ` ${c.amendment_number}` : ""}
            </Badge>
          ) : null}
          {linkKind === "purchase" ? (
            <Badge variant="outline" className="h-4 shrink-0 px-1.5 py-0 text-[10px]">
              Compra
            </Badge>
          ) : null}

          {c.imported_from ? (
            <Badge variant="outline" className="h-4 shrink-0 px-1.5 py-0 text-[10px]">
              Importado
            </Badge>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="text-sm">{ROLE_LABEL[c.role] ?? c.role}</TableCell>
      <TableCell>
        {editable ? (
          <Select
            value={c.status}
            disabled={saving}
            onValueChange={(next) => void patch({ status: next }, "Status")}
          >
            <SelectTrigger className="h-8 w-40" aria-label={`Status do contrato ${c.title}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_VALUES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Badge variant="outline" className={STATUS_TONE[c.status] ?? ""}>
            {STATUS_LABEL[c.status] ?? c.status}
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {editable ? (
          <Input
            type="number"
            min={0}
            step="0.01"
            defaultValue={Number(c.total_value ?? 0)}
            disabled={saving}
            aria-label={`Valor total do contrato ${c.title}`}
            className="h-8 w-32 text-right"
            onBlur={(e) => {
              const next = Number(e.target.value);
              if (Number.isNaN(next) || next < 0) return;
              if (next === Number(c.total_value ?? 0)) return;
              void patch({ total_value: next }, "Valor");
            }}
          />
        ) : (
          formatCurrency(Number(c.total_value ?? 0), c.currency)
        )}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {editable ? (
          <div className="flex items-center gap-1">
            <Input
              type="date"
              defaultValue={dateOnly(c.starts_at)}
              disabled={saving}
              aria-label={`Início da vigência do contrato ${c.title}`}
              className="h-8 w-32"
              onBlur={(e) => {
                const next = e.target.value || null;
                if (next === (dateOnly(c.starts_at) || null)) return;
                void patch({ starts_at: next }, "Início da vigência");
              }}
            />
            <span aria-hidden="true">→</span>
            <Input
              type="date"
              defaultValue={dateOnly(c.ends_at)}
              disabled={saving}
              aria-label={`Fim da vigência do contrato ${c.title}`}
              className="h-8 w-32"
              onBlur={(e) => {
                const next = e.target.value || null;
                if (next === (dateOnly(c.ends_at) || null)) return;
                void patch({ ends_at: next }, "Fim da vigência");
              }}
            />
          </div>
        ) : (
          <>
            {c.starts_at ? formatDateTime(c.starts_at).split(" ")[0] : "—"}
            {c.ends_at ? ` → ${formatDateTime(c.ends_at).split(" ")[0]}` : ""}
          </>
        )}
      </TableCell>
      <TableCell>
        {editable ? (
          <AssigneeField
            table="contracts"
            rowId={c.id}
            assignedTo={c.assigned_to}
            compact
            onChanged={() => {
              void qc.invalidateQueries({ queryKey: ["contracts"] });
              onChanged?.();
            }}
          />
        ) : (
          <AssigneeCell assignedTo={c.assigned_to} />
        )}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {formatDateTime(c.created_at)}
      </TableCell>
    </TableRow>
  );
}

type Group = {
  key: string;
  label: string;
  sublabel?: string;
  rows: ContractRow[];
  total: number;
  currency: string;
  order?: number;
};

const SENIORITY_ORDER = new Map(SENIORITY_OPTIONS.map((s, i) => [s.value as string, i]));

function buildGroups(
  rows: ContractRow[],
  groupBy: ContractGroupBy,
  groupings: ContractGroupings | undefined,
): Group[] {
  const map = new Map<string, Group>();
  const push = (key: string, label: string, row: ContractRow, order?: number) => {
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
        ...(order === undefined ? {} : { order }),
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
  } else if (groupBy === "service") {
    const byContract = new Map<string, { id: string; name: string }[]>();
    for (const s of groupings?.services ?? []) {
      if (!s.catalogId || !s.catalogName) continue;
      const list = byContract.get(s.contractId) ?? [];
      if (!list.some((i) => i.id === s.catalogId))
        list.push({ id: s.catalogId, name: s.catalogName });
      byContract.set(s.contractId, list);
    }
    for (const row of rows) {
      const list = byContract.get(row.id) ?? [];
      if (list.length === 0) push("__none__", "Sem serviço", row);
      else for (const item of list) push(item.id, item.name, row);
    }
  } else if (groupBy === "job_profile") {
    const byContract = new Map<string, { id: string; name: string }[]>();
    for (const s of groupings?.services ?? []) {
      if (!s.jobProfileId || !s.jobProfileName) continue;
      const list = byContract.get(s.contractId) ?? [];
      if (!list.some((i) => i.id === s.jobProfileId))
        list.push({ id: s.jobProfileId, name: s.jobProfileName });
      byContract.set(s.contractId, list);
    }
    for (const row of rows) {
      const list = byContract.get(row.id) ?? [];
      if (list.length === 0) push("__none__", "Sem cargo", row);
      else for (const item of list) push(item.id, item.name, row);
    }
    // Quando todos os contratos do grupo são da mesma prestadora, exibimos o
    // nome dela ao lado do cargo ("função + prestadora").
    const companyNames = new Map((groupings?.companies ?? []).map((c) => [c.id, c.name]));
    for (const group of map.values()) {
      const ids = new Set(
        group.rows.map((r) => r.counterparty_company_id ?? "").filter(Boolean) as string[],
      );
      if (ids.size === 1) {
        const name = companyNames.get(Array.from(ids)[0] as string);
        if (name) group.sublabel = name;
      }
    }
  } else {
    const byContract = new Map<string, string[]>();
    for (const s of groupings?.services ?? []) {
      if (!s.seniority) continue;
      const list = byContract.get(s.contractId) ?? [];
      if (!list.includes(s.seniority)) list.push(s.seniority);
      byContract.set(s.contractId, list);
    }
    for (const row of rows) {
      const list = byContract.get(row.id) ?? [];
      if (list.length === 0) push("__none__", "Sem senioridade", row);
      else
        for (const value of list)
          push(value, SENIORITY_LABEL[value] ?? value, row, SENIORITY_ORDER.get(value) ?? 99);
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.key === "__none__") return 1;
    if (b.key === "__none__") return -1;
    if (a.order !== undefined || b.order !== undefined) {
      return (a.order ?? 99) - (b.order ?? 99);
    }
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
  selection,
  editable = false,
  nestLinks = false,
}: {
  rows: ContractRow[];
  groupBy: ContractGroupBy;
  groupings: ContractGroupings | undefined;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  selection?: ContractsSelection;
  editable?: boolean;
  nestLinks?: boolean;
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
        <GroupSection
          key={g.key}
          group={g}
          groupBy={groupBy}
          {...(selection ? { selection } : {})}
          editable={editable}
          nestLinks={nestLinks}
        />
      ))}
    </div>
  );
}

const GROUP_ICON = {
  company: Building2,
  service: Package,
  job_profile: Briefcase,
  seniority: Layers,
} as const;

function GroupSection({
  group,
  groupBy,
  selection,
  editable = false,
  nestLinks = false,
}: {
  group: Group;
  groupBy: ContractGroupBy;
  selection?: ContractsSelection;
  editable?: boolean;
  nestLinks?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const Icon = GROUP_ICON[groupBy];
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
        {group.sublabel ? (
          <span className="text-sm text-muted-foreground truncate">· {group.sublabel}</span>
        ) : null}
        <Badge variant="secondary" className="shrink-0">
          {group.rows.length}
        </Badge>
        <span className="ml-auto text-sm text-muted-foreground tabular-nums shrink-0">
          {formatCurrency(group.total, group.currency)}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t">
          <ContractsTable
            rows={group.rows}
            {...(selection ? { selection } : {})}
            editable={editable}
            nestLinks={nestLinks}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
