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
          {({ ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid }) => (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
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
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </LazyChart>
      </div>
    </section>
  );
}
