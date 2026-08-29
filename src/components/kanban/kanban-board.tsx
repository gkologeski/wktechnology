// Board Kanban reutilizável para telas de lista com coluna de etapa/status.
// Suporta drag-and-drop, alternativa acessível ("Mover para..."), modo somente
// leitura (status derivado por regra de negócio/integração) e guarda de RBAC.
// A RLS continua sendo a fonte de verdade: usamos `.select()` no update para
// detectar bloqueios silenciosos.
import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MoreVertical } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { KanbanScrollContainer } from "@/components/kanban/kanban-scroll-container";
import { Checkbox } from "@/components/ui/checkbox";
import { BoardCardCheckbox } from "@/components/kanban/board-card-checkbox";
import { useBoardSelection } from "@/components/kanban/use-board-selection";
import { GridBulkBar } from "@/components/grid/grid-bulk-bar";
import type { BulkField } from "@/components/bulk-edit-dialog";

import { deniedIfUnaffected } from "@/lib/access-control/rls-denied";

export type KanbanColumn = {
  value: string;
  label: string;
  /** Classe de token semântico para o "dot" da coluna (ex.: "bg-primary"). */
  tone?: string;
};

export type KanbanBoardProps<T extends { id: string }> = {
  rows: T[];
  /** Tabela usada no update de etapa. Ignorada quando `readOnly` ou `onMove`. */
  table: string;
  /** Coluna de etapa/status na tabela. */
  stageField: string;
  columns: KanbanColumn[];
  renderCard: (row: T) => ReactNode;
  /** Chaves de cache a invalidar após mover um card. */
  invalidateKeys?: readonly unknown[][];
  /** Status derivado por regra de negócio/integração — apenas leitura. */
  readOnly?: boolean;
  /** Guarda de RBAC na UI; a RLS ainda valida no banco. */
  canUpdate?: boolean;
  /**
   * Update customizado da etapa (ex.: server function com regras próprias).
   * Quando informado, substitui o update direto na tabela.
   */
  onMove?: (id: string, stage: string) => Promise<void> | void;
  isLoading?: boolean;
  error?: unknown;
  emptyState?: ReactNode;
  ariaLabel?: string;
  /** Habilita seleção de cards + ações em massa (mesma barra dos grids). */
  selectable?: boolean;
  /** Rótulo singular da entidade usado nos diálogos em massa. */
  entityLabel?: string;
  /** Coluna de responsável para atribuição em massa (`null` desabilita). */
  assignColumn?: string | null;
  /** Entidade CRM para criação de atividade em massa. */
  activityEntity?: "leads" | "contacts" | "deals" | "companies";
  /** Guarda de RBAC na UI para exclusão em massa. */
  canDelete?: boolean;
  /** Rótulo para cada card na seleção (acessibilidade). */
  cardLabel?: (row: T) => string;
  /**
   * Campos fixos para edição em massa. Necessário apenas quando a tabela não
   * está no catálogo dinâmico (`BULK_EDIT_ENTITIES`).
   */
  bulkEditFields?: BulkField[];
};


