import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Deal } from "@/lib/db-types";
import { type Pipeline, usePipelines } from "@/lib/pipelines";
import { formatCurrency, formatDate } from "@/lib/crm";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Play, Trophy, X as XIcon } from "lucide-react";
import { startFocusQueue } from "@/lib/focus-queue";
import {
  HeaderCheckbox,
  InitialsAvatar,
  Pagination,
  Pill,
  Td,
  Th,
  TONES,
  timeAgo,
  type SortDir,
} from "@/components/crm/hubspot-shell";
import type { DealLookups } from "@/components/deals/deals-board";
import { useGridColumns, type GridColumnDef } from "@/hooks/use-grid-columns";
import { LostReasonDialog, type LostReasonResult } from "@/components/deals/lost-reason-dialog";
import { confirmDialog } from "@/components/ui/confirm-dialog";

type SortKey = "name" | "value" | "expected_close_date" | "created_at";

const STAGE_TONE: Record<string, keyof typeof TONES> = {
  new: "slate",
  qualified: "sky",
  proposal: "violet",
  negotiation: "amber",
  won: "emerald",
  lost: "rose",
};

const DEFAULT_DEAL_COLS = [
  "name",
  "stage",
  "value",
  "expected_close_date",
  "pipeline",
  "owner",
  "company",
  "created_at",
];

