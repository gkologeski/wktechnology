// Seção "Campanhas e prospecção" do painel de vendas (presentacional).
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarCheck, CheckCheck, MessageCircleReply, Send, UserRound } from "lucide-react";
import { MetricCard, SectionHeader } from "@/components/techhire/ui";
import { LazyChart } from "@/components/charts/lazy-chart";
import { stepConversion } from "@/lib/deals/campaign-funnel.logic";
import type { CampaignFunnelData, FunnelStep } from "@/lib/deals/campaign-funnel.types";

const nf = new Intl.NumberFormat("pt-BR");
const card = "rounded-lg border border-border-subtle bg-surface-1 p-4";
const tip = {
  background: "var(--color-surface-2)",
  border: "1px solid var(--color-border-default)",
  borderRadius: 8,
  fontSize: 12,
};
const CHANNELS = [
  { key: "all", label: "Todos" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "email", label: "E-mail" },
] as const;

function fmt(s: FunnelStep | undefined) {
  if (!s || s.value == null) return "Sem cobertura";
  return nf.format(s.value);
}
function find(steps: FunnelStep[], k: string) {
  return steps.find((s) => s.key === k);
}
function rate(a?: FunnelStep, b?: FunnelStep) {
  const r = stepConversion(a?.value ?? null, b?.value ?? null);
  return r == null ? "—" : `${r}%`;
}

