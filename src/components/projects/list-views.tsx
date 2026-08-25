// Refinos Sprint E: views alternativas de listas (Calendar, Timeline, Workload).
import { useMemo, useState } from "react";
import {
  addDays,
  endOfWeek,
  format,
  isSameDay,
  isWithinInterval,
  startOfMonth,
  startOfWeek,
  subDays,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";

type Task = {
  id: string;
  title: string;
  due_at: string | null;
  start_at?: string | null;
  estimated_hours: number | null;
  priority: "low" | "normal" | "high" | "urgent";
  custom_status_id: string | null;
  assignee_id?: string | null;
  assignee_ids?: string[] | null;
};

type Status = { id: string; name: string; color: string | null };

const PRIORITY_TONE: Record<Task["priority"], string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  high: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  urgent: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
};

// ============ CALENDAR VIEW ============
export function CalendarView({ tasks, onOpen }: { tasks: Task[]; onOpen: (t: Task) => void }) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));

  const monthStart = startOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const days = useMemo(() => {
    const arr: Date[] = [];
    for (let i = 0; i < 42; i++) arr.push(addDays(gridStart, i));
    return arr;
  }, [gridStart]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.due_at) continue;
      const key = format(new Date(t.due_at), "yyyy-MM-dd");
      const list = map.get(key) ?? [];
      list.push(t);
      map.set(key, list);
    }
    return map;
  }, [tasks]);

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="text-sm font-medium capitalize">
          {format(cursor, "MMMM yyyy", { locale: ptBR })}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCursor(subDays(monthStart, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7"
            onClick={() => setCursor(startOfMonth(new Date()))}
          >
            Hoje
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCursor(addDays(endOfWeek(monthStart), 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b bg-muted/40 text-xs text-muted-foreground">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
          <div key={d} className="px-2 py-1.5 text-center font-medium">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const items = tasksByDay.get(key) ?? [];
          const isCurrentMonth = day.getMonth() === cursor.getMonth();
          const isToday = isSameDay(day, new Date());
          return (
            <div
              key={key}
              className={`min-h-[90px] border-b border-r p-1.5 text-xs ${!isCurrentMonth ? "bg-muted/20 text-muted-foreground" : ""}`}
            >
              <div
                className={`mb-1 flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${isToday ? "bg-primary text-primary-foreground font-semibold" : ""}`}
              >
                {format(day, "d")}
              </div>
              <div className="space-y-1">
                {items.slice(0, 3).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onOpen(t)}
                    className="w-full truncate rounded bg-primary/10 px-1.5 py-0.5 text-left text-[11px] hover:bg-primary/20"
                    title={t.title}
                  >
                    {t.title}
                  </button>
                ))}
                {items.length > 3 && (
                  <div className="text-[10px] text-muted-foreground">+{items.length - 3} mais</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============ TIMELINE / GANTT VIEW ============
export function TimelineView({
  tasks,
  statuses,
  onOpen,
}: {
  tasks: Task[];
  statuses: Status[];
  onOpen: (t: Task) => void;
}) {
  const statusById = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses]);

  // Janela: menor start/due até maior, com pad de 3 dias.
  const { rangeStart, rangeEnd, totalDays } = useMemo(() => {
    let min: Date | null = null;
    let max: Date | null = null;
    for (const t of tasks) {
      const s = t.start_at ? new Date(t.start_at) : t.due_at ? new Date(t.due_at) : null;
      const e = t.due_at ? new Date(t.due_at) : s;
      if (s && (!min || s < min)) min = s;
      if (e && (!max || e > max)) max = e;
    }
    const today = new Date();
    if (!min) min = subDays(today, 3);
    if (!max) max = addDays(today, 14);
    const rs = subDays(min, 2);
    const re = addDays(max, 2);
    return {
      rangeStart: rs,
      rangeEnd: re,
      totalDays: Math.max(1, Math.ceil((re.getTime() - rs.getTime()) / 86400000)),
    };
  }, [tasks]);

  const withDates = tasks.filter((t) => t.start_at || t.due_at);

  if (withDates.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        Nenhuma tarefa com data para exibir na timeline. Defina uma data de início ou prazo.
      </div>
    );
  }

  // Header: uma coluna por dia (ou por semana se muito longo)
  const useWeeks = totalDays > 60;
  const cellDays = useWeeks ? 7 : 1;
  const cellCount = Math.ceil(totalDays / cellDays);

  return (
    <div className="rounded-lg border bg-card overflow-x-auto">
      <div className="min-w-[900px]">
        {/* Header */}
        <div
          className="grid border-b bg-muted/40 text-[11px] text-muted-foreground"
          style={{ gridTemplateColumns: `240px repeat(${cellCount}, minmax(28px, 1fr))` }}
        >
          <div className="px-3 py-2 font-medium">Tarefa</div>
          {Array.from({ length: cellCount }).map((_, i) => {
            const d = addDays(rangeStart, i * cellDays);
            return (
              <div key={i} className="border-l px-1 py-2 text-center">
                {useWeeks ? format(d, "dd/MM") : format(d, "dd")}
              </div>
            );
          })}
        </div>
        {/* Rows */}
        {withDates.map((t) => {
          const s = t.start_at ? new Date(t.start_at) : new Date(t.due_at!);
          const e = t.due_at ? new Date(t.due_at) : s;
          const startOffset = Math.max(
            0,
            Math.floor((s.getTime() - rangeStart.getTime()) / 86400000),
          );
          const endOffset = Math.max(
            startOffset + 1,
            Math.ceil((e.getTime() - rangeStart.getTime()) / 86400000) + 1,
          );
          const startCol = Math.floor(startOffset / cellDays) + 2; // +2 (grid start + label col)
          const endCol = Math.ceil(endOffset / cellDays) + 2;
          const st = t.custom_status_id ? statusById.get(t.custom_status_id) : undefined;
          return (
            <div
              key={t.id}
              className="grid border-b hover:bg-muted/20"
              style={{ gridTemplateColumns: `240px repeat(${cellCount}, minmax(28px, 1fr))` }}
            >
              <button
                onClick={() => onOpen(t)}
                className="px-3 py-2 text-left text-xs font-medium truncate hover:text-primary"
                title={t.title}
              >
                {t.title}
              </button>
              <div
                className="relative col-span-full grid"
                style={{
                  gridTemplateColumns: `240px repeat(${cellCount}, minmax(28px, 1fr))`,
                  gridColumn: "1 / -1",
                }}
              >
                <div />
                <div
                  onClick={() => onOpen(t)}
                  className="my-1.5 h-6 cursor-pointer rounded-md px-2 py-1 text-[11px] font-medium text-white truncate flex items-center"
                  style={{
                    gridColumn: `${startCol} / ${endCol}`,
                    background: st?.color ?? "#0ea5e9",
                  }}
                  title={`${t.title}${st ? ` — ${st.name}` : ""}`}
                >
                  {t.title}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============ WORKLOAD VIEW ============
export function WorkloadView({ tasks }: { tasks: Task[] }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const { nameFor: nameForUser, initialsFor } = useWorkspaceMembers();

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

  // Agrupa por assignee (usa assignee_ids array; cai para assignee_id single)
  const byAssignee = useMemo(() => {
    const map = new Map<string, { hours: number; tasks: Task[] }>();
    for (const t of tasks) {
      if (!t.due_at) continue;
      const due = new Date(t.due_at);
      if (!isWithinInterval(due, { start: weekStart, end: weekEnd })) continue;
      const assignees =
        t.assignee_ids && t.assignee_ids.length > 0
          ? t.assignee_ids
          : t.assignee_id
            ? [t.assignee_id]
            : ["__unassigned__"];
      const hours = (t.estimated_hours ?? 0) / assignees.length;
      for (const a of assignees) {
        const entry = map.get(a) ?? { hours: 0, tasks: [] };
        entry.hours += hours;
        entry.tasks.push(t);
        map.set(a, entry);
      }
    }
    return Array.from(map.entries()).sort((a, b) => b[1].hours - a[1].hours);
  }, [tasks, weekStart, weekEnd]);

  const CAPACITY = 40; // horas/semana

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Semana de {format(weekStart, "dd/MM")} a {format(weekEnd, "dd/MM/yyyy")}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setWeekStart(subDays(weekStart, 7))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7"
            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
          >
            Esta semana
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {byAssignee.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          Sem tarefas estimadas nesta semana.
        </div>
      ) : (
        <div className="rounded-lg border bg-card divide-y">
          {byAssignee.map(([id, entry]) => {
            const pct = Math.min(100, (entry.hours / CAPACITY) * 100);
            const overload = entry.hours > CAPACITY;
            return (
              <div key={id} className="p-3 space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    {id !== "__unassigned__" && (
                      <div className="h-6 w-6 rounded-full bg-primary/10 text-primary text-[10px] font-semibold flex items-center justify-center shrink-0">
                        {initialsFor(id)}
                      </div>
                    )}
                    <div className="font-medium truncate">
                      {id === "__unassigned__" ? "Sem responsável" : nameForUser(id)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`tabular-nums ${overload ? "text-rose-600 font-semibold" : "text-muted-foreground"}`}
                    >
                      {entry.hours.toFixed(1)}h / {CAPACITY}h
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {entry.tasks.length} tarefas
                    </Badge>
                  </div>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${overload ? "bg-rose-500" : "bg-primary"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex flex-wrap gap-1 pt-1">
                  {entry.tasks.slice(0, 6).map((t) => (
                    <Badge
                      key={t.id}
                      variant="outline"
                      className={`text-[10px] ${PRIORITY_TONE[t.priority]}`}
                    >
                      {t.title}
                    </Badge>
                  ))}
                  {entry.tasks.length > 6 && (
                    <Badge variant="outline" className="text-[10px]">
                      +{entry.tasks.length - 6}
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
