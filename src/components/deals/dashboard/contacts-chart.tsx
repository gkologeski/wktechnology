// Volume de contatos por dia (14 dias), empilhado por tipo de atividade.
import { SectionHeader } from "@/components/techhire/ui";
import { LazyChart } from "@/components/charts/lazy-chart";
import type { ContactsByDay } from "@/lib/deals/sales-dashboard.types";

const SERIES = [
  { key: "calls", label: "Ligações", color: "var(--color-chart-1)" },
  { key: "emails", label: "E-mails", color: "var(--color-chart-2)" },
  { key: "whatsapp", label: "WhatsApp", color: "var(--color-chart-3)" },
  { key: "meetings", label: "Reuniões", color: "var(--color-chart-4)" },
  { key: "other", label: "Outros", color: "var(--color-chart-5)" },
] as const;

/**
 * Rótulo do total diário no topo de cada barra empilhada.
 * Renderizado sobre a última série da pilha ("Outros"), que fecha a barra.
 */
const TotalLabel = (data: ContactsByDay[]) =>
  function TotalLabelList(props: {
    x?: number | string;
    y?: number | string;
    width?: number | string;
    index?: number;
  }) {
    const entry = typeof props.index === "number" ? data[props.index] : undefined;
    if (!entry || entry.total === 0) return null;
    const x = typeof props.x === "number" ? props.x : Number(props.x ?? 0);
    const y = typeof props.y === "number" ? props.y : Number(props.y ?? 0);
    const width = typeof props.width === "number" ? props.width : Number(props.width ?? 0);
    return (
      <text
        x={x + width / 2}
        y={y - 6}
        textAnchor="middle"
        fontSize={11}
        fill="var(--color-text-tertiary)"
        aria-hidden="true"
      >
        {entry.total}
      </text>
    );
  };

export function ContactsChart({ data }: { data: ContactsByDay[] }) {
  const total = data.reduce((acc, d) => acc + d.total, 0);

  return (
    <section className="rounded-lg border border-border-subtle bg-surface-1 p-4">
      <SectionHeader
        title="Contatos por dia"
        description={`Últimos 14 dias · ${total} interações registradas.`}
      />
      <div className="mt-3 h-56">
        <LazyChart>
          {({
            ResponsiveContainer,
            BarChart,
            Bar,
            XAxis,
            YAxis,
            Tooltip,
            Legend,
            CartesianGrid,
            LabelList,
          }) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border-subtle)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "var(--color-text-tertiary)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "var(--color-text-tertiary)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-surface-2)",
                    border: "1px solid var(--color-border-default)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {SERIES.map((s) => (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.label}
                    stackId="contacts"
                    fill={s.color}
                    radius={s.key === "other" ? [3, 3, 0, 0] : undefined}
                  >
                    {s.key === "other" && (
                      <LabelList dataKey="other" content={TotalLabel(data)} />
                    )}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </LazyChart>
      </div>
    </section>
  );
}
