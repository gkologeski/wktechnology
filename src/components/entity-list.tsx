import { useState, useMemo, type ReactNode, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { TablePagination } from "@/components/table-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/page-header";
import { BulkActionBar } from "@/components/bulk-action-bar";
import { BulkEditDialog, type BulkField } from "@/components/bulk-edit-dialog";
import { BulkEditFieldsDialog } from "@/components/grid/bulk-edit-fields-dialog";
import { isBulkEditEntity } from "@/lib/grid/bulk-edit-fields";

import { ConfirmCountDialog } from "@/components/confirm-count-dialog";
import { BulkCreateActivityDialog } from "@/components/bulk-create-activity-dialog";
import { FilterBuilderDialog } from "@/components/filter-builder-dialog";
import { ColumnEditorDialog } from "@/components/column-editor-dialog";
import { EntityBoard, type BoardStage } from "@/components/entity-board";
import {
  applyFilters,
  type FilterGroup,
  type FilterCondition,
  conditionToLabel,
} from "@/lib/filters";
import { useSavedViews, type SavedView } from "@/lib/saved-views";
import { PRESET_VIEWS } from "@/lib/preset-views";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Filter,
  Columns3,
  Save,
  Star,
  X,
  LayoutGrid,
  List as ListIcon,
  ListTodo,
} from "lucide-react";
import Papa from "papaparse";
import { RichHtmlEditor } from "@/components/rich-html-editor";
import { EmailInput } from "@/components/ui/email-input";
import { isEmail } from "@/lib/validators";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { deniedIfUnaffected } from "@/lib/access-control/rls-denied";
import { reportBulkDelete } from "@/lib/access-control/bulk-delete-report";

type Field = {
  name: string;
  label: string;
  type?: "text" | "email" | "tel" | "number" | "date" | "textarea" | "select" | "html";
  options?: { value: string; label: string }[];
  required?: boolean;
};

export type EntityListProps<T extends { id: string }> = {
  table: "companies" | "contacts" | "leads" | "deals" | "activities";
  title: string;
  description?: string;
  columns: { key: keyof T | string; label: string; render?: (row: T) => ReactNode }[];
  fields: Field[];
  defaults?: Partial<T>;
  detailPath?: (id: string) => string;
  searchKeys?: (keyof T)[];
  csvEnabled?: boolean;
  toolbar?: ReactNode;
  rowActions?: (row: T) => ReactNode;
  bulkEditFields?: BulkField[];
  bulkActions?: (ids: string[], rows: T[]) => ReactNode;
  // New
  inlineEditable?: string[];
  boardStages?: BoardStage[];
  boardStageField?: string;
  filterFields?: {
    name: string;
    label: string;
    type?: string;
    options?: { value: string; label: string }[];
  }[];
  /** Always-applied filters (not shown in UI). Useful to scope a page to a subset (e.g. activities of type=task). */
  lockedFilters?: FilterCondition[];
  /** Singular label for the "Criar X" button. Overrides default mapping. */
  entitySingularLabel?: string;
};

type ViewState = {
  viewId: string | null; // saved view id, or "preset:..."
  filters: FilterGroup;
  columnOrder: string[] | null; // null = use default
  sortBy: string;
  sortDir: "asc" | "desc";
};

