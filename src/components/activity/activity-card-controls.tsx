// Controles do cartão no padrão HubSpot: menu Ações e grade de campos da tarefa.
import { useState } from "react";
import { ChevronDown, Pin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RecurrenceControl } from "@/components/activity/recurrence-control";
import { ActivityDueDatePicker } from "@/components/activity/activity-date-time-picker";
import { reminderLabel, REMINDER_OPTIONS } from "@/lib/activity-reminders";
import {
  describeRecurrence,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TYPES,
  type RecurrenceRule,
} from "@/lib/activity-task-options";
import type { Activity } from "@/lib/db-types";
import type { TeamMember } from "@/components/activity/timeline-shared";

export function ActivityActionsMenu({
  activity: a,
  canEdit,
  onEdit,
  onRemove,
  onPatch,
  onFollowUp,
}: {
  activity: Activity;
  canEdit: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onPatch: (patch: Record<string, unknown>) => void;
  onFollowUp: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const pinned = !!(a as { pinned_at?: string | null }).pinned_at;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs font-semibold">
            Ações <ChevronDown className="ml-1 h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canEdit && <DropdownMenuItem onSelect={onEdit}>Editar</DropdownMenuItem>}
          <DropdownMenuItem
            onSelect={() => onPatch({ pinned_at: pinned ? null : new Date().toISOString() })}
          >
            {pinned ? "Desafixar" : "Fixar"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              const url = `${window.location.origin}${window.location.pathname}#activity-${a.id}`;
              void navigator.clipboard.writeText(url).then(() => toast.success("Link copiado"));
            }}
          >
            Copiar link
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onFollowUp}>Criar tarefa de acompanhamento</DropdownMenuItem>
          {canEdit && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onSelect={() => setConfirm(true)}>
                Excluir
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir atividade?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onRemove}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function PinnedMark({ activity }: { activity: Activity }) {
  if (!(activity as { pinned_at?: string | null }).pinned_at) return null;
  return <Pin className="h-3 w-3 text-primary" aria-label="Fixada" />;
}

const inlineSel =
  "h-8 rounded-md border-0 bg-transparent px-1 text-sm font-semibold text-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

export function TaskFieldsGrid({
  activity: a,
  team,
  disabled,
  onPatch,
}: {
  activity: Activity;
  team: TeamMember[];
  disabled: boolean;
  onPatch: (patch: Record<string, unknown>) => void;
}) {
  const rec = (a as { recurrence?: RecurrenceRule | null }).recurrence ?? null;
  const [editRec, setEditRec] = useState(false);
  const status = a.task_status ?? (a.completed ? "completed" : "not_started");
  const assigned = (a as { assigned_to?: string | null }).assigned_to ?? a.owner_id;
  const field = (label: string, node: React.ReactNode) => (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      {node}
    </div>
  );
  return (
    <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {field(
          "Data de vencimento",
          <ActivityDueDatePicker
            disabled={disabled}
            value={a.due_date}
            valueFormat="iso"
            onChange={(dueDate) => {
              if (dueDate !== a.due_date) onPatch({ due_date: dueDate });
            }}
            ariaLabel="Data de vencimento"
          />,
        )}
        {field(
          "Lembrete",
          <select
            className={inlineSel}
            disabled={disabled || !a.due_date}
            value={a.remind_before_minutes == null ? "none" : String(a.remind_before_minutes)}
            onChange={(e) =>
              onPatch({
                remind_before_minutes: e.target.value === "none" ? null : Number(e.target.value),
                reminder_sent_at: null,
              })
            }
            aria-label="Lembrete"
            title={reminderLabel(a.remind_before_minutes)}
          >
            <option value="none">Nenhum lembrete</option>
            {REMINDER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>,
        )}
      </div>
      {editRec && !disabled ? (
        <div className="space-y-2">
          <RecurrenceControl
            idPrefix={`rec-${a.id}`}
            value={rec}
            onChange={(r) =>
              onPatch({ recurrence: r ? { ...r, occurrence: rec?.occurrence ?? 1 } : null })
            }
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setEditRec(false)}
          >
            Concluir
          </Button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setEditRec(true)}
          className="text-sm text-muted-foreground hover:text-foreground disabled:hover:text-muted-foreground"
        >
          {rec ? `Repete: ${describeRecurrence(rec)}` : "Definido para repetir: não"}
        </button>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-border/60 pt-3">
        {field(
          "Fase da tarefa",
          <select
            className={inlineSel}
            disabled={disabled}
            value={status}
            onChange={(e) =>
              onPatch({ task_status: e.target.value, completed: e.target.value === "completed" })
            }
            aria-label="Fase da tarefa"
          >
            {TASK_STATUSES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>,
        )}
        {field(
          "Tipo de tarefa",
          <select
            className={inlineSel}
            disabled={disabled}
            value={a.task_type ?? "todo"}
            onChange={(e) => onPatch({ task_type: e.target.value })}
            aria-label="Tipo de tarefa"
          >
            {TASK_TYPES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>,
        )}
        {field(
          "Prioridade",
          <select
            className={inlineSel}
            disabled={disabled}
            value={a.task_priority ?? "none"}
            onChange={(e) =>
              onPatch({ task_priority: e.target.value === "none" ? null : e.target.value })
            }
            aria-label="Prioridade"
          >
            {TASK_PRIORITIES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>,
        )}
        {field(
          "Atribuído a",
          <select
            className={inlineSel}
            disabled={disabled}
            value={assigned ?? ""}
            onChange={(e) => onPatch({ assigned_to: e.target.value })}
            aria-label="Atribuído a"
          >
            {team.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>,
        )}
      </div>
    </div>
  );
}
