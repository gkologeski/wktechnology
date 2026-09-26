// "Definido para repetir" — regra de repetição de tarefas.
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  RECURRENCE_FREQUENCIES,
  type RecurrenceFrequency,
  type RecurrenceRule,
} from "@/lib/activity-task-options";

const DEFAULT_RULE: RecurrenceRule = { frequency: "weekly", interval: 1, ends: "never" };
const selectCls = "h-9 rounded-md border bg-background px-2 text-sm";

export function RecurrenceControl({
  value,
  onChange,
  idPrefix = "rec",
}: {
  value: RecurrenceRule | null;
  onChange: (r: RecurrenceRule | null) => void;
  idPrefix?: string;
}) {
  const on = !!value;
  const r = value ?? DEFAULT_RULE;
  const set = (patch: Partial<RecurrenceRule>) => onChange({ ...r, ...patch });
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm text-foreground" htmlFor={`${idPrefix}-on`}>
        <Checkbox
          id={`${idPrefix}-on`}
          checked={on}
          onCheckedChange={(c) => onChange(c ? DEFAULT_RULE : null)}
        />
        Definido para repetir
      </label>
      {on && (
        <div className="flex flex-wrap items-center gap-2 pl-6 text-sm">
          <span className="text-muted-foreground">A cada</span>
          <Input
            type="number"
            min={1}
            value={r.interval}
            onChange={(e) => set({ interval: Math.max(1, Number(e.target.value) || 1) })}
            className="h-9 w-16"
            aria-label="Intervalo de repetição"
          />
          <select
            className={selectCls}
            value={r.frequency}
            onChange={(e) => set({ frequency: e.target.value as RecurrenceFrequency })}
            aria-label="Frequência"
          >
            {RECURRENCE_FREQUENCIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.unit}
              </option>
            ))}
          </select>
          <select
            className={selectCls}
            value={r.ends}
            onChange={(e) => set({ ends: e.target.value as RecurrenceRule["ends"] })}
            aria-label="Término da repetição"
          >
            <option value="never">Sem término</option>
            <option value="on_date">Termina em</option>
            <option value="after">Após N ocorrências</option>
          </select>
          {r.ends === "on_date" && (
            <Input
              type="date"
              value={r.end_date ?? ""}
              onChange={(e) => set({ end_date: e.target.value || null })}
              className="h-9 w-40"
              aria-label="Data de término"
            />
          )}
          {r.ends === "after" && (
            <Input
              type="number"
              min={1}
              value={r.count ?? 1}
              onChange={(e) => set({ count: Math.max(1, Number(e.target.value) || 1) })}
              className="h-9 w-20"
              aria-label="Número de ocorrências"
            />
          )}
        </div>
      )}
    </div>
  );
}
