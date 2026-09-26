// Campos adicionais do compositor no padrão HubSpot: Contatado, Data da atividade,
// campos de tarefa (tipo, prioridade, fase, repetição) e acompanhamento.
import { ContactedPicker } from "@/components/activity/contacted-picker";
import { ActivityDateTimePicker } from "@/components/activity/activity-date-time-picker";
import { RecurrenceControl } from "@/components/activity/recurrence-control";
import {
  FollowUpTaskControl,
  type FollowUpState,
} from "@/components/activity/follow-up-task-control";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TYPES,
  type RecurrenceRule,
} from "@/lib/activity-task-options";
import type { LogKind } from "@/components/activity/timeline-shared";

export type ComposerExtrasState = {
  contactedIds: string[];
  activityDate: string;
  taskType: string;
  priority: string;
  status: string;
  recurrence: RecurrenceRule | null;
  followUp: FollowUpState;
};

export function nowLocalInput(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

const selectCls = "h-9 w-full rounded-md border bg-background px-2 text-sm";

export function ComposerTopFields({
  type,
  value,
  onChange,
  defaultContactId,
}: {
  type: LogKind;
  value: ComposerExtrasState;
  onChange: (p: Partial<ComposerExtrasState>) => void;
  defaultContactId?: string;
}) {
  if (type === "task" || type === "note") return null;
  return (
    <div className="flex flex-wrap items-end gap-6 border-b border-border/60 pb-3">
      <ContactedPicker
        value={value.contactedIds}
        onChange={(ids) => onChange({ contactedIds: ids })}
        defaultContactId={defaultContactId}
      />
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Data da atividade</span>
        <ActivityDateTimePicker
          value={value.activityDate}
          onChange={(activityDate) => onChange({ activityDate: activityDate ?? "" })}
          optional={false}
          ariaLabel="Data da atividade"
          className="w-[18rem]"
        />
      </label>
    </div>
  );
}

export function ComposerTaskFields({
  value,
  onChange,
}: {
  value: ComposerExtrasState;
  onChange: (p: Partial<ComposerExtrasState>) => void;
}) {
  const sel = (
    label: string,
    key: "taskType" | "priority" | "status",
    list: readonly { value: string; label: string }[],
  ) => (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <select
        className={selectCls}
        value={value[key]}
        onChange={(e) => onChange({ [key]: e.target.value } as Partial<ComposerExtrasState>)}
      >
        {list.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {sel("Tipo de tarefa", "taskType", TASK_TYPES)}
        {sel("Prioridade", "priority", TASK_PRIORITIES)}
        {sel("Fase da tarefa", "status", TASK_STATUSES)}
      </div>
      <RecurrenceControl value={value.recurrence} onChange={(r) => onChange({ recurrence: r })} />
    </div>
  );
}

export function ComposerFollowUp({
  value,
  onChange,
}: {
  value: ComposerExtrasState;
  onChange: (p: Partial<ComposerExtrasState>) => void;
}) {
  return (
    <div className="border-t border-border/60 pt-3">
      <FollowUpTaskControl value={value.followUp} onChange={(f) => onChange({ followUp: f })} />
    </div>
  );
}