export function EntityList<T extends { id: string; owner_id?: string }>(props: EntityListProps<T>) {
  const {
    table,
    title,
    description,
    columns,
    fields,
    defaults,
    detailPath,
    searchKeys,
    csvEnabled,
    toolbar,
    rowActions,
    bulkEditFields,
    bulkActions,
    inlineEditable,
    boardStages,
    boardStageField,
    filterFields,
    lockedFilters,
    entitySingularLabel,
  } = props;
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const savedViews = useSavedViews(table);
  const presets = PRESET_VIEWS[table] ?? [];

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkActivityOpen, setBulkActivityOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [columnOpen, setColumnOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "board">("table");
  const [view, setView] = useState<ViewState>({
    viewId: null,
    filters: { type: "group", op: "and", conditions: [] },
    columnOrder: null,
    sortBy: "created_at",
    sortDir: "desc",
  });

  const PAGE_SIZE = pageSize;

  // Debounce search (300ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page when filters/sort/search/view change
  useEffect(() => {
    setPage(0);
  }, [view.filters, view.sortBy, view.sortDir, debouncedSearch, viewMode, pageSize]);

  // Build a slim column projection so we never pull heavy JSONB (hs_raw etc.)
  const selectColumns = useMemo(() => {
    const set = new Set<string>(["id", "owner_id", "created_at", "updated_at", view.sortBy]);
    for (const c of columns) set.add(String(c.key));
    for (const f of fields) set.add(f.name);
    for (const k of searchKeys ?? []) set.add(String(k));
    if (boardStageField) set.add(boardStageField);
    return Array.from(set).join(",");
  }, [columns, fields, searchKeys, boardStageField, view.sortBy]);

  const isBoard = viewMode === "board" && !!boardStages && !!boardStageField;

  const { data: queryResult, isLoading } = useQuery({
    queryKey: [
      table,
      "list",
      view.filters,
      view.sortBy,
      view.sortDir,
      debouncedSearch,
      page,
      isBoard,
      selectColumns,
      lockedFilters,
    ],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = (supabase as any).from(table).select(selectColumns, { count: "exact" });
      q = applyFilters(q, view.filters);
      if (lockedFilters && lockedFilters.length > 0) {
        q = applyFilters(q, { type: "group", op: "and", conditions: lockedFilters });
      }
      // Server-side search across searchKeys
      const term = debouncedSearch.trim();
      if (term && searchKeys && searchKeys.length > 0) {
        const safe = term.replace(/[,()]/g, " ").trim();
        if (safe) {
          const parts = searchKeys.map((k) => `${String(k)}.ilike.%${safe}%`);
          q = q.or(parts.join(","));
        }
      }
      q = q.order(view.sortBy, { ascending: view.sortDir === "asc" });
      if (!isBoard) {
        q = q.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      } else {
        // Board mode: hard cap so we don't pull tens of thousands of rows
        q = q.range(0, 999);
      }
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as T[], count: count ?? 0 };
    },
  });

  const rows = queryResult?.rows ?? [];
  const totalCount = queryResult?.count ?? 0;
  // Server already filtered; keep `filtered` as alias for downstream code paths
  const filtered = rows;

  // Visible columns based on column order
  const visibleColumns = useMemo(() => {
    if (!view.columnOrder) return columns;
    const map = new Map(columns.map((c) => [String(c.key), c]));
    return view.columnOrder.map((k) => map.get(k)).filter(Boolean) as typeof columns;
  }, [columns, view.columnOrder]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id));
  const someFilteredSelected = filtered.some((r) => selectedIds.has(r.id));
  const toggleAll = () =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) for (const r of filtered) next.delete(r.id);
      else for (const r of filtered) next.add(r.id);
      return next;
    });
  const toggleOne = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const clearSel = () => setSelectedIds(new Set());

  const [isSelectingAll, setIsSelectingAll] = useState(false);
  const selectAllMatching = async () => {
    try {
      setIsSelectingAll(true);
      const buildQuery = () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let q = (supabase as any).from(table).select("id");
        q = applyFilters(q, view.filters);
        if (lockedFilters && lockedFilters.length > 0) {
          q = applyFilters(q, { type: "group", op: "and", conditions: lockedFilters });
        }
        const term = debouncedSearch.trim();
        if (term && searchKeys && searchKeys.length > 0) {
          const safe = term.replace(/[,()]/g, " ").trim();
          if (safe) {
            const parts = searchKeys.map((k) => `${String(k)}.ilike.%${safe}%`);
            q = q.or(parts.join(","));
          }
        }
        return q;
      };
      const allIds: string[] = [];
      const CHUNK = 1000;
      for (let offset = 0; ; offset += CHUNK) {
        const { data, error } = await buildQuery().range(offset, offset + CHUNK - 1);
        if (error) throw error;
        const batch = (data ?? []) as { id: string }[];
        for (const r of batch) allIds.push(r.id);
        if (batch.length < CHUNK) break;
        if (allIds.length >= 100_000) break;
      }
      setSelectedIds(new Set(allIds));
      toast.success(`${allIds.length} registros selecionados`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao selecionar todos");
    } finally {
      setIsSelectingAll(false);
    }
  };

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (row: T) => {
    setEditing(row);
    setOpen(true);
  };

  const remove = async (id: string) => {
    if (!(await confirmDialog("Excluir este registro?"))) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: affected, error } = await (supabase as any)
      .from(table)
      .delete()
      .eq("id", id)
      .select("id");
    if (error) return toast.error(error.message);
    if (deniedIfUnaffected(affected)) return;
    toast.success("Removido");
    qc.invalidateQueries({ queryKey: [table] });
  };

  const bulkDelete = async () => {
    const ids = Array.from(selectedIds);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: affected, error } = await (supabase as any)
      .from(table)
      .delete()
      .in("id", ids)
      .select("id");
    if (error) return toast.error(error.message);
    if (deniedIfUnaffected(affected)) return;
    const removed = (affected as unknown[]).length;
    if (removed < ids.length) {
      toast.warning(`${removed} de ${ids.length} excluído(s). Verifique suas permissões.`);
    } else {
      toast.success(`${ids.length} excluído(s)`);
    }
    clearSel();
    qc.invalidateQueries({ queryKey: [table] });
  };

  const exportCsv = (rowsToExport?: T[]) => {
    const out = rowsToExport ?? filtered;
    if (!out.length) return toast.error("Nada para exportar");
    const csv = Papa.unparse(out as unknown as Record<string, unknown>[]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${table}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importCsv = async (file: File) => {
    if (!user) return;
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (res) => {
        const fieldNames = new Set(fields.map((f) => f.name));
        const rowsToInsert = res.data.map((r) => {
          const obj: Record<string, unknown> = { owner_id: user.id };
          for (const k of Object.keys(r)) if (fieldNames.has(k)) obj[k] = r[k] === "" ? null : r[k];
          return obj;
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any).from(table).insert(rowsToInsert);
        if (error) toast.error(error.message);
        else {
          toast.success(`${rowsToInsert.length} registros importados`);
          qc.invalidateQueries({ queryKey: [table] });
        }
      },
    });
  };

  // Inline edit
  const inlineUpdate = async (id: string, field: string, value: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from(table)
      .update({ [field]: value })
      .eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: [table] });
  };

  // Saved views
  const applyView = (sv: SavedView) => {
    setView({
      viewId: sv.id,
      filters: sv.filters ?? { type: "group", op: "and", conditions: [] },
      columnOrder: sv.column_order ?? null,
      sortBy: sv.sort_by ?? "created_at",
      sortDir: sv.sort_dir ?? "desc",
    });
  };
  const applyPreset = (p: (typeof presets)[number]) => {
    setView({
      viewId: p.id,
      filters: p.filters,
      columnOrder: p.column_order ?? null,
      sortBy: p.sort_by ?? "created_at",
      sortDir: p.sort_dir ?? "desc",
    });
  };
  const saveAsView = async () => {
    const name = prompt("Nome da view:");
    if (!name) return;
    const sv = await savedViews.create.mutateAsync({
      name,
      filters: view.filters,
      column_order: view.columnOrder ?? undefined,
      sort_by: view.sortBy,
      sort_dir: view.sortDir,
      is_shared: false,
    });
    setView({ ...view, viewId: sv.id });
    toast.success("View salva");
  };
  const updateCurrentView = async () => {
    if (!view.viewId || view.viewId.startsWith("preset:")) return;
    await savedViews.update.mutateAsync({
      id: view.viewId,
      patch: {
        filters: view.filters,
        column_order: view.columnOrder ?? undefined,
        sort_by: view.sortBy,
        sort_dir: view.sortDir,
      },
    });
    toast.success("View atualizada");
  };
  const deleteCurrentView = async () => {
    if (!view.viewId || view.viewId.startsWith("preset:")) return;
    if (!(await confirmDialog("Excluir esta view?"))) return;
    await savedViews.remove.mutateAsync(view.viewId);
    setView({
      viewId: null,
      filters: { type: "group", op: "and", conditions: [] },
      columnOrder: null,
      sortBy: "created_at",
      sortDir: "desc",
    });
  };

  // Apply default view on first load
  useEffect(() => {
    if (view.viewId === null && savedViews.data) {
      const def = savedViews.data.find((v) => v.is_default);
      if (def) applyView(def);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedViews.data]);

  const currentViewName = view.viewId
    ? view.viewId.startsWith("preset:")
      ? presets.find((p) => p.id === view.viewId)?.name
      : savedViews.data?.find((v) => v.id === view.viewId)?.name
    : "Todos";

  const filterFieldList =
    filterFields ??
    fields.map((f) => ({ name: f.name, label: f.label, type: f.type, options: f.options }));
  const allColumns = columns.map((c) => ({ key: String(c.key), label: c.label }));

  const selectedRows = filtered.filter((r) => selectedIds.has(r.id));
  const ids = Array.from(selectedIds);
  const hasSelection = ids.length > 0;
  const hasFilter = view.filters.conditions.length > 0;
  // Quando a tabela está no catálogo dinâmico, a edição em massa oferece
  // qualquer campo permitido da entidade (não só a lista fixa da tela).
  const dynamicBulkEntity = isBulkEditEntity(table) ? table : null;

  // Singular entity label for CTA ("Criar lead")
  const entitySingular =
    entitySingularLabel ??
    (
      {
        leads: "lead",
        contacts: "contato",
        companies: "empresa",
        deals: "negócio",
        activities: "registro",
      } as const
    )[table];

  // Quick-filter fields (select-type only)
  const quickFilterFields = filterFieldList.filter(
    (f) => f.type === "select" && f.options && f.options.length > 0,
  );
  const getQuickValue = (fname: string) => {
    const cond = view.filters.conditions.find(
      (c) => c.type === "condition" && c.field === fname && c.op === "eq",
    );
    return cond && cond.type === "condition" ? String(cond.value ?? "") : "";
  };
  const setQuickValue = (fname: string, value: string) => {
    const others = view.filters.conditions.filter(
      (c) => !(c.type === "condition" && c.field === fname && c.op === "eq"),
    );
    const next = value
      ? [...others, { type: "condition" as const, field: fname, op: "eq" as const, value }]
      : others;
    setView({ ...view, filters: { ...view.filters, conditions: next } });
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-sm p-4 sm:p-5">
      <PageHeader
        title={title}
        description={description}
        count={isLoading ? undefined : totalCount}
        actions={
          <>
            {csvEnabled && (
              <>
                <Button variant="outline" size="sm" onClick={() => exportCsv()}>
                  Exportar CSV
                </Button>
                <label className="inline-flex">
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])}
                  />
                  <span className="inline-flex items-center justify-center rounded-md border bg-background px-3 h-9 text-sm cursor-pointer hover:bg-muted">
                    Importar CSV
                  </span>
                </label>
              </>
            )}
            {toolbar}
            <Button size="default" onClick={openNew} className="shadow-sm">
              <Plus className="h-4 w-4 mr-1" /> Criar {entitySingular}
            </Button>
          </>
        }
      />

      {/* Saved views as tabs (HubSpot-style) */}
      <SavedViewsTabs
        presets={presets}
        savedViews={savedViews.data ?? []}
        currentViewId={view.viewId}
        onSelectAll={() =>
          setView({
            viewId: null,
            filters: { type: "group", op: "and", conditions: [] },
            columnOrder: null,
            sortBy: "created_at",
            sortDir: "desc",
          })
        }
        onApplyPreset={applyPreset}
        onApplyView={applyView}
        onAdd={saveAsView}
        onDeleteView={async (id) => {
          if (!(await confirmDialog("Excluir esta visualização?"))) return;
          await savedViews.remove.mutateAsync(id);
          if (view.viewId === id) {
            setView({
              viewId: null,
              filters: { type: "group", op: "and", conditions: [] },
              columnOrder: null,
              sortBy: "created_at",
              sortDir: "desc",
            });
          }
        }}
      />

      {hasSelection && (
        <BulkActionBar
          count={ids.length}
          onClear={clearSel}
          totalMatching={totalCount}
          onSelectAll={selectAllMatching}
          isSelectingAll={isSelectingAll}
        >
          <Button variant="outline" size="sm" onClick={() => exportCsv(selectedRows)}>
            Exportar selecionados
          </Button>
          {(dynamicBulkEntity || (bulkEditFields && bulkEditFields.length > 0)) && (
            <Button variant="outline" size="sm" onClick={() => setBulkEditOpen(true)}>
              Editar em massa
            </Button>
          )}

          {table !== "activities" && (
            <Button variant="outline" size="sm" onClick={() => setBulkActivityOpen(true)}>
              <ListTodo className="h-4 w-4 mr-1" /> Criar atividade
            </Button>
          )}
          {bulkActions?.(ids, selectedRows)}
          <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
            Excluir
          </Button>
        </BulkActionBar>
      )}

      {/* Quick filters row (HubSpot-style) */}
      {quickFilterFields.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3 pb-3 border-b">
          {quickFilterFields.map((qf) => {
            const v = getQuickValue(qf.name);
            const selected = qf.options?.find((o) => o.value === v);
            return (
              <DropdownMenu key={qf.name}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`text-primary font-medium ${v ? "bg-primary/10" : ""}`}
                  >
                    {qf.label}
                    {selected ? `: ${selected.label}` : ""} ▾
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 max-h-80 overflow-y-auto">
                  <DropdownMenuItem onClick={() => setQuickValue(qf.name, "")}>
                    Todos
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {qf.options?.map((o) => (
                    <DropdownMenuItem key={o.value} onClick={() => setQuickValue(qf.name, o.value)}>
                      {o.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })}
          <Button
            variant={hasFilter ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setFilterOpen(true)}
            className="ml-1"
          >
            <Filter className="h-4 w-4 mr-1" /> Filtros avançados
            {hasFilter ? ` (${view.filters.conditions.length})` : ""}
          </Button>
        </div>
      )}

      {/* Toolbar: views, columns, view-mode, search */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {view.viewId && !view.viewId.startsWith("preset:") && (
          <Button variant="outline" size="sm" onClick={updateCurrentView}>
            <Save className="h-4 w-4 mr-1" /> Salvar alterações
          </Button>
        )}

        {quickFilterFields.length === 0 && (
          <Button variant="outline" size="sm" onClick={() => setFilterOpen(true)}>
            <Filter className="h-4 w-4 mr-1" /> Filtros
            {hasFilter ? ` (${view.filters.conditions.length})` : ""}
          </Button>
        )}

        <Button variant="outline" size="sm" onClick={() => setColumnOpen(true)}>
          <Columns3 className="h-4 w-4 mr-1" /> Colunas
        </Button>

        {boardStages && boardStageField && (
          <div className="inline-flex rounded-md border">
            <Button
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-r-none"
              onClick={() => setViewMode("table")}
            >
              <ListIcon className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "board" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-l-none"
              onClick={() => setViewMode("board")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          {hasSelection && (
            <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
              {ids.length} selecionado{ids.length === 1 ? "" : "s"}
            </span>
          )}
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs h-9"
          />
        </div>
      </div>

      {hasFilter && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {view.filters.conditions.map(
            (c, i) =>
              c.type === "condition" && (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs"
                >
                  {conditionToLabel(c, filterFieldList.find((f) => f.name === c.field)?.label)}
                  <button
                    onClick={() =>
                      setView({
                        ...view,
                        filters: {
                          ...view.filters,
                          conditions: view.filters.conditions.filter((_, idx) => idx !== i),
                        },
                      })
                    }
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ),
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setView({ ...view, filters: { type: "group", op: "and", conditions: [] } })
            }
          >
            Limpar tudo
          </Button>
        </div>
      )}

      {viewMode === "board" && boardStages && boardStageField ? (
        <EntityBoard
          rows={filtered}
          table={table}
          stageField={boardStageField}
          stages={boardStages}
          detailPath={detailPath}
          selectable
          entityLabel={entitySingular}
          activityEntity={table === "activities" ? undefined : table}
          canDelete

          renderCard={(row) => (
            <div className="space-y-1">
              {visibleColumns.slice(0, 3).map((c) => (
                <div key={String(c.key)} className="text-sm">
                  {c.render
                    ? c.render(row)
                    : String((row as Record<string, unknown>)[c.key as string] ?? "—")}
                </div>
              ))}
            </div>
          )}
        />
      ) : (
        <div className="rounded-xl border border-border/60 bg-background overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent border-border/60">
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      allFilteredSelected ? true : someFilteredSelected ? "indeterminate" : false
                    }
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                {visibleColumns.map((c) => (
                  <TableHead
                    key={String(c.key)}
                    className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {c.label}
                  </TableHead>
                ))}
                <TableHead className="w-32 text-right whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Ações
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={visibleColumns.length + 2}
                    className="text-center text-muted-foreground py-8"
                  >
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={visibleColumns.length + 2}
                    className="text-center text-muted-foreground py-8"
                  >
                    Nenhum registro.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => {
                  const sel = selectedIds.has(row.id);
                  const href = detailPath ? detailPath(row.id) : null;
                  return (
                    <TableRow
                      key={row.id}
                      data-state={sel ? "selected" : undefined}
                      className={`h-12 border-border/50 transition-colors hover:bg-muted/40 ${href ? "cursor-pointer" : ""}`}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest("[data-no-row-click]")) return;
                        if (href) navigate({ to: href });
                      }}
                    >
                      <TableCell
                        className="py-0 whitespace-nowrap"
                        data-no-row-click
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox checked={sel} onCheckedChange={() => toggleOne(row.id)} />
                      </TableCell>
                      {visibleColumns.map((c, ci) => {
                        const k = String(c.key);
                        const editable = inlineEditable?.includes(k);
                        const isFirst = ci === 0;
                        const cellContent = editable ? (
                          <InlineCell
                            row={row}
                            field={k}
                            fieldDef={fields.find((f) => f.name === k)}
                            onSave={(v) => inlineUpdate(row.id, k, v)}
                          />
                        ) : c.render ? (
                          c.render(row)
                        ) : (
                          String((row as Record<string, unknown>)[k] ?? "—")
                        );
                        return (
                          <TableCell
                            key={k}
                            className="py-0 whitespace-nowrap truncate max-w-[280px]"
                            data-no-row-click={editable ? true : undefined}
                            onClick={editable ? (e) => e.stopPropagation() : undefined}
                          >
                            {isFirst ? (
                              <div className="flex items-center gap-2.5 min-w-0">
                                <RowAvatar label={avatarLabel(row, k, c.render)} />
                                <span
                                  className={
                                    href && !editable
                                      ? "text-primary font-medium hover:underline truncate"
                                      : "truncate"
                                  }
                                >
                                  {cellContent}
                                </span>
                              </div>
                            ) : (
                              cellContent
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell
                        className="py-0 text-right whitespace-nowrap"
                        data-no-row-click
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-0.5 flex-nowrap">
                          {rowActions?.(row)}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(row)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => remove(row.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {!isBoard && totalCount > 0 && (
        <TablePagination
          page={page}
          pageSize={pageSize}
          total={totalCount}
          isLoading={isLoading}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[25, 50, 100, 200]}
        />
      )}

      <EntityDialog
        key={editing?.id ?? "new"}
        open={open}
        setOpen={setOpen}
        table={table}
        fields={fields}
        editing={editing}
        defaults={defaults}
        onSaved={() => qc.invalidateQueries({ queryKey: [table] })}
      />

      {dynamicBulkEntity ? (
        <BulkEditFieldsDialog
          open={bulkEditOpen}
          setOpen={setBulkEditOpen}
          entity={dynamicBulkEntity}
          ids={ids}
          entityLabel={entitySingular}
          priorityFields={bulkEditFields?.map((f) => f.name)}
          onDone={() => {
            clearSel();
            qc.invalidateQueries({ queryKey: [table] });
          }}
        />
      ) : (
        bulkEditFields && (
          <BulkEditDialog
            open={bulkEditOpen}
            setOpen={setBulkEditOpen}
            table={table}
            ids={ids}
            fields={bulkEditFields}
            onDone={() => {
              clearSel();
              qc.invalidateQueries({ queryKey: [table] });
            }}
          />
        )
      )}

      <ConfirmCountDialog
        open={bulkDeleteOpen}
        setOpen={setBulkDeleteOpen}
        count={ids.length}
        entity={table}
        onConfirm={async () => {
          await bulkDelete();
        }}
      />
      {table !== "activities" && (
        <BulkCreateActivityDialog
          open={bulkActivityOpen}
          setOpen={setBulkActivityOpen}
          ids={ids}
          entity={table}
          onDone={() => {
            clearSel();
            qc.invalidateQueries({ queryKey: ["activities"] });
          }}
        />
      )}

      <FilterBuilderDialog
        open={filterOpen}
        setOpen={setFilterOpen}
        fields={filterFieldList}
        value={view.filters}
        onApply={(g) => setView({ ...view, filters: g })}
      />

      <ColumnEditorDialog
        open={columnOpen}
        setOpen={setColumnOpen}
        allColumns={allColumns}
        value={view.columnOrder}
        onApply={(order) => setView({ ...view, columnOrder: order })}
      />
    </div>
  );
}

function InlineCell<T extends { id: string }>({
  row,
  field,
  fieldDef,
  onSave,
}: {
  row: T;
  field: string;
  fieldDef?: Field;
  onSave: (v: unknown) => void;
}) {
  const initial = (row as Record<string, unknown>)[field];
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(initial ?? ""));

  const displayValue = (() => {
    if (initial == null || initial === "") return "—";
    if (fieldDef?.type === "select") {
      return fieldDef.options?.find((o) => o.value === String(initial))?.label ?? String(initial);
    }
    return String(initial);
  })();

  if (!editing) {
    return (
      <button
        className="text-left w-full hover:bg-muted px-2 py-1 rounded -mx-2 -my-1"
        onClick={() => setEditing(true)}
      >
        {displayValue}
      </button>
    );
  }

  if (fieldDef?.type === "select") {
    return (
      <select
        autoFocus
        className="h-8 rounded-md border bg-background px-2 text-sm w-full"
        value={val}
        onChange={(e) => {
          setVal(e.target.value);
          onSave(e.target.value || null);
          setEditing(false);
        }}
        onBlur={() => setEditing(false)}
      >
        <option value="">—</option>
        {fieldDef.options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  return (
    <Input
      autoFocus
      type={fieldDef?.type ?? "text"}
      className="h-8"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => {
        onSave(val === "" ? null : val);
        setEditing(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
        if (e.key === "Escape") setEditing(false);
      }}
    />
  );
}

function EntityDialog<T extends { id: string }>({
  open,
  setOpen,
  table,
  fields,
  editing,
  defaults,
  onSaved,
}: {
  open: boolean;
  setOpen: (b: boolean) => void;
  table: string;
  fields: Field[];
  editing: T | null;
  defaults?: Partial<T>;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const init: Record<string, unknown> = editing ? { ...editing } : { ...(defaults ?? {}) };
  const [values, setValues] = useState<Record<string, unknown>>(init);
  const [submitting, setSubmitting] = useState(false);
  const set = (k: string, v: unknown) => setValues((s) => ({ ...s, [k]: v }));

  const submit = async () => {
    if (!user || submitting) return;
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = { ...values };
      for (const f of fields) {
        if (payload[f.name] === "" || payload[f.name] === undefined) payload[f.name] = null;
        if (f.type === "number" && payload[f.name] != null)
          payload[f.name] = Number(payload[f.name]);
        if (f.type === "email" && payload[f.name] != null) {
          const v = String(payload[f.name]).trim();
          if (!isEmail(v)) {
            toast.error(`${f.label}: email inválido.`);
            setSubmitting(false);
            return;
          }
          payload[f.name] = v;
        }
      }
      payload.owner_id = user.id;
      let error;
      let affected: unknown[] | null = null;
      if (editing) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ({ data: affected, error } = await (supabase as any)
          .from(table)
          .update(payload)
          .eq("id", editing.id)
          .select("id"));
      } else {
        delete payload.id;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ({ error } = await (supabase as any).from(table).insert(payload));
      }
      if (error) {
        toast.error(error.message);
        return;
      }
      if (editing && deniedIfUnaffected(affected)) return;

      toast.success("Salvo");
      setOpen(false);
      onSaved();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <span />
      </DialogTrigger>
      <DialogContent className="max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar" : "Novo registro"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.name} className="space-y-1.5">
              <Label htmlFor={f.name}>
                {f.label}
                {f.required && <span className="text-destructive"> *</span>}
              </Label>
              {f.type === "html" ? (
                <RichHtmlEditor
                  value={String(values[f.name] ?? "")}
                  onChange={(v: string) => set(f.name, v)}
                  minHeight={140}
                />
              ) : f.type === "textarea" ? (
                <Textarea
                  id={f.name}
                  value={String(values[f.name] ?? "")}
                  onChange={(e) => set(f.name, e.target.value)}
                  rows={3}
                />
              ) : f.type === "select" ? (
                <select
                  id={f.name}
                  className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                  value={String(values[f.name] ?? "")}
                  onChange={(e) => set(f.name, e.target.value || null)}
                >
                  <option value="">—</option>
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === "email" ? (
                <EmailInput
                  id={f.name}
                  required={f.required}
                  value={String(values[f.name] ?? "")}
                  onChange={(v) => set(f.name, v)}
                />
              ) : (
                <Input
                  id={f.name}
                  type={f.type ?? "text"}
                  required={f.required}
                  value={String(values[f.name] ?? "")}
                  onChange={(e) => set(f.name, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RowAvatar({ label }: { label: string }) {
  // Extract initials from rendered string content (strip non-letters)
  const clean = (label ?? "").replace(/[^\p{L}\p{N} ]+/gu, " ").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  const initials = ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();

  // Stable color from string hash
  const hash = Array.from(clean).reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0);
  const hue = Math.abs(hash) % 360;
  const bg = `oklch(0.93 0.06 ${hue})`;
  const fg = `oklch(0.38 0.14 ${hue})`;

  return (
    <span
      aria-hidden
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums ring-1 ring-border/40"
      style={{ background: bg, color: fg }}
    >
      {initials}
    </span>
  );
}

function SavedViewsTabs({
  presets,
  savedViews,
  currentViewId,
  onSelectAll,
  onApplyPreset,
  onApplyView,
  onAdd,
  onDeleteView,
}: {
  presets: import("@/lib/saved-views").PresetView[];
  savedViews: import("@/lib/saved-views").SavedView[];
  currentViewId: string | null;
  onSelectAll: () => void;
  onApplyPreset: (p: import("@/lib/saved-views").PresetView) => void;
  onApplyView: (sv: import("@/lib/saved-views").SavedView) => void;
  onAdd: () => void;
  onDeleteView: (id: string) => void;
}) {
  const tabBase =
    "group inline-flex items-center gap-1.5 px-3 py-2 text-sm whitespace-nowrap border-b-2 transition-colors";
  const active = "border-primary text-primary font-medium";
  const inactive = "border-transparent text-muted-foreground hover:text-foreground";

  const allActive = currentViewId === null;

  return (
    <div className="flex items-center gap-1 mb-3 border-b overflow-x-auto -mx-1 px-1">
      <button onClick={onSelectAll} className={`${tabBase} ${allActive ? active : inactive}`}>
        Todos
      </button>
      {presets.map((p) => {
        const isActive = currentViewId === p.id;
        return (
          <button
            key={p.id}
            onClick={() => onApplyPreset(p)}
            className={`${tabBase} ${isActive ? active : inactive}`}
          >
            {p.name}
          </button>
        );
      })}
      {savedViews.map((sv) => {
        const isActive = currentViewId === sv.id;
        return (
          <div key={sv.id} className={`${tabBase} ${isActive ? active : inactive}`}>
            <button onClick={() => onApplyView(sv)} className="flex items-center gap-1">
              {sv.is_shared ? "🔗 " : ""}
              {sv.name}
              {sv.is_default ? " ⭐" : ""}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteView(sv.id);
              }}
              className="opacity-0 group-hover:opacity-100 hover:bg-muted rounded p-0.5"
              aria-label="Excluir visualização"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
      <button
        onClick={onAdd}
        className={`${tabBase} ${inactive} hover:text-primary`}
        title="Salvar visualização atual"
      >
        <Plus className="h-4 w-4" /> Adicionar visualização
      </button>
    </div>
  );
}

function avatarLabel<T extends { id: string }>(
  row: T,
  key: string,
  render?: (row: T) => ReactNode,
): string {
  const raw = (row as Record<string, unknown>)[key];
  if (typeof raw === "string" && raw.trim()) return raw;
  if (render) {
    const out = render(row);
    if (typeof out === "string") return out;
    if (typeof out === "number") return String(out);
  }
  return String(raw ?? "?");
}
