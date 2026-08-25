// TechERP Access Control — Fase 6 UI: Auditoria, Simulação e Relatórios.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ClipboardList,
  UserSearch,
  BarChart3,
  Loader2,
  Search,
  ShieldCheck,
  EyeOff,
  Lock,
  Asterisk,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listAuditLog,
  simulateUser,
  getGovernanceReport,
  type AuditRow,
  type SimulationResult,
  type GovernanceReport,
} from "@/lib/access-control/governance.functions";
import type { AccessBundle } from "@/lib/access-control/access.functions";

// -------------------- Audit tab --------------------
export function AuditTab() {
  const list = useServerFn(listAuditLog);
  const [action, setAction] = useState<string>("all");
  const { data, isLoading } = useQuery({
    queryKey: ["access-audit", action],
    queryFn: () =>
      list({
        data: {
          limit: 200,
          action: action === "all" ? null : action,
          target_user_id: null,
        },
      }),
  });
  const rows = (data ?? []) as AuditRow[];
  const actions = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => s.add(r.action));
    return Array.from(s).sort();
  }, [rows]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4" /> Trilha de auditoria
          </CardTitle>
          <CardDescription>
            Últimas 200 alterações em cargos, pacotes, campos e atribuições de membros.
          </CardDescription>
        </div>
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Todas as ações" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as ações</SelectItem>
            {actions.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum evento de auditoria registrado ainda.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Entidade</TableHead>
                <TableHead>Alvo</TableHead>
                <TableHead>Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{r.action}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.entity_type}
                    {r.entity_id ? (
                      <span className="ml-1 text-xs text-muted-foreground">
                        #{r.entity_id.slice(0, 8)}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.target_user_id ? r.target_user_id.slice(0, 8) : "—"}
                  </TableCell>
                  <TableCell className="max-w-[420px] truncate text-xs text-muted-foreground">
                    {r.details ? JSON.stringify(r.details) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// -------------------- Simulation tab --------------------
export function SimulationTab({ data }: { data: AccessBundle }) {
  const simulate = useServerFn(simulateUser);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);

  const members = data.members.filter((m) =>
    (m.full_name ?? m.email ?? m.user_id).toLowerCase().includes(q.toLowerCase()),
  );

  async function run(userId: string) {
    setSelected(userId);
    setLoading(true);
    try {
      const r = await simulate({ data: { user_id: userId } });
      setResult(r);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,280px)_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserSearch className="h-4 w-4" /> Simular usuário
          </CardTitle>
          <CardDescription>Veja o acesso efetivo de qualquer membro.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar membro"
              className="pl-8"
            />
          </div>
          <div className="max-h-[420px] space-y-1 overflow-y-auto pr-1">
            {members.map((m) => (
              <Button
                key={m.user_id}
                variant={selected === m.user_id ? "secondary" : "ghost"}
                className="w-full justify-start"
                onClick={() => run(m.user_id)}
              >
                <span className="truncate text-sm">
                  {m.full_name ?? m.email ?? m.user_id.slice(0, 8)}
                </span>
              </Button>
            ))}
            {members.length === 0 ? (
              <p className="px-2 py-4 text-xs text-muted-foreground">
                Nenhum membro corresponde à busca.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resultado da simulação</CardTitle>
          <CardDescription>
            Permissões e campos sensíveis calculados pelos mesmos SQLs em produção.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Calculando…
            </div>
          ) : !result ? (
            <p className="text-sm text-muted-foreground">
              Selecione um membro à esquerda para simular.
            </p>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="gap-1">
                  <ShieldCheck className="h-3 w-3" /> Escopo: {result.data_scope}
                </Badge>
                <Badge variant="outline">{result.permissions.length} permissões</Badge>
                <Badge variant="outline">{result.field_rules.length} regras de campo</Badge>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-medium">Permissões efetivas</h4>
                {result.permissions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nenhuma permissão explícita. Usuário só terá acesso público.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {result.permissions.map((p) => (
                      <Badge key={p} variant="secondary" className="font-mono text-[11px]">
                        {p}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="mb-2 text-sm font-medium">Campos sensíveis</h4>
                {result.field_rules.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nenhuma restrição de campo aplicada.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {result.field_rules.map((r, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs"
                      >
                        {r.mode === "hidden" ? (
                          <EyeOff className="h-3 w-3 text-red-500" />
                        ) : r.mode === "masked" ? (
                          <Asterisk className="h-3 w-3 text-amber-500" />
                        ) : (
                          <Lock className="h-3 w-3 text-blue-500" />
                        )}
                        <span className="font-mono">
                          {r.resource}.{r.field}
                        </span>
                        <Badge variant="outline" className="ml-auto">
                          {r.mode}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// -------------------- Reports tab --------------------
export function ReportsTab() {
  const report = useServerFn(getGovernanceReport);
  const { data, isLoading } = useQuery({
    queryKey: ["access-governance-report"],
    queryFn: () => report({}),
  });
  const r = data as GovernanceReport | null;

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }
  if (!r) {
    return (
      <p className="text-sm text-muted-foreground">Sem dados suficientes para gerar o relatório.</p>
    );
  }

  const scopeItems: Array<[string, number]> = [
    ["Somente meus", r.scope_breakdown.own],
    ["Meu time", r.scope_breakdown.team],
    ["Workspace inteiro", r.scope_breakdown.workspace],
    ["Personalizado", r.scope_breakdown.custom],
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4" /> Panorama de governança
          </CardTitle>
          <CardDescription>
            Indicadores essenciais para revisão periódica de acesso.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Metric label="Membros no workspace" value={r.total_members} />
          <Metric
            label="Membros sem cargo"
            value={r.members_without_role}
            tone={r.members_without_role > 0 ? "warning" : "ok"}
          />
          <Metric label="Regras de campo" value={r.field_rules} />
          <Metric label="Cargos do sistema" value={r.system_roles} />
          <Metric label="Cargos personalizados" value={r.custom_roles} />
          <Metric label="Pacotes personalizados" value={r.custom_sets} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição de escopo de dados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {scopeItems.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <span>{label}</span>
                <Badge variant="outline">{value}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Membros por cargo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {r.members_by_role.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum cargo atribuído.</p>
            ) : (
              r.members_by_role.map((row) => (
                <div key={row.role_id} className="flex items-center justify-between text-sm">
                  <span className="truncate">{row.role_name}</span>
                  <Badge variant="secondary">{row.count}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warning" }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={
          tone === "warning"
            ? "mt-1 text-2xl font-semibold text-amber-600"
            : "mt-1 text-2xl font-semibold"
        }
      >
        {value}
      </div>
    </div>
  );
}
