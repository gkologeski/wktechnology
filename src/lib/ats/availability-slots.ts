export type WeeklyWindow = {
  interviewer_id: string;
  weekday: number;
  start_minute: number;
  end_minute: number;
  timezone: string;
};
export type BusyInterval = { interviewer_id: string; starts_at: string; ends_at: string };

/** Local weekly windows stay in their IANA zone; UTC is used only for instants. */
export function commonAvailabilitySlots(
  ids: string[],
  windows: WeeklyWindow[],
  busy: BusyInterval[],
  from: string,
  to: string,
  duration: number,
  step: number,
): string[] {
  const start = Date.parse(from),
    end = Date.parse(to),
    minute = 60_000;
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end <= start ||
    end - start > 31 * 86400_000 ||
    duration < 15 ||
    duration > 240 ||
    step < 15 ||
    step > 120
  )
    throw new Error("Intervalo de agenda inválido (máximo 31 dias).");
  const formatters = new Map<string, Intl.DateTimeFormat>();
  const parts = (instant: number, zone: string) => {
    let fmt = formatters.get(zone);
    if (!fmt) {
      fmt = new Intl.DateTimeFormat("en-US", {
        timeZone: zone,
        weekday: "short",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      });
      formatters.set(zone, fmt);
    }
    const p = Object.fromEntries(
      fmt.formatToParts(new Date(instant)).map((v) => [v.type, v.value]),
    );
    return {
      day: Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day)),
      weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday),
      minute: Number(p.hour) * 60 + Number(p.minute),
    };
  };
  const result: string[] = [];
  for (
    let t = Math.ceil(start / (step * minute)) * step * minute;
    t + duration * minute <= end;
    t += step * minute
  ) {
    const until = t + duration * minute;
    const available = ids.every(
      (id) =>
        windows.some((w) => {
          if (w.interviewer_id !== id) return false;
          const a = parts(t, w.timezone),
            b = parts(until, w.timezone);
          const endMinute =
            b.day === a.day ? b.minute : b.day === a.day + 86400_000 && b.minute === 0 ? 1440 : -1;
          return (
            a.weekday === w.weekday &&
            a.minute >= w.start_minute &&
            endMinute >= a.minute &&
            endMinute <= w.end_minute
          );
        }) &&
        !busy.some(
          (b) =>
            b.interviewer_id === id && t < Date.parse(b.ends_at) && until > Date.parse(b.starts_at),
        ),
    );
    if (available) result.push(new Date(t).toISOString());
    if (result.length === 50) break;
  }
  return result;
}
