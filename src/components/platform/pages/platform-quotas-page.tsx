import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listWorkspaceQuotas } from "@/lib/platform-observability.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useIsPlatformAdmin } from "@/lib/use-platform-admin";


// Limites de referência por plano (display-only; cobrança real via Stripe).
const PLAN_LIMITS: Record<string, Record<string, number>> = {
  free: { emails_sent: 500, whatsapp_sent: 100, api_requests: 1000, ai_credits: 100 },
  starter: { emails_sent: 5000, whatsapp_sent: 1000, api_requests: 10000, ai_credits: 1000 },
  pro: { emails_sent: 50000, whatsapp_sent: 10000, api_requests: 100000, ai_credits: 10000 },
  enterprise: {
    emails_sent: 500000,
    whatsapp_sent: 100000,
    api_requests: 1000000,
    ai_credits: 100000,
  },
};

const COUNTER_KEYS = ["emails_sent", "whatsapp_sent", "api_requests", "ai_credits"] as const;
const COUNTER_LABELS: Record<string, string> = {
  emails_sent: "Emails",
  whatsapp_sent: "WhatsApp",
  api_requests: "API",
  ai_credits: "IA",
};

function UsageBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const color = pct >= 100 ? "destructive" : pct >= 80 ? "secondary" : "default";
  return (
    <div className="space-y-1 min-w-[140px]">
      <div className="flex justify-between text-xs">
        <span>
          {used.toLocaleString("pt-BR")}/{limit.toLocaleString("pt-BR")}
        </span>
        <Badge variant={color as any} className="h-4 text-[10px]">
          {pct}%
        </Badge>
      </div>
      <Progress value={pct} className="h-1.5" />
    </div>
  );
}

export function AdminQuotasPage() {
  const { isPlatformAdmin, loading } = useIsPlatformAdmin();
  const fn = useServerFn(listWorkspaceQuotas);
  const { data, isLoading } = useQuery({
    queryKey: ["platform-quotas"],
    queryFn: () => fn(),
    enabled: isPlatformAdmin,
  });

  if (loading) return <div className="p-6">Carregando…</div>;
  if (!isPlatformAdmin) return <div className="p-6">Acesso restrito a super-admins.</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Quotas por Workspace</h1>
        <p className="text-sm text-muted-foreground">
          Uso mensal versus limite do plano. Alerta automático em 80%.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Workspaces</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            "Carregando…"
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Plano</TableHead>
                  {COUNTER_KEYS.map((k) => (
                    <TableHead key={k}>{COUNTER_LABELS[k]}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.items ?? []).map((w: any) => {
                  const limits = PLAN_LIMITS[w.plan] ?? PLAN_LIMITS.free;
                  return (
                    <TableRow key={w.id}>
                      <TableCell>
                        <div className="font-medium">{w.name}</div>
                        <div className="text-xs text-muted-foreground">{w.slug}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{w.plan}</Badge>
                      </TableCell>
                      {COUNTER_KEYS.map((k) => (
                        <TableCell key={k}>
                          <UsageBar used={Number(w.usage?.[k] ?? 0)} limit={limits[k] ?? 0} />
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
