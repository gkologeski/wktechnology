// Adaptador do seletor oficial de período para telas que guardam as datas
// como strings ISO (YYYY-MM-DD) — substitui pares de <input type="date">.
import { DateRangePicker } from "@/components/date-range-picker";
import type { PresetKey } from "@/lib/date-presets";

export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseIsoDay(v?: string): Date | undefined {
  if (!v) return undefined;
  const [y, m, d] = v.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

export function IsoDateRangePicker({
  from,
  to,
  onChange,
  onClear,
  placeholder,
  defaultPreset = "last30",
  className,
  ariaLabel,
  size = "default",
  align = "start",
}: {
  from?: string;
  to?: string;
  onChange: (range: { from: string; to: string }) => void;
  /** Quando informado, o seletor oferece ação para limpar o período. */
  onClear?: () => void;
  placeholder?: string;
  defaultPreset?: PresetKey;
  className?: string;
  ariaLabel?: string;
  size?: "sm" | "default";
  align?: "start" | "center" | "end";
}) {
  const f = parseIsoDay(from);
  const t = parseIsoDay(to);
  return (
    <DateRangePicker
      className={className}
      align={align}
      size={size}
      ariaLabel={ariaLabel}
      placeholder={placeholder}
      defaultPreset={defaultPreset}
      onClear={onClear}
      value={f && t ? { from: f, to: t } : undefined}
      onChange={(r) => onChange({ from: isoDay(r.from), to: isoDay(r.to) })}
    />
  );
}
