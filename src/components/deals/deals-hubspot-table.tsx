import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Deal } from "@/lib/db-types";
import type { Pipeline } from "@/lib/pipelines";
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
import { MoreHorizontal, Trophy, X as XIcon } from "lucide-react";
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

type SortKey = "name" | "value" | "expected_close_date" | "created_at";

const STAGE_TONE: Record<string, keyof typeof TONES> = {
  new: "slate",
  qualified: "sky",
  proposal: "violet",
  negotiation: "amber",
  won: "emerald",
  lost: "rose",
};

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
      if (sortKey === "value") return sortDir === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
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

  const setStage = async (id: string, stage: "won" | "lost") => {
    const { error } = await supabase.from("deals").update({ stage }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(stage === "won" ? "Marcado como ganho" : "Marcado como perdido");
    qc.invalidateQueries({ queryKey: ["deals"] });
  };
  const removeOne = async (id: string) => {
    if (!confirm("Excluir este negócio?")) return;
    const { error } = await supabase.from("deals").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removido");
    qc.invalidateQueries({ queryKey: ["deals"] });
  };
  const bulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    if (!confirm(`Excluir ${ids.length} negócio(s)?`)) return;
    const { error } = await supabase.from("deals").delete().in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`${ids.length} excluído(s)`);
    clearSelection();
    qc.invalidateQueries({ queryKey: ["deals"] });
  };

  const stageLabel = (stageValue: string | null | undefined, stageId: string | null) => {
    const v = stageId ?? stageValue ?? "";
    const def = pipeline?.stages.find((s) => s.value === v);
    return def?.label ?? v ?? "—";
  };

  return (
    <div className="flex flex-col rounded-md border bg-card">
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 border-b bg-primary/5 px-3 py-2">
          <span className="text-xs font-medium text-primary">
            {selectedIds.size} selecionado(s)
          </span>
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
      )}

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
              <Th
                sortable
                active={sortKey === "name"}
                dir={sortDir}
                onClick={() => onSort("name")}
              >
                Deal name
              </Th>
              <Th>Stage</Th>
              <Th
                sortable
                active={sortKey === "value"}
                dir={sortDir}
                onClick={() => onSort("value")}
              >
                Amount
              </Th>
              <Th
                sortable
                active={sortKey === "expected_close_date"}
                dir={sortDir}
                onClick={() => onSort("expected_close_date")}
              >
                Close date
              </Th>
              <Th>Pipeline</Th>
              <Th>Owner</Th>
              <Th>Company</Th>
              <Th
                sortable
                active={sortKey === "created_at"}
                dir={sortDir}
                onClick={() => onSort("created_at")}
              >
                Create date
              </Th>
              <th className="w-10 border-b px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="px-3 py-16 text-center text-sm text-muted-foreground"
                >
                  Nenhum negócio encontrado com os filtros atuais.
                </td>
              </tr>
            ) : (
              rows.map((d) => {
                const checked = selectedIds.has(d.id);
                const tone = STAGE_TONE[String(d.stage)] ?? "slate";
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
                    <Td>
                      <button
                        type="button"
                        onClick={() => onOpen(d)}
                        className="truncate text-left font-medium text-primary hover:underline"
                      >
                        {d.name}
                      </button>
                    </Td>
                    <Td>
                      <Pill tone={tone} label={stageLabel(d.stage, d.stage_id)} />
                    </Td>
                    <Td className="tabular-nums">
                      {formatCurrency(Number(d.value ?? 0), d.currency || "BRL")}
                    </Td>
                    <Td className="text-muted-foreground">
                      {formatDate(d.expected_close_date)}
                    </Td>
                    <Td className="text-muted-foreground">{pipeline?.name ?? "—"}</Td>
                    <Td>
                      {d.owner_id ? (
                        <InitialsAvatar
                          text={(
                            lookups.owners.get(d.owner_id)?.slice(0, 2) ??
                            d.owner_id.slice(0, 2)
                          ).toUpperCase()}
                          seed={d.owner_id}
                          size={6}
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </Td>
                    <Td>
                      {d.company_id ? (
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
                      )}
                    </Td>
                    <Td className="text-muted-foreground">{timeAgo(d.created_at)}</Td>
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
                          <DropdownMenuItem onClick={() => onOpen(d)}>
                            Abrir
                          </DropdownMenuItem>
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
    </div>
  );
}