export function KanbanBoard<T extends { id: string }>({
  rows,
  table,
  stageField,
  columns,
  renderCard,
  invalidateKeys,
  readOnly = false,
  canUpdate = true,
  onMove,
  isLoading = false,
  error,
  emptyState,
  ariaLabel = "Quadro Kanban",
  selectable = false,
  entityLabel = "registro",
  assignColumn = "assigned_to",
  activityEntity,
  canDelete = false,
  cardLabel,
  bulkEditFields,

}: KanbanBoardProps<T>) {
  const qc = useQueryClient();
  const selection = useBoardSelection(rows);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  const draggable = !readOnly && canUpdate;

  const invalidate = () => {
    const keys = invalidateKeys?.length ? invalidateKeys : [[table]];
    keys.forEach((key) => void qc.invalidateQueries({ queryKey: key }));
  };

  const moveTo = async (id: string, stage: string) => {
    if (!draggable) return;
    const current = rows.find((r) => r.id === id) as Record<string, unknown> | undefined;
    if (current && current[stageField] === stage) return;
    setMovingId(id);
    try {
      if (onMove) {
        await onMove(id, stage);
        return;
      }
      // Cast do client inteiro: `table` é dinâmico e a inferência de tipos do
      // supabase-js por string literal fica proibitivamente lenta aqui.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: err } = await (supabase as any)
        .from(table)
        .update({ [stageField]: stage })
        .eq("id", id)
        .select("id");
      if (err) {
        toast.error(err.message);
        return;
      }
      if (deniedIfUnaffected(data, "mover este registro")) return;
      toast.success("Etapa atualizada");
      invalidate();
    } finally {
      setMovingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-hidden pb-4">
        {columns.slice(0, 5).map((c) => (
          <div
            key={c.value}
            className="w-[260px] flex-shrink-0 space-y-2 rounded-lg border bg-muted/30 p-2"
          >
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <p className="text-sm font-medium">Não foi possível carregar o quadro</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Tente recarregar a página."}
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={invalidate}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (rows.length === 0 && emptyState) {
    return <div className="rounded-lg border bg-card">{emptyState}</div>;
  }

  return (
    <>
      <KanbanScrollContainer ariaLabel={ariaLabel}>
        <div className="flex gap-3 pb-4">
          {columns.map((col) => {
            const stageRows = rows.filter(
              (r) => (r as Record<string, unknown>)[stageField] === col.value,
            );
            const columnIds = stageRows.map((r) => r.id);
            const allColumnSelected =
              columnIds.length > 0 && columnIds.every((id) => selection.isSelected(id));
            return (
              <div
                key={col.value}
                data-kanban-column-root={col.value}
                className="w-[280px] min-w-[280px] flex-shrink-0 rounded-lg border bg-muted/30 p-2"
                onDragOver={(e) => {
                  if (draggable) e.preventDefault();
                }}
                onDrop={(e) => {
                  if (!draggable) return;
                  e.preventDefault();
                  if (draggingId) void moveTo(draggingId, col.value);
                  setDraggingId(null);
                }}
              >
                <div className="mb-2 flex items-center justify-between gap-2 px-2 py-1">
                  <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                    {selectable && columnIds.length > 0 && (
                      <Checkbox
                        checked={allColumnSelected}
                        aria-label={`Selecionar coluna ${col.label}`}
                        onCheckedChange={() => selection.toggleMany(columnIds)}
                      />
                    )}
                    <span
                      aria-hidden="true"
                      className={`h-2 w-2 shrink-0 rounded-full ${col.tone ?? "bg-muted-foreground/40"}`}
                    />
                    <span className="truncate">{col.label}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{stageRows.length}</span>
                </div>

                <div className="space-y-2">
                  {stageRows.map((row) => (
                    <Card
                      key={row.id}
                      draggable={draggable}
                      tabIndex={0}
                      data-kanban-card
                      data-kanban-column={col.value}
                      onDragStart={() => draggable && setDraggingId(row.id)}
                      onDragEnd={() => setDraggingId(null)}
                      className={`group relative p-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        draggable ? "cursor-grab active:cursor-grabbing" : ""
                      } ${movingId === row.id ? "opacity-60" : ""} ${
                        selection.isSelected(row.id) ? "ring-2 ring-primary" : ""
                      }`}
                    >
                      {draggable && columns.length > 1 && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute right-1 top-1 h-6 w-6 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                              aria-label="Mover para outra etapa"
                            >
                              <MoreVertical className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Mover para</DropdownMenuLabel>
                            {columns
                              .filter((c) => c.value !== col.value)
                              .map((c) => (
                                <DropdownMenuItem
                                  key={c.value}
                                  onSelect={() => void moveTo(row.id, c.value)}
                                >
                                  {c.label}
                                </DropdownMenuItem>
                              ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      {selectable ? (
                        <div className="flex items-start gap-2">
                          <BoardCardCheckbox
                            selected={selection.isSelected(row.id)}
                            label={`Selecionar ${cardLabel?.(row) ?? entityLabel}`}
                            onToggle={(shift) => selection.toggle(row.id, { columnIds, shift })}
                          />
                          <div className="min-w-0 flex-1">{renderCard(row)}</div>
                        </div>
                      ) : (
                        renderCard(row)
                      )}
                    </Card>
                  ))}
                  {stageRows.length === 0 && (
                    <p className="px-2 py-4 text-center text-xs text-muted-foreground">Vazio</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </KanbanScrollContainer>

      {selectable && selection.hasSelection && (
        <GridBulkBar
          table={table}
          ids={selection.ids}
          rows={selection.selectedRows}
          entityLabel={entityLabel}
          assignColumn={assignColumn}
          activityEntity={activityEntity}
          canUpdate={canUpdate}
          canDelete={canDelete}
          bulkEditFields={bulkEditFields}

          onClear={selection.clear}
          onDone={invalidate}
        />
      )}
    </>
  );
}
