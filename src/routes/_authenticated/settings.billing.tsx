// /settings/billing — usuário visualiza plano atual, uso e tabela comparativa.
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Lock, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Can } from "@/lib/access-control/use-permissions";
import { BILLING_MANAGE } from "@/lib/access-control/admin-permission-keys";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getMyPlan, listPlansWithEntitlements, requestSelfUpgrade } from "@/lib/billing.functions";
import { PLAN_LABELS, type PlanCode } from "@/lib/entitlements";
import { useEntitlements } from "@/lib/use-entitlements";
import { ModulePlansSection } from "@/components/billing/module-plans-section";

export const Route = createFileRoute("/_authenticated/settings/billing")({
  component: BillingPage,
});

const ENTITY_KEYS: Array<{ key: string; label: string }> = [
  { key: "leads.max", label: "Leads" },
  { key: "contacts.max", label: "Contatos" },
  { key: "companies.max", label: "Empresas" },
  { key: "deals.max", label: "Negócios" },
  { key: "ats.jobs.max", label: "Vagas ativas (ATS)" },
  { key: "ats.candidates.max", label: "Candidatos (ATS)" },
];

const MONTHLY_KEYS: Array<{ key: string; label: string }> = [
  { key: "email.sends.monthly", label: "Envios de e-mail (mês)" },
  { key: "email_broadcasts.monthly", label: "Campanhas de e-mail (mês)" },
  { key: "twilio.minutes.monthly", label: "Minutos de chamada (mês)" },
  { key: "enrichment.monthly", label: "Enriquecimentos (mês)" },
  { key: "ai_compose.monthly", label: "IA — gerar (mês)" },
  { key: "ai_summaries.monthly", label: "IA — resumos (mês)" },
  { key: "ats.applications.monthly", label: "Candidaturas recebidas (mês)" },
  { key: "ats.cv_parse.monthly", label: "Parsing de CV com IA (mês)" },
];

// Linhas exibidas na tabela comparativa.
const COMPARE_ROWS: Array<{ key: string; label: string; kind: "limit" | "flag" }> = [
  { key: "leads.max", label: "Leads", kind: "limit" },
  { key: "contacts.max", label: "Contatos", kind: "limit" },
  { key: "companies.max", label: "Empresas", kind: "limit" },
  { key: "deals.max", label: "Negócios", kind: "limit" },
  { key: "users.max", label: "Usuários", kind: "limit" },
  { key: "pipelines.max", label: "Pipelines", kind: "limit" },
  { key: "custom_properties.max", label: "Propriedades customizadas", kind: "limit" },
  { key: "custom_objects.max", label: "Objetos customizados", kind: "limit" },
  { key: "email_templates.max", label: "Templates de e-mail", kind: "limit" },
  { key: "forms.max", label: "Formulários", kind: "limit" },
  { key: "dashboards.max", label: "Dashboards", kind: "limit" },
  { key: "workflows.active.max", label: "Workflows ativos", kind: "limit" },
  { key: "sequences.active.max", label: "Sequências ativas", kind: "limit" },
  { key: "whatsapp_numbers.max", label: "Números WhatsApp", kind: "limit" },
  { key: "webhooks.max", label: "Webhooks", kind: "limit" },
  { key: "api_keys.max", label: "API Keys", kind: "limit" },
  { key: "audit_log.days", label: "Retenção de audit log (dias)", kind: "limit" },
  { key: "email.sends.monthly", label: "Envios de e-mail / mês", kind: "limit" },
  { key: "twilio.minutes.monthly", label: "Minutos de chamada / mês", kind: "limit" },
  { key: "ai_compose.monthly", label: "IA — gerações / mês", kind: "limit" },
  { key: "enrichment.monthly", label: "Enriquecimentos / mês", kind: "limit" },
  { key: "feature.whatsapp_inbox", label: "WhatsApp Inbox", kind: "flag" },
  { key: "feature.whatsapp_campaigns", label: "Campanhas WhatsApp", kind: "flag" },
  { key: "feature.sequences", label: "Sequências (cadências)", kind: "flag" },
  { key: "feature.scoring_rules", label: "Lead Scoring por regras", kind: "flag" },
  { key: "feature.scoring_ai", label: "Lead Scoring com IA", kind: "flag" },
  { key: "feature.macros", label: "Macros", kind: "flag" },
  { key: "feature.sla", label: "SLA por estágio", kind: "flag" },
  { key: "feature.rotation", label: "Rotação de leads", kind: "flag" },
  { key: "feature.playbooks", label: "Playbooks", kind: "flag" },
  { key: "feature.surveys", label: "Pesquisas (CSAT)", kind: "flag" },
  { key: "feature.goals", label: "Metas", kind: "flag" },
  { key: "feature.scheduled_exports", label: "Exports agendados", kind: "flag" },
  { key: "feature.sentiment", label: "Análise de sentimento", kind: "flag" },
  { key: "feature.quotes", label: "Quotes / Propostas", kind: "flag" },
  { key: "feature.recurring", label: "Cobrança recorrente", kind: "flag" },
  { key: "feature.esign", label: "Assinatura eletrônica", kind: "flag" },
  { key: "feature.tickets", label: "Tickets de suporte", kind: "flag" },
  { key: "feature.portal", label: "Portal do cliente", kind: "flag" },
  { key: "feature.portal_whitelabel", label: "Portal white-label", kind: "flag" },
  { key: "feature.booking", label: "Agendamento", kind: "flag" },
  { key: "feature.custom_roles", label: "Roles customizadas (RBAC)", kind: "flag" },
  { key: "feature.branding_colors", label: "Cores customizadas", kind: "flag" },
  { key: "feature.white_label", label: "White-label completo", kind: "flag" },
];