export function DealsHubspotTable({
  deals,
  pipeline,
  lookups,
  onOpen,
}: {
  deals: Deal[];
  pipeline: Pipeline | undefined;
  lookups: DealLookups;
  onOpen: (d: Deal) => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { pipelines: allPipelines } = usePipelines("deal");

  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const sorted = useMemo(() => {
    const copy = [...deals];
    copy.sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[sortKey];
      const bv = (b as unknown as Record<string, unknown>)[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (sortKey === "value")
        return sortDir === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return copy;
  }, [deals, sortKey, sortDir]);

  const total = sorted.length;
  const rows = sorted.slice(page * pageSize, page * pageSize + pageSize);

  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
  const someSelected = rows.some((r) => selectedIds.has(r.id));

  const toggleAll = () =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) for (const r of rows) next.delete(r.id);
      else for (const r of rows) next.add(r.id);
      return next;
    });
  const toggleOne = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const clearSelection = () => setSelectedIds(new Set());

  const onSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  const [lostTarget, setLostTarget] = useState<{ id: string; name: string | null } | null>(null);

  const setStage = async (id: string, stage: "won" | "lost") => {
    if (stage === "lost") {
      const d = deals.find((x) => x.id === id) ?? null;
      setLostTarget({ id, name: d?.name ?? null });
      return;
    }
    const { error } = await supabase.from("deals").update({ stage }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Marcado como ganho");
    qc.invalidateQueries({ queryKey: ["deals"] });
  };

  const confirmLost = async (result: LostReasonResult) => {
    if (!lostTarget) return;
    const notes = result.notes ? `${result.reasonLabel} — ${result.notes}` : result.reasonLabel;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("deals")
      .update({ stage: "lost", closed_lost_reason: notes })
      .eq("id", lostTarget.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Marcado como perdido");
    qc.invalidateQueries({ queryKey: ["deals"] });
  };
  const removeOne = async (id: string) => {
    if (!(await confirmDialog("Excluir este negócio?"))) return;
    const { error } = await supabase.from("deals").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removido");
    qc.invalidateQueries({ queryKey: ["deals"] });
  };
  const bulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    if (!(await confirmDialog(`Excluir ${ids.length} negócio(s)?`))) return;
    const { error } = await supabase.from("deals").delete().in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`${ids.length} excluído(s)`);
    clearSelection();
    qc.invalidateQueries({ queryKey: ["deals"] });
  };

  const STAGE_ENUM_LABEL: Record<string, string> = {
    new: "Novo",
    qualified: "Qualificado",
    proposal: "Proposta",
    negotiation: "Negociação",
    won: "Ganho",
    lost: "Perdido",
  };
  const stageLabel = (stageValue: string | null | undefined, stageId: string | null) => {
    const v = stageId ?? stageValue ?? "";
    // 1) try the selected pipeline
    let def = pipeline?.stages.find((s) => s.value === v);
    // 2) fall back to any pipeline (deal may belong to another funnel)
    if (!def && allPipelines) {
      for (const p of allPipelines) {
        const f = p.stages.find((s) => s.value === v);
        if (f) {
          def = f;
          break;
        }
      }
    }
    if (def) return def.label;
    // 3) fall back to the legacy enum stage column
    if (stageValue && STAGE_ENUM_LABEL[stageValue]) return STAGE_ENUM_LABEL[stageValue];
    return stageValue ?? "—";
  };

  type DealRow = Deal;
  const dealColumns = useMemo<GridColumnDef<DealRow>[]>(
    () => [
      {
        key: "name",
        label: "Nome do negócio",
        header: (
          <Th sortable active={sortKey === "name"} dir={sortDir} onClick={() => onSort("name")}>
            Nome do negócio
          </Th>
        ),
        render: (d) => (
          <button
            type="button"
            onClick={() => onOpen(d)}
            className="truncate text-left font-medium text-primary hover:underline"
          >
            {d.name}
          </button>
        ),
      },
      {
        key: "stage",
        label: "Etapa",
        render: (d) => (
          <Pill
            tone={STAGE_TONE[String(d.stage)] ?? "slate"}
            label={stageLabel(d.stage, d.stage_id)}
          />
        ),
      },
      {
        key: "value",
        label: "Valor",
        className: "tabular-nums",
        header: (
          <Th sortable active={sortKey === "value"} dir={sortDir} onClick={() => onSort("value")}>
            Valor
          </Th>
        ),
        render: (d) => formatCurrency(Number(d.value ?? 0), d.currency || "BRL"),
      },
      {
        key: "expected_close_date",
        label: "Fechamento",
        className: "text-muted-foreground",
        header: (
          <Th
            sortable
            active={sortKey === "expected_close_date"}
            dir={sortDir}
            onClick={() => onSort("expected_close_date")}
          >
            Fechamento
          </Th>
        ),
        render: (d) => formatDate(d.expected_close_date),
      },
      {
        key: "pipeline",
        label: "Pipeline",
        className: "text-muted-foreground",
        render: () => pipeline?.name ?? "—",
      },
      {
        key: "owner",
        label: "Responsável",
        render: (d) => {
          if (!d.owner_id) return <span className="text-muted-foreground">—</span>;
          const name = lookups.owners.get(d.owner_id) ?? "—";
          const initials =
            name && name !== "—"
              ? name
                  .split(" ")
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((p) => p[0]?.toUpperCase() ?? "")
                  .join("")
              : d.owner_id.slice(0, 2).toUpperCase();
          return (
            <div className="flex items-center gap-2" title={name}>
              <InitialsAvatar text={initials} seed={d.owner_id} size={6} />
              <span className="truncate text-sm">{name}</span>
            </div>
          );
        },
      },
      {
        key: "company",
        label: "Empresa",
        render: (d) =>
          d.company_id ? (
            <Link
              to="/companies/$id"
              params={{ id: d.company_id }}
              className="truncate text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {lookups.companies.get(d.company_id) ?? "—"}
            </Link>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        key: "contact",
        label: "Contato principal",
        render: (d) =>
          d.primary_contact_id ? (
            <span className="truncate">{lookups.contacts.get(d.primary_contact_id) ?? "—"}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        key: "currency",
        label: "Moeda",
        className: "text-muted-foreground",
        render: (d) => d.currency || "BRL",
      },
      {
        key: "updated_at",
        label: "Atualizado em",
        className: "text-muted-foreground",
        render: (d) => timeAgo(d.updated_at),
      },
      {
        key: "created_at",
        label: "Criado em",
        className: "text-muted-foreground",
        header: (
          <Th
            sortable
            active={sortKey === "created_at"}
            dir={sortDir}
            onClick={() => onSort("created_at")}
          >
            Criado em
          </Th>
        ),
        render: (d) => timeAgo(d.created_at),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortKey, sortDir, pipeline, lookups],
  );

  const {
    columns: visibleColumns,
    ColumnsButton,
    ColumnsEditor,
  } = useGridColumns<DealRow>({
    gridKey: "deals",
    columns: dealColumns,
    defaults: DEFAULT_DEAL_COLS,
    customEntity: "deals",
    catalogEntity: "deals",
  });

  return (
    <div className="flex flex-col rounded-md border bg-card">
      <div className="flex items-center justify-between border-b px-3 py-2">
        {selectedIds.size > 0 ? (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-primary">
              {selectedIds.size} selecionado(s)
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() => {
                const ids = Array.from(selectedIds);
                if (!ids.length) return;
                startFocusQueue("deals", ids, `Negócios · ${ids.length.toLocaleString("pt-BR")}`);
                toast.success(`Fila iniciada com ${ids.length} negócio(s)`);
                navigate({ to: "/deals/$id", params: { id: ids[0] } });
              }}
            >
              <Play className="mr-1 h-3.5 w-3.5" /> Iniciar fila
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() => setBulkEditOpen(true)}
            >
              <Pencil className="mr-1 h-3.5 w-3.5" /> Editar em massa
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-destructive hover:text-destructive"
              onClick={bulkDelete}
            >
              Excluir
            </Button>

            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearSelection}>
              <XIcon className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">{total} negócio(s)</span>
        )}
        <ColumnsButton />
      </div>

      <div className="overflow-auto">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="w-10 border-b px-3 py-2.5">
                <HeaderCheckbox
                  allSelected={allSelected}
                  someSelected={someSelected}
                  onToggle={toggleAll}
                />
              </th>
              {visibleColumns.map(
                (col) =>
                  col.header ?? (
                    <Th key={col.key} className={col.headerClassName}>
                      {col.label}
                    </Th>
                  ),
              )}
              <th className="w-10 border-b px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleColumns.length + 2}
                  className="px-3 py-16 text-center text-sm text-muted-foreground"
                >
                  Nenhum negócio encontrado com os filtros atuais.
                </td>
              </tr>
            ) : (
              rows.map((d) => {
                const checked = selectedIds.has(d.id);
                return (
                  <tr
                    key={d.id}
                    className={cn(
                      "group h-12 border-b transition-colors hover:bg-primary/5",
                      checked && "bg-primary/5",
                    )}
                  >
                    <Td className="w-10">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleOne(d.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Td>
                    {visibleColumns.map((col) => (
                      <Td key={col.key} className={col.className}>
                        {col.render(d)}
                      </Td>
                    ))}
                    <Td className="w-10">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onOpen(d)}>Abrir</DropdownMenuItem>
                          {d.stage !== "won" && (
                            <DropdownMenuItem onClick={() => setStage(d.id, "won")}>
                              <Trophy className="mr-2 h-3.5 w-3.5" /> Marcar ganho
                            </DropdownMenuItem>
                          )}
                          {d.stage !== "lost" && (
                            <DropdownMenuItem onClick={() => setStage(d.id, "lost")}>
                              Marcar perdido
                            </DropdownMenuItem>
                          )}
                          {d.company_id && (
                            <DropdownMenuItem
                              onClick={() =>
                                navigate({
                                  to: "/companies/$id",
                                  params: { id: d.company_id! },
                                })
                              }
                            >
                              Ver empresa
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => removeOne(d.id)}
                          >
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        setPage={setPage}
        setPageSize={setPageSize}
      />

      <ColumnsEditor />

      <LostReasonDialog
        open={!!lostTarget}
        onOpenChange={(b) => !b && setLostTarget(null)}
        dealName={lostTarget?.name ?? null}
        onConfirm={confirmLost}
      />
    </div>
  );
}
