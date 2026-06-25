import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getSelfScheduleByToken, confirmSelfSchedule } from "@/lib/ats/self-schedule.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/schedule/$token")({
  component: SchedulePage,
});

function SchedulePage() {
  const { token } = useParams({ from: "/schedule/$token" });
  const get = useServerFn(getSelfScheduleByToken);
  const confirmFn = useServerFn(confirmSelfSchedule);
  const [picked, setPicked] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["self-schedule", token],
    queryFn: () => get({ data: { token } }),
  });

  const m = useMutation({
    mutationFn: (slot: string) => confirmFn({ data: { token, slot } }),
    onSuccess: () => q.refetch(),
  });

  if (q.isLoading) return <div className="p-8 text-center">Carregando...</div>;
  if (q.error) return <div className="p-8 text-center text-destructive">{(q.error as Error).message}</div>;
  const data = q.data!;

  if (data.status === "scheduled") {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="mb-2 text-2xl font-semibold">Entrevista confirmada ✅</h1>
        <p className="text-muted-foreground">
          {new Date(data.scheduled_at!).toLocaleString("pt-BR")}
        </p>
      </div>
    );
  }

  const slots = (data.offered_slots as string[]) ?? [];

  return (
    <div className="mx-auto max-w-md p-8">
      <h1 className="mb-4 text-2xl font-semibold">Escolha um horário</h1>
      <p className="mb-4 text-sm text-muted-foreground">Duração: {data.duration_min} min</p>
      <div className="space-y-2">
        {slots.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setPicked(s)}
            className={`w-full rounded border p-3 text-left ${picked === s ? "border-primary bg-primary/10" : ""}`}
          >
            {new Date(s).toLocaleString("pt-BR")}
          </button>
        ))}
      </div>
      <Button
        disabled={!picked || m.isPending}
        className="mt-4 w-full"
        onClick={() => picked && m.mutate(picked)}
      >
        {m.isPending ? "Confirmando..." : "Confirmar horário"}
      </Button>
      {m.error && <p className="mt-2 text-sm text-destructive">{(m.error as Error).message}</p>}
    </div>
  );
}
