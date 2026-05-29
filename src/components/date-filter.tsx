import { Input } from "@/components/ui/input";
import {
  DATE_PRESET_OPTIONS,
  type CustomRange,
  type DatePreset,
} from "@/lib/date-presets";

export function DateFilter({
  name,
  value,
  custom,
  onChange,
}: {
  name: string;
  value: DatePreset;
  custom: CustomRange;
  onChange: (next: { value: DatePreset; custom: CustomRange }) => void;
}) {
  return (
    <div className="space-y-0.5">
      {DATE_PRESET_OPTIONS.map(([v, label]) => (
        <div key={v}>
          <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
            <input
              type="radio"
              name={name}
              checked={value === v}
              onChange={() => onChange({ value: v, custom })}
              className="h-3.5 w-3.5 accent-primary"
            />
            <span>{label}</span>
          </label>
          {v === "custom" && value === "custom" && (
            <div className="mt-1 ml-6 space-y-1.5 pb-1">
              <div className="flex items-center gap-2">
                <span className="w-10 text-xs text-muted-foreground">De</span>
                <Input
                  type="date"
                  value={custom.start ?? ""}
                  onChange={(e) =>
                    onChange({
                      value: "custom",
                      custom: { ...custom, start: e.target.value || undefined },
                    })
                  }
                  className="h-7 text-xs"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-10 text-xs text-muted-foreground">Até</span>
                <Input
                  type="date"
                  value={custom.end ?? ""}
                  onChange={(e) =>
                    onChange({
                      value: "custom",
                      custom: { ...custom, end: e.target.value || undefined },
                    })
                  }
                  className="h-7 text-xs"
                />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
