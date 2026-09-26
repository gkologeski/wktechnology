// Formulário de edição inline de uma atividade da timeline: corpo, responsável
// e vencimento (tarefas) e anexos.
// Extraído de `activity-timeline.tsx` sem mudança de comportamento.
import { Check, FolderOpen, Paperclip, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActivityDueDatePicker } from "@/components/activity/activity-date-time-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichHtmlEditor } from "@/components/rich-html-editor";
import type { Activity } from "@/lib/db-types";
import { type Attachment, type TeamMember } from "@/components/activity/timeline-shared";

export function ActivityEditForm({
  activity: a,
  team,
  body,
  onBodyChange,
  assigneeId,
  onAssigneeChange,
  dueDate,
  onDueDateChange,
  attachments,
  onAttachmentsChange,
  newFiles,
  onNewFilesChange,
  onOpenFileCenter,
  onSave,
  onCancel,
}: {
  activity: Activity;
  team: TeamMember[];
  body: string;
  onBodyChange: (v: string) => void;
  assigneeId: string | null;
  onAssigneeChange: (v: string | null) => void;
  dueDate: string | null;
  onDueDateChange: (v: string | null) => void;
  attachments: Attachment[];
  onAttachmentsChange: (updater: (prev: Attachment[]) => Attachment[]) => void;
  newFiles: File[];
  onNewFilesChange: (updater: (prev: File[]) => File[]) => void;
  onOpenFileCenter: () => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-2 space-y-2">
      <RichHtmlEditor value={body} onChange={onBodyChange} minHeight={120} mentions={team} />
      {a.type === "task" && (
        <div className="space-y-3 rounded-md border bg-muted/30 p-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Responsável</label>
            <Select value={assigneeId ?? ""} onValueChange={(v) => onAssigneeChange(v || null)}>
              <SelectTrigger className="h-9 text-xs w-full">
                <SelectValue placeholder="Selecionar responsável" />
              </SelectTrigger>
              <SelectContent>
                {team.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Data de vencimento</label>
            <ActivityDueDatePicker
              value={dueDate}
              valueFormat="iso"
              onChange={onDueDateChange}
              ariaLabel="Data de vencimento"
            />
          </div>
        </div>
      )}

      {(attachments.length > 0 || newFiles.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((att, i) => (
            <Badge key={`ex-${i}`} variant="secondary" className="gap-1">
              <Paperclip className="h-3 w-3" /> {att.name}
              <button onClick={() => onAttachmentsChange((p) => p.filter((_, idx) => idx !== i))}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {newFiles.map((f, i) => (
            <Badge key={`new-${i}`} variant="secondary" className="gap-1">
              <Paperclip className="h-3 w-3" /> {f.name}
              <button onClick={() => onNewFilesChange((p) => p.filter((_, idx) => idx !== i))}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <label className="cursor-pointer text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length) onNewFilesChange((p) => [...p, ...files]);
                e.target.value = "";
              }}
            />
            <Paperclip className="h-3 w-3" /> Anexar
          </label>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            onClick={onOpenFileCenter}
          >
            <FolderOpen className="h-3 w-3" /> Centro de Arquivos
          </button>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={onSave}>
            <Check className="h-3 w-3 mr-1" /> Salvar
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}
