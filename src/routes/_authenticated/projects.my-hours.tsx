// TechProjects — Minhas Horas: dia, semana e calendário mensal.
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, RowSkeleton } from "@/components/techhire/ui";
import { getMyTimeSummary } from "@/lib/projects/time-metrics.functions";
import { MyHoursDay } from "@/components/projects/my-hours-day";
import { MyHoursWeek } from "@/components/projects/my-hours-week";
import { MyHoursCalendar } from "@/components/projects/my-hours-calendar";
import { QuickTimeEntryDialog } from "@/components/projects/quick-time-entry-dialog";

export const Route = createFileRoute("/_authenticated/projects/my-hours")({
  head: () => ({
    meta: [
      { title: "Minhas Horas — TechProjects" },
      {
        name: "description",
        content: "Apontamento rápido de horas, total do dia, da semana e calendário mensal.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyHoursPage,
});

const todayIso = () => new Date().toISOString().slice(0, 10);

function shiftDate(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function MyHoursPage() {
  const summaryFn = useServerFn(getMyTimeSummary);
  const [date, setDate] = useState(todayIso());
  const [tab, setTab] = useState("dia");
  const [quickOpen, setQuickOpen] = useState(false);

  const summary = useQuery({
    queryKey: ["my-time-summary", date],
    queryFn: () => summaryFn({ data: { date } }),
  });

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Minhas Horas"
        description="Registre e acompanhe suas horas trabalhadas."
        actions={
          <Button onClick={() => setQuickOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Apontar horas
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="dia">Hoje</TabsTrigger>
          <TabsTrigger value="semana">Semana</TabsTrigger>
          <TabsTrigger value="mes">Calendário</TabsTrigger>
        </TabsList>

        <TabsContent value="dia" className="space-y-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Dia anterior"
              onClick={() => setDate((d) => shiftDate(d, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <p className="text-sm font-medium">
              {new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "2-digit",
                month: "long",
              })}
            </p>
            <Button
              variant="outline"
              size="icon"
              aria-label="Próximo dia"
              onClick={() => setDate((d) => shiftDate(d, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            {date !== todayIso() && (
              <Button variant="ghost" size="sm" onClick={() => setDate(todayIso())}>
                Hoje
              </Button>
            )}
          </div>

          {summary.isLoading ? (
            <div className="space-y-2">
              <RowSkeleton />
              <RowSkeleton />
              <RowSkeleton />
            </div>
          ) : summary.isError ? (
            <EmptyState
              title="Não foi possível carregar suas horas"
              description="Tente novamente em instantes."
              action={
                <Button variant="outline" onClick={() => void summary.refetch()}>
                  Tentar novamente
                </Button>
              }
            />
          ) : (
            <MyHoursDay
              date={date}
              tracked={summary.data?.today.tracked ?? 0}
              expected={summary.data?.today.expected ?? 0}
            />
          )}
        </TabsContent>

        <TabsContent value="semana">
          {summary.isLoading ? (
            <div className="space-y-2">
              <RowSkeleton />
              <RowSkeleton />
            </div>
          ) : summary.data ? (
            <MyHoursWeek
              from={summary.data.week.from}
              to={summary.data.week.to}
              tracked={summary.data.week.tracked}
              expected={summary.data.week.expected}
              byDay={summary.data.week.byDay}
              onPickDay={(d) => {
                setDate(d);
                setTab("dia");
              }}
            />
          ) : (
            <EmptyState
              title="Sem dados da semana"
              description="Registre suas horas para ver o resumo."
            />
          )}
        </TabsContent>

        <TabsContent value="mes">
          <MyHoursCalendar
            onPickDay={(d) => {
              setDate(d);
              setTab("dia");
            }}
          />
        </TabsContent>
      </Tabs>

      <QuickTimeEntryDialog
        open={quickOpen}
        onOpenChange={setQuickOpen}
        draft={{ entryDate: date }}
      />
    </div>
  );
}