export function CampaignsSection({ data }: { data: CampaignFunnelData }) {
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]["key"]>("all");
  const all = data.funnel.all;
  const sent = find(all, "sent");
  const deltaPct =
    data.previousSent > 0 && sent?.value != null
      ? ((sent.value - data.previousSent) / data.previousSent) * 100
      : null;
  const steps = data.funnel[channel];
  const max = Math.max(1, ...steps.map((s) => s.value ?? 0));
  const compare = ["delivered", "replied", "meeting"].map((k) => {
    const label = find(all, k)!.label;
    const pct = (ch: "whatsapp" | "email") =>
      stepConversion(
        find(data.funnel[ch], "sent")?.value ?? null,
        find(data.funnel[ch], k)?.value ?? null,
      );
    return { label, whatsapp: pct("whatsapp"), email: pct("email") };
  });
  const totalBlocks = data.blocks.reduce((a, b) => a + b.value, 0);
  const convTotal = data.aiVsHuman.ai + data.aiVsHuman.human;
  const empty = (sent?.value ?? 0) === 0 && totalBlocks === 0;

  return (
    <section aria-labelledby="campaigns-heading" className="flex flex-col gap-4">
      <div className="flex items-center gap-3 pt-2">
        <div className="h-px flex-1 bg-border-subtle" />
        <h2 id="campaigns-heading" className="text-sm font-semibold text-text-primary">
          Campanhas e prospecção
        </h2>
        <div className="h-px flex-1 bg-border-subtle" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Disparados"
          value={fmt(sent)}
          hint="WhatsApp + e-mail no período"
          icon={Send}
          tone="neutral"
          delta={
            deltaPct != null
              ? {
                  value: `${deltaPct > 0 ? "+" : ""}${deltaPct.toFixed(1)}%`,
                  direction: deltaPct > 0.05 ? "up" : deltaPct < -0.05 ? "down" : "flat",
                }
              : undefined
          }
        />
        <MetricCard
          label="Entregues"
          value={fmt(find(all, "delivered"))}
          hint={`${rate(sent, find(all, "delivered"))} dos disparos · e-mail não rastreado`}
          icon={CheckCheck}
          tone="neutral"
        />
        <MetricCard
          label="Respondidos"
          value={fmt(find(all, "replied"))}
          hint={`Taxa ${rate(sent, find(all, "replied"))} · só WhatsApp`}
          icon={MessageCircleReply}
          tone="neutral"
        />
        <MetricCard
          label="Atendidos por humano"
          value={fmt(find(all, "human"))}
          hint="Conversas assumidas pela equipe"
          icon={UserRound}
          tone="neutral"
        />
        <MetricCard
          label="Reuniões agendadas"
          value={fmt(find(all, "meeting"))}
          hint="Agendadas a partir das conversas"
          icon={CalendarCheck}
          tone="neutral"
        />
      </div>

      {empty ? (
        <div className={card}>
          <SectionHeader
            title="Sem envios no período"
            description="Nenhuma campanha de WhatsApp ou e-mail disparou neste intervalo."
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className={card}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <SectionHeader
                  title="Funil de campanhas"
                  description="Conversão de cada etapa sobre a anterior."
                />
                <div role="group" aria-label="Canal do funil" className="flex gap-1">
                  {CHANNELS.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      aria-pressed={channel === c.key}
                      onClick={() => setChannel(c.key)}
                      className={`rounded-md px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${channel === c.key ? "bg-primary text-primary-foreground" : "text-text-secondary hover:bg-surface-2"}`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <ol className="mt-3 flex flex-col gap-2">
                {steps.map((s, i) => (
                  <li
                    key={s.key}
                    className="grid grid-cols-[8.5rem_1fr_auto] items-center gap-2 text-xs"
                  >
                    <span className="truncate text-text-secondary">{s.label}</span>
                    <div className="h-3 rounded bg-surface-2">
                      {s.value != null && (
                        <div
                          className="h-3 rounded bg-primary"
                          style={{ width: `${Math.max(2, (s.value / max) * 100)}%` }}
                        />
                      )}
                    </div>
                    <span className="w-28 text-right tabular-nums text-text-primary">
                      {s.value == null ? (
                        <span className="text-text-tertiary">não rastreado</span>
                      ) : (
                        <>
                          {nf.format(s.value)}
                          {i > 0 && (
                            <span className="ml-1 text-text-tertiary">{rate(steps[i - 1], s)}</span>
                          )}
                          {s.coverage === "partial" && (
                            <span className="ml-1 text-text-tertiary" title="Cobertura parcial">
                              *
                            </span>
                          )}
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-xs text-text-tertiary">
                * cobertura parcial: algum canal não informa esta etapa.
              </p>
            </div>

            <div className={card}>
              <SectionHeader
                title="Envios por dia"
                description="Mensagens disparadas por campanhas, por canal."
              />
              <div className="mt-3 h-56">
                <LazyChart>
                  {({
                    ResponsiveContainer,
                    ComposedChart,
                    Bar,
                    Line,
                    XAxis,
                    YAxis,
                    Tooltip,
                    Legend,
                    CartesianGrid,
                  }) => (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={data.daily}
                        margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
                      >
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
                        <Tooltip contentStyle={tip} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar
                          dataKey="whatsapp"
                          name="WhatsApp"
                          stackId="s"
                          fill="var(--color-chart-1)"
                        />
                        <Bar
                          dataKey="email"
                          name="E-mail"
                          stackId="s"
                          fill="var(--color-chart-2)"
                          radius={[3, 3, 0, 0]}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </LazyChart>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className={card}>
              <SectionHeader
                title="Comparativo por canal"
                description="Taxas sobre os disparos. E-mail sem rastreio de entrega/resposta."
              />
              <div className="mt-3 h-48">
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
                  }) => (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={compare} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
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
                          unit="%"
                          tick={{ fontSize: 11, fill: "var(--color-text-tertiary)" }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          contentStyle={tip}
                          formatter={(v) => (v == null ? "não rastreado" : `${v}%`)}
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar
                          dataKey="whatsapp"
                          name="WhatsApp"
                          fill="var(--color-chart-1)"
                          radius={[3, 3, 0, 0]}
                        />
                        <Bar
                          dataKey="email"
                          name="E-mail"
                          fill="var(--color-chart-2)"
                          radius={[3, 3, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </LazyChart>
              </div>
            </div>

            <div className={card}>
              <SectionHeader
                title="Falhas e bloqueios"
                description={`${nf.format(totalBlocks)} destinatários não receberam.`}
              />
              {totalBlocks === 0 ? (
                <p className="mt-3 text-sm text-text-tertiary">
                  Nenhuma falha ou bloqueio no período.
                </p>
              ) : (
                <div className="mt-3 h-48">
                  <LazyChart>
                    {({ ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend }) => (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={data.blocks}
                            dataKey="value"
                            nameKey="label"
                            innerRadius="55%"
                            outerRadius="85%"
                            paddingAngle={2}
                          >
                            {data.blocks.map((b, i) => (
                              <Cell key={b.key} fill={`var(--color-chart-${(i % 5) + 1})`} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={tip} />
                          <Legend
                            wrapperStyle={{ fontSize: 11 }}
                            layout="vertical"
                            align="right"
                            verticalAlign="middle"
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </LazyChart>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className={`${card} lg:col-span-2`}>
              <SectionHeader
                title="Ranking de campanhas"
                description="Top 10 por disparos no período."
              />
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-text-tertiary">
                    <tr className="text-left">
                      <th className="py-1 font-medium">Campanha</th>
                      <th className="py-1 font-medium">Canal</th>
                      <th className="py-1 text-right font-medium">Disparos</th>
                      <th className="py-1 text-right font-medium">Resposta</th>
                      <th className="py-1 text-right font-medium">Reuniões</th>
                      <th className="py-1 text-right font-medium">Falhas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.ranking.map((r) => (
                      <tr key={r.id} className="border-t border-border-subtle">
                        <td className="max-w-56 truncate py-1.5">
                          {r.channel === "whatsapp" ? (
                            <Link
                              to="/campaigns/whatsapp"
                              className="text-text-primary hover:underline focus-visible:underline"
                            >
                              {r.name}
                            </Link>
                          ) : (
                            <Link
                              to="/campaigns/email"
                              className="text-text-primary hover:underline focus-visible:underline"
                            >
                              {r.name}
                            </Link>
                          )}
                        </td>
                        <td className="py-1.5 text-text-secondary">
                          {r.channel === "whatsapp" ? "WhatsApp" : "E-mail"}
                        </td>
                        <td className="py-1.5 text-right tabular-nums">{nf.format(r.sent)}</td>
                        <td className="py-1.5 text-right tabular-nums">
                          {r.replied == null
                            ? "—"
                            : r.sent
                              ? `${Math.round((r.replied / r.sent) * 1000) / 10}%`
                              : "—"}
                        </td>
                        <td className="py-1.5 text-right tabular-nums">{r.meetings ?? "—"}</td>
                        <td className="py-1.5 text-right tabular-nums">{r.failed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={card}>
              <SectionHeader
                title="Lia × humano"
                description="Conversas de campanhas no período."
              />
              {convTotal === 0 ? (
                <p className="mt-3 text-sm text-text-tertiary">
                  Sem conversas iniciadas por campanhas.
                </p>
              ) : (
                <div className="mt-4 flex flex-col gap-3">
                  <div
                    className="flex h-4 overflow-hidden rounded"
                    role="img"
                    aria-label={`Lia ${data.aiVsHuman.ai}, humano ${data.aiVsHuman.human}`}
                  >
                    <div
                      style={{
                        width: `${(data.aiVsHuman.ai / convTotal) * 100}%`,
                        background: "var(--color-chart-1)",
                      }}
                    />
                    <div
                      style={{
                        width: `${(data.aiVsHuman.human / convTotal) * 100}%`,
                        background: "var(--color-chart-4)",
                      }}
                    />
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <dt className="text-text-tertiary">Com a Lia</dt>
                      <dd className="text-base font-semibold tabular-nums">
                        {nf.format(data.aiVsHuman.ai)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-text-tertiary">Com humano</dt>
                      <dd className="text-base font-semibold tabular-nums">
                        {nf.format(data.aiVsHuman.human)}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
