import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { CalendarCheck2, Clock3, CheckCircle2 } from "lucide-react";
import { getSelfScheduleByToken, confirmSelfSchedule } from "@/lib/ats/self-schedule.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/schedule/$token")({
  head: () => ({
    meta: [{ title: "Agendar entrevista" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: SchedulePage,
});

function fmtSlot(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function groupByDay(slots: string[]) {
  const map = new Map<string, string[]>();
  for (const s of slots) {
    const d = new Date(s);
    const key = d.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    });
    const arr = map.get(key) ?? [];
    arr.push(s);
    map.set(key, arr);
  }
  return Array.from(map.entries());
}

function SchedulePage() {
  const { token } = useParams({ from: "/schedule/$token" });
  const get = useServerFn(getSelfScheduleByToken);
  const confirmFn = useServerFn(confirmSelfSchedule);
  const [picked, setPicked] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["self-schedule", token],
    queryFn: () => get({ data: { token } }),
    retry: false,
  });

  const m = useMutation({
    mutationFn: (slot: string) => confirmFn({ data: { token, slot } }),
    onSuccess: () => q.refetch(),
  });

  const slots = useMemo(() => (q.data?.offered_slots as string[] | undefined) ?? [], [q.data]);
  const grouped = useMemo(() => groupByDay(slots), [slots]);

  return (
    <div className="min-h-screen bg-surface-sunken">
      <div className="mx-auto max-w-xl px-4 py-10 sm:py-16">
        <div className="mb-6 flex items-center gap-2 text-text-tertiary">
          <CalendarCheck2 className="h-5 w-5" />
          <span className="text-sm font-medium">Agendamento de entrevista</span>
        </div>

        {q.isLoading ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-text-tertiary">
              Carregando…
            </CardContent>
          </Card>
        ) : q.error ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-sm font-medium text-destructive">{(q.error as Error).message}</p>
              <p className="mt-2 text-xs text-text-tertiary">
                Verifique o link recebido por e-mail ou entre em contato com a empresa.
              </p>
            </CardContent>
          </Card>
        ) : q.data?.status === "scheduled" ? (
          <Card>
            <CardContent className="p-8 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-status-open" />
              <h1 className="mt-4 text-xl font-semibold tracking-tight text-text-primary">
                Entrevista confirmada
              </h1>
              <p className="mt-2 text-sm text-text-secondary">{fmtSlot(q.data.scheduled_at!)}</p>
              <p className="mt-4 text-xs text-text-tertiary">
                Você receberá um e-mail com os detalhes e o link da reunião.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6 space-y-5">
              <header className="space-y-1">
                <h1 className="text-xl font-semibold tracking-tight text-text-primary">
                  Escolha o melhor horário
                </h1>
                <p className="flex items-center gap-1.5 text-xs text-text-tertiary">
                  <Clock3 className="h-3.5 w-3.5" />
                  Duração: {q.data?.duration_min ?? 30} min
                </p>
              </header>

              <div className="space-y-4">
                {grouped.map(([day, daySlots]) => (
                  <div key={day} className="space-y-2">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                      {day}
                    </h2>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {daySlots.map((s) => {
                        const time = new Date(s).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        });
                        const isPicked = picked === s;
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setPicked(s)}
                            className={cn(
                              "rounded-md border px-3 py-2 text-sm tabular-nums transition-colors",
                              isPicked
                                ? "border-primary bg-primary/10 text-primary font-medium"
                                : "border-border-subtle hover:border-border-strong hover:bg-surface-sunken",
                            )}
                          >
                            {time}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <Button
                disabled={!picked || m.isPending}
                className="w-full"
                size="lg"
                onClick={() => picked && m.mutate(picked)}
              >
                {m.isPending ? "Confirmando…" : "Confirmar horário"}
              </Button>
              {m.error ? (
                <p className="text-center text-sm text-destructive">{(m.error as Error).message}</p>
              ) : null}
            </CardContent>
          </Card>
        )}

        <p className="mt-6 text-center text-[11px] text-text-tertiary">Powered by TechHire</p>
      </div>
    </div>
  );
}
