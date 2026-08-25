import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDeiAnalytics } from "@/lib/ats/dei.functions";

export const Route = createFileRoute("/_authenticated/dei-analytics")({
  component: DeiAnalyticsPage,
});

function Section({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: number }>;
}) {
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  return (
    <div className="rounded border p-4">
      <h3 className="mb-3 font-semibold">{title}</h3>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="flex justify-between text-sm">
              <span>{r.label}</span>
              <span>
                {r.value} ({Math.round((r.value / total) * 100)}%)
              </span>
            </div>
            <div className="h-2 bg-muted rounded">
              <div
                className="h-2 bg-primary rounded"
                style={{ width: `${(r.value / total) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DeiAnalyticsPage() {
  const fn = useServerFn(getDeiAnalytics);
  const q = useQuery({
    queryKey: ["dei-analytics"],
    queryFn: () => fn({ data: undefined as never }),
  });

  if (q.isLoading) return <div className="p-6">Carregando...</div>;
  const d = q.data!;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-2">DEI Analytics</h1>
      <p className="text-sm text-muted-foreground mb-4">
        Total de candidatos: {d.total}. Campos auto-declarados (opcionais).
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Gênero" rows={d.gender} />
        <Section title="Raça/Cor" rows={d.race} />
        <Section title="Pessoa com deficiência" rows={d.disability} />
        <Section title="LGBTQIA+" rows={d.lgbtqia} />
      </div>
    </div>
  );
}