function formatLimit(
  limit: number | null,
  enabled: boolean,
  kind: "limit" | "flag",
): React.ReactNode {
  if (!enabled) return <Lock className="inline h-4 w-4 text-muted-foreground" />;
  if (kind === "flag") return <Check className="inline h-4 w-4 text-primary" />;
  if (limit === null) return <span className="text-sm font-medium">Ilimitado</span>;
  return <span className="text-sm">{limit.toLocaleString("pt-BR")}</span>;
}

function BillingPage() {
  const ent = useEntitlements();
  const planFetcher = useServerFn(getMyPlan);
  const listFetcher = useServerFn(listPlansWithEntitlements);
  const upgradeFn = useServerFn(requestSelfUpgrade);
  const qc = useQueryClient();

  const planQuery = useQuery({
    queryKey: ["billing", "my-plan"],
    queryFn: () => planFetcher(),
  });
  const plansQuery = useQuery({
    queryKey: ["billing", "plans-compare"],
    queryFn: () => listFetcher(),
  });

  const upgrade = useMutation({
    mutationFn: (plan_code: PlanCode) => upgradeFn({ data: { plan_code } }),
    onSuccess: () => {
      toast.success("Plano alterado. Pagamento será integrado em breve.");
      qc.invalidateQueries({ queryKey: ["billing"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const plan = planQuery.data?.plan;
  const plans = plansQuery.data?.plans ?? [];
  const entitlements = plansQuery.data?.entitlements ?? {};

  return (
    <div className="space-y-6">
      <PageHeader
        title="Planos e cobrança"
        description="Visualize seu plano atual, consumo e compare os planos disponíveis."
      />
      <ModulePlansSection />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Plano atual: {plan?.name ?? "Free"}
              </CardTitle>
              <CardDescription>Status: {planQuery.data?.status ?? "—"}</CardDescription>
            </div>
            <Badge variant="secondary" className="text-base">
              R$ {Number(plan?.price_monthly ?? 0).toFixed(2)} / mês
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <section>
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
              Limites de entidades
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {ENTITY_KEYS.map(({ key, label }) => {
                const info = ent.info(key);
                const limit = info.limit;
                const pct = limit && limit > 0 ? Math.min(100, (info.used / limit) * 100) : 0;
                return (
                  <div key={key} className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="mt-1 text-lg font-semibold">
                      {info.used.toLocaleString("pt-BR")}
                      <span className="text-sm font-normal text-muted-foreground">
                        {" "}
                        / {limit === null ? "∞" : limit.toLocaleString("pt-BR")}
                      </span>
                    </div>
                    {limit !== null && <Progress className="mt-2 h-1" value={pct} />}
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Cotas mensais</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {MONTHLY_KEYS.map(({ key, label }) => {
                const info = ent.info(key);
                if (!info.enabled) {
                  return (
                    <div key={key} className="rounded-md border p-3 opacity-60">
                      <div className="text-xs text-muted-foreground">{label}</div>
                      <div className="mt-1 flex items-center gap-1 text-sm">
                        <Lock className="h-3 w-3" /> Não incluso
                      </div>
                    </div>
                  );
                }
                const limit = info.limit;
                const pct = limit && limit > 0 ? Math.min(100, (info.used / limit) * 100) : 0;
                return (
                  <div key={key} className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="mt-1 text-sm font-semibold">
                      {info.used.toLocaleString("pt-BR")}
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        / {limit === null ? "Ilimitado" : limit.toLocaleString("pt-BR")}
                      </span>
                    </div>
                    {limit !== null && <Progress className="mt-2 h-1" value={pct} />}
                  </div>
                );
              })}
            </div>
          </section>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comparativo de planos</CardTitle>
          <CardDescription>
            Escolha um plano abaixo. A cobrança real será integrada em breve.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            {plans.map((p) => {
              const isCurrent = p.code === plan?.code;
              return (
                <Card key={p.code as string} className={isCurrent ? "border-primary" : ""}>
                  <CardHeader>
                    <CardTitle className="text-base">{p.name as string}</CardTitle>
                    <CardDescription>R$ {Number(p.price_monthly).toFixed(2)} / mês</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Can
                      any={BILLING_MANAGE}
                      fallback={
                        <Button className="w-full" variant="secondary" disabled>
                          {isCurrent ? "Plano atual" : "Sem permissão"}
                        </Button>
                      }
                    >
                      <Button
                        className="w-full"
                        variant={isCurrent ? "secondary" : "default"}
                        disabled={isCurrent || upgrade.isPending}
                        onClick={() => upgrade.mutate(p.code as PlanCode)}
                      >
                        {isCurrent
                          ? "Plano atual"
                          : `Mudar para ${PLAN_LABELS[p.code as PlanCode]}`}
                      </Button>
                    </Can>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[220px]">Recurso</TableHead>
                  {plans.map((p) => (
                    <TableHead key={p.code as string} className="text-center">
                      {p.name as string}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {COMPARE_ROWS.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell className="text-sm">{row.label}</TableCell>
                    {plans.map((p) => {
                      const e = (entitlements[row.key] ?? []).find((x) => x.plan_code === p.code);
                      return (
                        <TableCell key={p.code as string} className="text-center">
                          {e ? formatLimit(e.limit_int, e.enabled, row.kind) : "—"}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
