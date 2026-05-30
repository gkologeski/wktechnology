import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type Stage = { value: string; label: string };

export function StageTracker({
  stages, current, onChange, disabled, activeClassName,
}: {
  stages: Stage[];
  current: string;
  onChange?: (v: string) => void;
  disabled?: boolean;
  activeClassName?: string;
}) {
  const idx = Math.max(0, stages.findIndex((s) => s.value === current));
  return (
    <div className="flex items-stretch w-full overflow-x-auto rounded-lg border bg-card">
      {stages.map((s, i) => {
        const passed = i < idx;
        const active = i === idx;
        return (
          <button
            key={s.value}
            disabled={disabled}
            onClick={() => onChange?.(s.value)}
            className={cn(
              "flex-1 min-w-[110px] px-3 py-2 text-xs font-medium border-r last:border-r-0 transition-colors text-left",
              active && (activeClassName ?? "bg-slate-700 text-white"),
              passed && "bg-muted text-foreground hover:bg-slate-700 hover:text-white",
              !active && !passed && "text-muted-foreground hover:bg-slate-700 hover:text-white",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <div className="flex items-center gap-1">
              {passed && <Check className="h-3 w-3" />}
              <span>{i + 1}. {s.label}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
