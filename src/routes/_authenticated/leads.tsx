import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { EntityList } from "@/components/entity-list";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LEAD_STATUSES } from "@/lib/crm";
import type { Lead } from "@/lib/db-types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import {
  ArrowRightLeft,
  Sparkles,
  Users,
  UserPlus,
  Target,
  TrendingUp,
  Flame,
  Download,
  Upload,
  PhoneCall,
  Mail,
  Building2,
} from "lucide-react";
import { BulkEnrichDialog } from "@/components/enrichment/bulk-enrich-dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/leads")({
  component: LeadsPage,
});

type LeadStats = {
  total: number;
  new7d: number;
  byStatus: Record<string, number>;
  bySource: { source: string; count: number }[];
  avgScore: number;
  convertedLast30: number;
};

function useLeadStats() {
  return useQuery<LeadStats>({
    queryKey: ["leads", "stats"],
    staleTime: 60_000,
    queryFn: async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();

      const [{ count: total }, { count: new7d }, statusRes, sourceRes, scoreRes, { count: convertedLast30 }] =
        await Promise.all([
          supabase.from("leads").select("id", { count: "exact", head: true }),
          supabase
            .from("leads")
            .select("id", { count: "exact", head: true })
            .gte("created_at", sevenDaysAgo),
          supabase.from("leads").select("status").limit(5000),
          supabase.from("leads").select("source").not("source", "is", null).limit(5000),
          supabase.from("leads").select("score").not("score", "is", null).limit(5000),
          supabase
            .from("leads")
            .select("id", { count: "exact", head: true })
            .gte("converted_at", thirtyDaysAgo),
        ]);

      const byStatus: Record<string, number> = {};
      for (const r of statusRes.data ?? []) {
        const k = (r as { status: string }).status ?? "new";
        byStatus[k] = (byStatus[k] ?? 0) + 1;
      }

      const sourceMap = new Map<string, number>();
      for (const r of sourceRes.data ?? []) {
        const s = ((r as { source: string }).source ?? "—").trim() || "—";
        sourceMap.set(s, (sourceMap.get(s) ?? 0) + 1);
      }
      const bySource = [...sourceMap.entries()]
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const scores = (scoreRes.data ?? []).map((r) => (r as { score: number }).score ?? 0);
      const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

      return {
        total: total ?? 0,
        new7d: new7d ?? 0,
        byStatus,
        bySource,
        avgScore,
        convertedLast30: convertedLast30 ?? 0,
      };
    },
  });
}

