// Minhas Horas — visão da semana: horas por dia, total e meta.
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { MetricCard } from "@/components/techhire/ui";
import { formatMinutes } from "@/lib/projects/time-entry.shared";

export type WeekDay = { date: string; tracked: number; expected: number | null };

export function MyHoursWeek({
  from,
  to,
  tracked,
  expected,
  byDay,
  onPickDay,
}: {
  from: string;
  to: string;
  tracked: number;
  /** null = jornada não configurada no People. */
  expected: number | null;
  byDay: WeekDay[];
  onPickDay?: (date: string) => void;
}) {
  const known = expected !== null;
  const pct = known && expected > 0 ? Math.min(100, Math.round((tracked / expected) * 100)) : 0;
  const diff = tracked - (expected ?? 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Total da semana" value={formatMinutes(tracked)} />
        <MetricCard
          label="Meta semanal"
          value={known ? formatMinutes(expected) : "Não configurada"}
          hint={known ? undefined : "Jornada não cadastrada no TechPeople"}
        />
        <MetricCard
          label={!known ? "Saldo" : diff >= 0 ? "Excedente" : "Faltam"}
          value={known ? formatMinutes(Math.abs(diff)) : "—"}
          tone={!known ? undefined : diff >= 0 ? "positive" : "warning"}
        />
      </div>

      {known && <Progress value={pct} aria-label={`Progresso da semana: ${pct}%`} />}

      <p className="text-xs text-muted-foreground">
        Período de {formatDay(from)} a {formatDay(to)}
      </p>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {byDay.map((d) => (
          <Card key={d.date}>
            <CardContent className="p-3">
              <p className="text-xs capitalize text-muted-foreground">{formatWeekday(d.date)}</p>
              <p className="text-lg font-semibold tabular-nums">{formatMinutes(d.tracked)}</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {d.expected === null ? "meta não configurada" : `meta ${formatMinutes(d.expected)}`}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 px-0"
                onClick={() => onPickDay?.(d.date)}
              >
                Ver dia
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function formatDay(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function formatWeekday(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return `${d.toLocaleDateString("pt-BR", { weekday: "short" })} ${formatDay(iso)}`;
}
