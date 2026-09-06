// Compositor inline da timeline: assunto, data/lembrete, responsável, corpo
// rico, anexos e botão de salvar.
// Extraído de `activity-timeline.tsx` sem mudança de comportamento.
import { FolderOpen, Paperclip, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichHtmlEditor } from "@/components/rich-html-editor";
import { REMINDER_OPTIONS } from "@/lib/activity-reminders";
import { ICONS, type LogKind, type TeamMember } from "@/components/activity/timeline-shared";

export function TimelineComposer({
  type,
  label,
  currentUserId,
  team,
  subject,
  onSubjectChange,
  body,
  onBodyChange,
  onMentionAdd,
  dueDate,
  onDueDateChange,
  remindBefore,
  onRemindBeforeChange,
  assigneeId,
  onAssigneeChange,
  pendingFiles,
  onPendingFilesChange,
  onOpenFileCenter,
  onClose,
  onSave,
}: {
  type: LogKind;
  label: string;
  currentUserId: string | undefined;
  team: TeamMember[];
  subject: string;
  onSubjectChange: (v: string) => void;
  body: string;
  onBodyChange: (v: string) => void;
  onMentionAdd: (m: TeamMember) => void;
  dueDate: string;
  onDueDateChange: (v: string) => void;
  remindBefore: string;
  onRemindBeforeChange: (v: string) => void;
  assigneeId: string;
  onAssigneeChange: (v: string) => void;
  pendingFiles: File[];
  onPendingFilesChange: (updater: (prev: File[]) => File[]) => void;
  onOpenFileCenter: () => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const schedulable = type === "task" || type === "call" || type === "meeting";

  return (
    <div className="border-t border-border/60 p-4 space-y-3 bg-muted/10">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="text-primary">{ICONS[type]}</span>
          {label}
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fechar compositor">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Assunto (opcional)"
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          className="flex-1 min-w-[200px]"
        />
        {schedulable && (
          <>
            <Input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => onDueDateChange(e.target.value)}
              className="w-56"
              aria-label={type === "task" ? "Vencimento" : "Data e hora"}
              title={type === "task" ? "Vencimento" : "Data e hora"}
            />
            <select
              value={remindBefore}
              onChange={(e) => onRemindBeforeChange(e.target.value)}
              disabled={!dueDate}
              className="h-9 rounded-md border bg-background px-3 text-sm disabled:opacity-50"
              aria-label="Lembrete"
              title="Lembrete"
            >
              <option value="none">Sem lembrete</option>
              {REMINDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </>
        )}
        {type === "task" && (
          <select
            value={assigneeId || currentUserId || ""}
            onChange={(e) => onAssigneeChange(e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
            aria-label="Atribuir tarefa para"
            title="Atribuir tarefa para"
          >
            {team.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.id === currentUserId ? " (você)" : ""}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="relative">
        <RichHtmlEditor
          value={body}
          onChange={onBodyChange}
          placeholder={
            type === "task"
              ? "Descreva a tarefa..."
              : "Descreva o que aconteceu... use @ para mencionar, arraste arquivos para anexar"
          }
          minHeight={96}
          mentions={team}
          onMentionAdd={onMentionAdd}
        />
      </div>
      {pendingFiles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pendingFiles.map((f, i) => (
            <Badge key={i} variant="secondary" className="gap-1">
              <Paperclip className="h-3 w-3" /> {f.name}
              <button
                onClick={() => onPendingFilesChange((p) => p.filter((_, idx) => idx !== i))}
                aria-label={`Remover ${f.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="flex justify-between items-center pt-3 border-t border-border/60">
        <div className="flex items-center gap-3">
          <label className="cursor-pointer text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length) onPendingFilesChange((p) => [...p, ...files]);
                e.target.value = "";
              }}
            />
            <Paperclip className="h-4 w-4" /> Anexar
          </label>
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            onClick={onOpenFileCenter}
          >
            <FolderOpen className="h-4 w-4" /> Centro de Arquivos
          </button>
        </div>
        <Button
          onClick={onSave}
          size="sm"
          className="rounded-xl shadow-md shadow-primary/20 font-semibold"
        >
          Salvar {label}
        </Button>
      </div>
    </div>
  );
}
