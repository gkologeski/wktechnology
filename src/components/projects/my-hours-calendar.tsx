// Minhas Horas — calendário mensal com status por dia (estilo Clockify).
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RowSkeleton, EmptyState } from "@/components/techhire/ui";
import { getMyMonthCalendar } from "@/lib/projects/time-metrics.functions";
import { formatMinutes } from "@/lib/projects/time-entry.shared";

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const STATUS_STYLE: Record<string, { className: string; label: string }> = {
  complete: { className: "border-primary/40 bg-primary/10", label: "Completo" },
  partial: { className: "border-warning/40 bg-warning/10", label: "Incompleto" },
  missing: { className: "border-destructive/40 bg-destructive/10", label: "Sem apontamento" },
  off: { className: "border-border bg-muted/40", label: "Não útil" },
};

export function MyHoursCalendar({ onPickDay }: { onPickDay?: (date: string) => void }) {
  const calendarFn = useServerFn(getMyMonthCalendar);
  const [ref, setRef] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });

  const query = useQuery({
    queryKey: ["my-month-calendar", ref.year, ref.month],
    queryFn: () => calendarFn({ data: ref }),
  });

  const monthLabel = useMemo(
    () =>
      new Date(ref.year, ref.month - 1, 1).toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      }),
    [ref],
  );

  const shift = (delta: number) => {
    setRef((r) => {
      const d = new Date(r.year, r.month - 1 + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    });
  };

  const days = query.data?.days ?? [];
  const leading = days.length ? (new Date(`${days[0]!.date}T12:00:00`).getDay() + 6) % 7 : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="icon" aria-label="Mês anterior" onClick={() => shift(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="text-sm font-medium capitalize">{monthLabel}</p>
        <Button variant="outline" size="icon" aria-label="Próximo mês" onClick={() => shift(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {query.isLoading ? (
        <div className="space-y-2">
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      ) : query.isError ? (
        <EmptyState
          title="Não foi possível carregar o calendário"
          description="Tente novamente em instantes."
          action={
            <Button variant="outline" onClick={() => void query.refetch()}>
              Tentar novamente
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
            {WEEKDAYS.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: leading }, (_, i) => (
              <div key={`pad-${i}`} aria-hidden />
            ))}
            {days.map((d) => {
              const style = STATUS_STYLE[d.status] ?? STATUS_STYLE.off!;
              return (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => onPickDay?.(d.date)}
                  aria-label={`${d.date}: ${formatMinutes(d.tracked)} de ${formatMinutes(d.expected)} — ${style.label}`}
                  className={`rounded-md border p-2 text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${style.className}`}
                >
                  <span className="block text-xs font-medium tabular-nums">
                    {d.date.slice(8, 10)}
                  </span>
                  <span className="block text-xs tabular-nums">{formatMinutes(d.tracked)}</span>
                  <span className="block text-[10px] text-muted-foreground">{style.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
