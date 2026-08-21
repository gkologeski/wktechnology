// Barra de ações em massa padrão para grids (Fase 0 do padrão de grids).
// Reúne: exportar CSV, editar em massa, atribuir responsável, criar atividade
// e excluir com confirmação por contagem — tudo respeitando RBAC/RLS.
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import Papa from "papaparse";
import { ListTodo, UserCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BulkActionBar } from "@/components/bulk-action-bar";
import { BulkEditDialog, type BulkField } from "@/components/bulk-edit-dialog";
import { BulkEditFieldsDialog } from "@/components/grid/bulk-edit-fields-dialog";
import { BulkAssignDialog } from "@/components/bulk-assign-dialog";
import { ConfirmCountDialog } from "@/components/confirm-count-dialog";
import { BulkCreateActivityDialog } from "@/components/bulk-create-activity-dialog";
import { deniedIfUnaffected } from "@/lib/access-control/rls-denied";
import { isBulkEditEntity } from "@/lib/grid/bulk-edit-fields";

export type GridBulkBarProps<T extends { id: string }> = {
  table: string;
  ids: string[];
  rows: T[];
  entityLabel: string;
  onClear: () => void;
  /** Chamado após qualquer mutação em massa concluída. */
  onDone: () => void;
  totalMatching?: number;
  onSelectAll?: () => void;
  isSelectingAll?: boolean;
  /** Campos disponíveis para edição em massa. Omitir desabilita a ação. */
  bulkEditFields?: BulkField[];
  /** Coluna de responsável; omitir desabilita a atribuição em massa. */
  assignColumn?: string | null;
  /** Entidade CRM para criação de atividade em massa. */
  activityEntity?: "leads" | "contacts" | "deals" | "companies";
  /** Permissões da UI (a RLS continua sendo a fonte de verdade). */
  canUpdate?: boolean;
  canDelete?: boolean;
  csvEnabled?: boolean;
  /** Ações extras específicas da tela. */
  extraActions?: ReactNode;
};

export function GridBulkBar<T extends { id: string }>({
  table,
  ids,
  rows,
  entityLabel,
  onClear,
  onDone,
  totalMatching,
  onSelectAll,
  isSelectingAll,
  bulkEditFields,
  assignColumn = "assigned_to",
  activityEntity,
  canUpdate = true,
  canDelete = true,
  csvEnabled = true,
  extraActions,
}: GridBulkBarProps<T>) {
  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const exportCsv = () => {
    if (!rows.length) return toast.error("Nada para exportar");
    const csv = Papa.unparse(rows as unknown as Record<string, unknown>[]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${table}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const bulkDelete = async () => {
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
      toast.success(`${removed.toLocaleString("pt-BR")} excluído(s)`);
    }
    onClear();
    onDone();
  };

  return (
    <>
      <BulkActionBar
        count={ids.length}
        onClear={onClear}
        totalMatching={totalMatching}
        onSelectAll={onSelectAll}
        isSelectingAll={isSelectingAll}
      >
        {csvEnabled && (
          <Button variant="outline" size="sm" onClick={exportCsv}>
            Exportar selecionados
          </Button>
        )}
        {canUpdate && bulkEditFields && bulkEditFields.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            Editar em massa
          </Button>
        )}
        {canUpdate && assignColumn && (
          <Button variant="outline" size="sm" onClick={() => setAssignOpen(true)}>
            <UserCircle2 className="mr-1 h-4 w-4" /> Responsável
          </Button>
        )}
        {activityEntity && (
          <Button variant="outline" size="sm" onClick={() => setActivityOpen(true)}>
            <ListTodo className="mr-1 h-4 w-4" /> Criar atividade
          </Button>
        )}
        {extraActions}
        {canDelete && (
          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
            Excluir
          </Button>
        )}
      </BulkActionBar>

      {bulkEditFields && bulkEditFields.length > 0 && (
        <BulkEditDialog
          open={editOpen}
          setOpen={setEditOpen}
          table={table}
          ids={ids}
          fields={bulkEditFields}
          onDone={() => {
            onClear();
            onDone();
          }}
        />
      )}

      {assignColumn && (
        <BulkAssignDialog
          open={assignOpen}
          setOpen={setAssignOpen}
          table={table}
          ids={ids}
          column={assignColumn}
          onDone={() => {
            onClear();
            onDone();
          }}
        />
      )}

      {activityEntity && (
        <BulkCreateActivityDialog
          open={activityOpen}
          setOpen={setActivityOpen}
          ids={ids}
          entity={activityEntity}
          onDone={() => {
            onClear();
            onDone();
          }}
        />
      )}

      <ConfirmCountDialog
        open={deleteOpen}
        setOpen={setDeleteOpen}
        count={ids.length}
        entity={entityLabel}
        onConfirm={async () => {
          await bulkDelete();
        }}
      />
    </>
  );
}
