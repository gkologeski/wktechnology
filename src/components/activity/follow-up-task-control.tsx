// "Criar uma tarefa de [tipo] para acompanhar [quando]".
import { Checkbox } from "@/components/ui/checkbox";
import { ActivityDateTimePicker } from "@/components/activity/activity-date-time-picker";
import {
  FOLLOW_UP_PRESETS,
  followUpLabel,
  TASK_TYPES,
  type FollowUpPreset,
} from "@/lib/activity-task-options";

export type FollowUpState = {
  enabled: boolean;
  taskType: string;
  preset: FollowUpPreset;
  custom: string;
};
export const DEFAULT_FOLLOW_UP: FollowUpState = {
  enabled: false,
  taskType: "todo",
  preset: "bd3",
  custom: "",
};

const selectCls =
  "h-8 rounded-md border-0 bg-transparent px-1 text-sm font-semibold text-foreground focus-visible:ring-2 focus-visible:ring-ring";

export function FollowUpTaskControl({
  value,
  onChange,
}: {
  value: FollowUpState;
  onChange: (v: FollowUpState) => void;
}) {
  const set = (p: Partial<FollowUpState>) => onChange({ ...value, ...p });
  return (
    <div className="flex items-start gap-2 text-sm">
      <Checkbox
        id="follow-up-on"
        checked={value.enabled}
        onCheckedChange={(c) => set({ enabled: !!c })}
        className="mt-1.5"
        aria-label="Criar tarefa de acompanhamento"
      />
      <div className="flex flex-wrap items-center gap-x-1 text-muted-foreground">
        <label htmlFor="follow-up-on">Criar uma tarefa de</label>
        <select
          className={selectCls}
          value={value.taskType}
          onChange={(e) => set({ taskType: e.target.value, enabled: true })}
          aria-label="Tipo da tarefa de acompanhamento"
        >
          {TASK_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <span>para acompanhar</span>
        <select
          className={selectCls}
          value={value.preset}
          onChange={(e) => set({ preset: e.target.value as FollowUpPreset, enabled: true })}
          aria-label="Vencimento da tarefa de acompanhamento"
        >
          {FOLLOW_UP_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {followUpLabel(p.value)}
            </option>
          ))}
        </select>
        {value.preset === "custom" && (
          <ActivityDateTimePicker
            value={value.custom}
            onChange={(custom) => set({ custom: custom ?? "" })}
            className="w-64"
            ariaLabel="Data personalizada do acompanhamento"
          />
        )}
      </div>
    </div>
  );
}