const STATUS_TONE: Record<string, { dot: string; bg: string; text: string }> = {
  new: { dot: "bg-sky-500", bg: "bg-sky-500/10", text: "text-sky-700 dark:text-sky-300" },
  contacted: { dot: "bg-violet-500", bg: "bg-violet-500/10", text: "text-violet-700 dark:text-violet-300" },
  qualified: { dot: "bg-emerald-500", bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-300" },
  disqualified: { dot: "bg-rose-500", bg: "bg-rose-500/10", text: "text-rose-700 dark:text-rose-300" },
};

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "primary" | "emerald" | "amber" | "violet" | "rose";
}) {
  const tones: Record<string, string> = {
    primary: "from-primary/15 to-primary/0 text-primary",
    emerald: "from-emerald-500/15 to-emerald-500/0 text-emerald-600 dark:text-emerald-400",
    amber: "from-amber-500/15 to-amber-500/0 text-amber-600 dark:text-amber-400",
    violet: "from-violet-500/15 to-violet-500/0 text-violet-600 dark:text-violet-400",
    rose: "from-rose-500/15 to-rose-500/0 text-rose-600 dark:text-rose-400",
  };
  return (
    <Card className="relative overflow-hidden border-border/60 p-4 shadow-sm transition hover:shadow-md">
      <div className={cn("absolute inset-x-0 top-0 h-16 bg-gradient-to-b opacity-70", tones[tone])} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
            {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
          </p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className={cn("rounded-lg border border-border/60 bg-background/70 p-2", tones[tone].split(" ").pop())}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}

function StatusBreakdown({ byStatus, total }: { byStatus: Record<string, number>; total: number }) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Distribuição por status</h3>
        <span className="text-xs text-muted-foreground">{total.toLocaleString("pt-BR")} leads</span>
      </div>
      <div className="space-y-3">
        {LEAD_STATUSES.map((s) => {
          const count = byStatus[s.value] ?? 0;
          const pct = total > 0 ? (count / total) * 100 : 0;
          const tone = STATUS_TONE[s.value] ?? STATUS_TONE.new;
          return (
            <div key={s.value}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", tone.dot)} />
                  <span className="font-medium text-foreground">{s.label}</span>
                </div>
                <span className="tabular-nums text-muted-foreground">
                  {count.toLocaleString("pt-BR")} · {pct.toFixed(0)}%
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-all", tone.dot)}
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function TopSources({ bySource }: { bySource: { source: string; count: number }[] }) {
  const max = Math.max(1, ...bySource.map((s) => s.count));
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Top fontes</h3>
        <span className="text-xs text-muted-foreground">últimos 5</span>
      </div>
      {bySource.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">Sem dados de fonte ainda.</p>
      ) : (
        <div className="space-y-2.5">
          {bySource.map((s) => (
            <div key={s.source} className="grid grid-cols-[1fr_auto] items-center gap-3">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="truncate font-medium">{s.source}</span>
                  <span className="tabular-nums text-muted-foreground">{s.count.toLocaleString("pt-BR")}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60"
                    style={{ width: `${(s.count / max) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function LeadsHero({ stats }: { stats?: LeadStats }) {
  const total = stats?.total ?? 0;
  const conversion = total > 0 ? ((stats?.byStatus.qualified ?? 0) / total) * 100 : 0;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-background to-violet-500/5 p-6 shadow-sm">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 right-1/3 h-56 w-56 rounded-full bg-violet-500/10 blur-3xl"
      />
      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="secondary" className="gap-1 bg-background/70 backdrop-blur">
              <Flame className="h-3 w-3 text-amber-500" />
              Pipeline de aquisição
            </Badge>
            <Badge variant="outline" className="bg-background/70 backdrop-blur">
              Tempo real
            </Badge>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Leads</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Capture, qualifique e converta novos contatos com um fluxo enxuto. Monitore origem, score e velocidade
            de qualificação em um só lugar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild className="bg-background/70 backdrop-blur">
            <Link to="/leads/import-hubspot">
              <Upload className="mr-1.5 h-4 w-4" /> Importar HubSpot
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="bg-background/70 backdrop-blur" disabled>
            <Download className="mr-1.5 h-4 w-4" /> Exportar
          </Button>
        </div>
      </div>

      <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Total de leads" value={total} hint="acumulado" icon={Users} tone="primary" />
        <KpiCard
          label="Novos (7 dias)"
          value={stats?.new7d ?? 0}
          hint="entradas recentes"
          icon={UserPlus}
          tone="violet"
        />
        <KpiCard
          label="Qualificados"
          value={stats?.byStatus.qualified ?? 0}
          hint={`${conversion.toFixed(1)}% de conversão`}
          icon={Target}
          tone="emerald"
        />
        <KpiCard
          label="Convertidos (30d)"
          value={stats?.convertedLast30 ?? 0}
          hint="virados em deal"
          icon={TrendingUp}
          tone="amber"
        />
        <KpiCard
          label="Score médio"
          value={stats?.avgScore ?? 0}
          hint="potencial de fechamento"
          icon={Flame}
          tone="rose"
        />
      </div>
    </div>
  );
}

function LeadsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const location = useLocation();
  const [enrichIds, setEnrichIds] = useState<string[] | null>(null);
  const { data: stats } = useLeadStats();

  // Render nested routes (e.g. /leads/:id, /leads/import-hubspot) without the page chrome
  if (location.pathname !== "/leads") {
    return <Outlet />;
  }

  const convert = async (lead: Lead) => {
    if (!user) return;
    if (!confirm(`Converter "${lead.first_name}" em Contato + Empresa + Negócio?`)) return;
    let companyId: string | null = null;
    if (lead.company_name) {
      const { data: c, error: ce } = await supabase
        .from("companies")
        .insert({ owner_id: user.id, name: lead.company_name })
        .select("id")
        .single();
      if (ce) return toast.error(ce.message);
      companyId = c?.id ?? null;
    }
    const { data: contact, error: cte } = await supabase
      .from("contacts")
      .insert({
        owner_id: user.id,
        first_name: lead.first_name,
        last_name: lead.last_name,
        email: lead.email,
        phone: lead.phone,
        company_id: companyId,
      })
      .select("id")
      .single();
    if (cte) return toast.error(cte.message);

    const { data: deal, error: de } = await supabase
      .from("deals")
      .insert({
        owner_id: user.id,
        name: `Negócio - ${lead.first_name} ${lead.last_name ?? ""}`.trim(),
        stage: "qualified",
        company_id: companyId,
        primary_contact_id: contact?.id,
      })
      .select("id")
      .single();
    if (de) return toast.error(de.message);

    await supabase
      .from("leads")
      .update({
        status: "qualified",
        converted_at: new Date().toISOString(),
        converted_contact_id: contact?.id,
        converted_deal_id: deal?.id,
      })
      .eq("id", lead.id);

    toast.success("Lead convertido!");
    qc.invalidateQueries();
  };

  return (
    <div className="space-y-6">
      <LeadsHero stats={stats} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <StatusBreakdown byStatus={stats?.byStatus ?? {}} total={stats?.total ?? 0} />
        </div>
        <TopSources bySource={stats?.bySource ?? []} />
      </div>

      <Card className="overflow-hidden border-border/60 p-4 shadow-sm sm:p-5">
        <EntityList<Lead>
          table="leads"
          title="Todos os leads"
          description="Pesquise, segmente e tome ação em massa."
          detailPath={(id) => `/leads/${id}`}
          csvEnabled
          boardStageField="status"
          boardStages={LEAD_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
          inlineEditable={["status", "source", "company_name"]}
          searchKeys={["first_name", "last_name", "email", "company_name"]}
          columns={[
            {
              key: "first_name",
              label: "Lead",
              render: (r) => <LeadCell lead={r} />,
            },
            {
              key: "company_name",
              label: "Empresa",
              render: (r) =>
                r.company_name ? (
                  <span className="inline-flex items-center gap-1.5 text-sm">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    {r.company_name}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                ),
            },
            {
              key: "source",
              label: "Fonte",
              render: (r) =>
                r.source ? (
                  <Badge variant="outline" className="font-normal">
                    {r.source}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                ),
            },
            {
              key: "score",
              label: "Score",
              render: (r) => <ScoreCell score={r.score ?? 0} />,
            },
            {
              key: "status",
              label: "Status",
              render: (r) => <StatusPill status={r.status} />,
            },
          ]}
          fields={[
            { name: "first_name", label: "Nome", required: true },
            { name: "last_name", label: "Sobrenome" },
            { name: "email", label: "Email", type: "email" },
            { name: "phone", label: "Telefone", type: "tel" },
            { name: "company_name", label: "Empresa" },
            { name: "source", label: "Fonte (ex: site, indicação)" },
            {
              name: "status",
              label: "Status",
              type: "select",
              options: LEAD_STATUSES.map((s) => ({ value: s.value, label: s.label })),
            },
            { name: "notes", label: "Notas", type: "textarea" },
          ]}
          defaults={{ status: "new" }}
          bulkEditFields={[
            {
              name: "status",
              label: "Status",
              type: "select",
              options: LEAD_STATUSES.map((s) => ({ value: s.value, label: s.label })),
            },
            { name: "source", label: "Fonte" },
          ]}
          bulkActions={(ids) => (
            <Button variant="outline" size="sm" onClick={() => setEnrichIds(ids)}>
              <Sparkles className="mr-1 h-4 w-4" /> Enriquecer
            </Button>
          )}
          rowActions={(row) =>
            row.status !== "qualified" && row.status !== "disqualified" ? (
              <Button
                variant="ghost"
                size="icon"
                title="Converter em contato + empresa + negócio"
                onClick={() => convert(row)}
              >
                <ArrowRightLeft className="h-4 w-4" />
              </Button>
            ) : null
          }
        />
      </Card>

      <BulkEnrichDialog
        open={!!enrichIds}
        onOpenChange={(o) => !o && setEnrichIds(null)}
        ids={enrichIds ?? []}
        entity="lead"
        onDone={() => qc.invalidateQueries({ queryKey: ["leads"] })}
      />
    </div>
  );
}

function LeadCell({ lead }: { lead: Lead }) {
  const full = `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() || "Sem nome";
  const initials = useMemo(() => {
    const parts = full.split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
  }, [full]);
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-violet-500/20 text-xs font-semibold text-primary">
        {initials}
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{full}</div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {lead.email && (
            <span className="inline-flex items-center gap-1 truncate">
              <Mail className="h-3 w-3" />
              <span className="truncate">{lead.email}</span>
            </span>
          )}
          {lead.phone && (
            <span className="inline-flex items-center gap-1">
              <PhoneCall className="h-3 w-3" />
              {lead.phone}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ScoreCell({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const tone =
    clamped >= 75
      ? "from-emerald-500 to-emerald-400"
      : clamped >= 40
        ? "from-amber-500 to-amber-400"
        : "from-rose-500 to-rose-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full bg-gradient-to-r", tone)} style={{ width: `${clamped}%` }} />
      </div>
      <span className="w-7 text-right text-xs font-medium tabular-nums">{clamped}</span>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? STATUS_TONE.new;
  const label = LEAD_STATUSES.find((s) => s.value === status)?.label ?? status;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        tone.bg,
        tone.text,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
      {label}
    </span>
  );
}
