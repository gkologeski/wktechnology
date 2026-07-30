// /settings/rbac-diagnostics — Diagnóstico de controle de acesso.
// Mostra as permissões efetivas do usuário e explica, item por item,
// por que cada entrada de menu está visível ou oculta.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ShieldCheck, Search, Copy, Check, AlertTriangle } from "lucide-react";
import { PageHeader, SectionHeader, MetricCard, EmptyState } from "@/components/techhire/ui";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  getRbacDiagnostics,
  listWorkspaceMembersForDiagnostics,
} from "@/lib/access-control/rbac-diagnostics.functions";
import { auditMenus, type MenuAuditRow } from "@/lib/menu-audit";
import type { Perms } from "@/lib/menu-config";

export const Route = createFileRoute("/_authenticated/settings/rbac-diagnostics")({
  head: () => ({
    meta: [
      { title: "Diagnóstico de acesso — TechERP" },
      {
        name: "description",
        content:
          "Veja as permissões efetivas do usuário e por que cada item do menu está visível ou oculto.",
      },
      { property: "og:title", content: "Diagnóstico de acesso — TechERP" },
      {
        property: "og:description",
        content: "Permissões efetivas e auditoria de visibilidade do menu do TechERP.",
      },
    ],
  }),
  component: RbacDiagnosticsPage,
});

type VisibilityFilter = "all" | "visible" | "hidden";

function RbacDiagnosticsPage() {
  const fetchDiag = useServerFn(getRbacDiagnostics);
  const fetchMembers = useServerFn(listWorkspaceMembersForDiagnostics);
  const [targetUserId, setTargetUserId] = useState<string>("me");
  const [q, setQ] = useState("");
  const [visibility, setVisibility] = useState<VisibilityFilter>("all");
  const [copied, setCopied] = useState<string | null>(null);

  const membersQuery = useQuery({
    queryKey: ["rbac-diagnostics-members"],
    queryFn: () => fetchMembers(),
    staleTime: 5 * 60_000,
  });

  const diagQuery = useQuery({
    queryKey: ["rbac-diagnostics", targetUserId],
    queryFn: () =>
      fetchDiag({ data: targetUserId === "me" ? {} : { userId: targetUserId } }),
    staleTime: 60_000,
  });

  const diag = diagQuery.data;

  const perms: Perms = useMemo(
    () => ({
      isAdmin: !!diag?.is_workspace_admin || !!diag?.is_workspace_owner,
      isManager:
        !!diag?.is_workspace_admin ||
        !!diag?.is_workspace_owner ||
        diag?.member_role === "manager",
      isPlatformAdmin: !!diag?.is_platform_admin,
      permissions: new Set(diag?.permissions ?? []),
    }),
    [diag],
  );

  const rows = useMemo<MenuAuditRow[]>(() => (diag ? auditMenus(perms) : []), [diag, perms]);

  const filteredRows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (visibility === "visible" && !r.visible) return false;
      if (visibility === "hidden" && r.visible) return false;
      if (!needle) return true;
      return (
        r.title.toLowerCase().includes(needle) ||
        r.url.toLowerCase().includes(needle) ||
        r.area.toLowerCase().includes(needle) ||
        r.group.toLowerCase().includes(needle) ||
        r.permissionAny.some((k) => k.toLowerCase().includes(needle))
      );
    });
  }, [rows, q, visibility]);

  const permsByModule = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const key of diag?.permissions ?? []) {
      const mod = key.split(".")[0] ?? "outros";
      if (!map.has(mod)) map.set(mod, []);
      map.get(mod)!.push(key);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [diag]);

  const visibleCount = rows.filter((r) => r.visible).length;

  async function copyKey(key: string) {
    try {
      await navigator.clipboard.writeText(key);
      setCopied(key);
      toast.success("Chave copiada");
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Não foi possível copiar a chave");
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        eyebrow="Controle de acesso"
        title="Diagnóstico de acesso"
        description="Veja as permissões efetivas de um usuário e entenda exatamente por que cada item do menu aparece ou está oculto."
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Usuário analisado</CardTitle>
          <CardDescription>
            Administradores do workspace podem inspecionar qualquer membro.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="rbac-user">Membro</Label>
            <Select value={targetUserId} onValueChange={setTargetUserId}>
              <SelectTrigger id="rbac-user" className="w-72">
                <SelectValue placeholder="Selecione um membro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="me">Eu mesmo</SelectItem>
                {(membersQuery.data ?? []).map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.full_name || m.user_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={() => diagQuery.refetch()}>
            Recalcular
          </Button>
        </CardContent>
      </Card>

      {diagQuery.isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {diagQuery.isError && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Não foi possível carregar o diagnóstico
            </CardTitle>
            <CardDescription>
              {(diagQuery.error as Error)?.message ??
                "Erro inesperado ao consultar as permissões."}{" "}
              Verifique se você é administrador do workspace e tente recalcular.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {diag && !diagQuery.isLoading && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Permissões efetivas" value={diag.permissions.length} />
            <MetricCard label="Cargos atribuídos" value={diag.job_roles.length} />
            <MetricCard label="Conjuntos extras" value={diag.permission_sets.length} />
            <MetricCard
              label="Itens de menu visíveis"
              value={`${visibleCount} / ${rows.length}`}
            />
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                {diag.full_name || diag.user_id}
              </CardTitle>
              <CardDescription>
                Workspace: {diag.workspace_name ?? "—"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Badge variant="secondary">Papel: {diag.member_role ?? "membro"}</Badge>
              {diag.is_workspace_owner && <Badge>Owner do workspace</Badge>}
              {diag.is_workspace_admin && <Badge>Admin do workspace</Badge>}
              {diag.is_platform_admin && <Badge variant="outline">Admin da plataforma</Badge>}
              {diag.job_roles.map((r) => (
                <Badge key={r.id} variant="outline">
                  Cargo: {r.name}
                  {r.is_primary ? " (primário)" : ""}
                </Badge>
              ))}
              {diag.permission_sets.map((s) => (
                <Badge key={s.id} variant="outline">
                  Conjunto: {s.name} · {s.module}
                </Badge>
              ))}
            </CardContent>
          </Card>

          <section className="space-y-3">
            <SectionHeader
              title="Auditoria do menu"
              description="Cada item do sidebar e das configurações, com a regra aplicada e as permissões que faltam."
            />
            <div className="flex flex-wrap items-end gap-3">
              <div className="relative w-full max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por item, rota, área ou chave de permissão"
                  aria-label="Buscar itens de menu"
                  className="pl-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rbac-visibility">Visibilidade</Label>
                <Select
                  value={visibility}
                  onValueChange={(v) => setVisibility(v as VisibilityFilter)}
                >
                  <SelectTrigger id="rbac-visibility" className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="visible">Somente visíveis</SelectItem>
                    <SelectItem value="hidden">Somente ocultos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {filteredRows.length === 0 ? (
              <EmptyState
                title="Nenhum item corresponde ao filtro"
                description="Ajuste a busca ou o filtro de visibilidade."
              />
            ) : (
              <div className="rounded-xl border border-border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Área</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Permissões que faltam</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map((r) => (
                      <TableRow key={`${r.area}-${r.group}-${r.url}-${r.title}`}>
                        <TableCell className="align-top">
                          <div className="font-medium">{r.title}</div>
                          <code className="text-xs text-muted-foreground">{r.url}</code>
                        </TableCell>
                        <TableCell className="align-top text-sm text-muted-foreground">
                          <div>{r.area}</div>
                          <div className="text-xs">{r.group}</div>
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge variant={r.visible ? "default" : "secondary"}>
                            {r.visible ? "Visível" : "Oculto"}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-top text-sm max-w-md">{r.reason}</TableCell>
                        <TableCell className="align-top">
                          {r.visible || r.missingKeys.length === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <ul className="space-y-1">
                              {r.missingKeys.map((k) => (
                                <li key={k} className="flex items-center gap-1.5">
                                  <code className="text-xs break-all">{k}</code>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    aria-label={`Copiar chave ${k}`}
                                    onClick={() => copyKey(k)}
                                  >
                                    {copied === k ? (
                                      <Check className="h-3.5 w-3.5" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <SectionHeader
              title="Permissões efetivas"
              description="Todas as chaves concedidas ao usuário neste workspace, agrupadas por módulo."
            />
            {permsByModule.length === 0 ? (
              <EmptyState
                title="Nenhuma permissão atribuída"
                description="Atribua um cargo ou conjunto de permissões em Controle de acesso › Membros."
              />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {permsByModule.map(([mod, keys]) => (
                  <Card key={mod}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm capitalize">{mod}</CardTitle>
                      <CardDescription>{keys.length} permissão(ões)</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      {keys.map((k) => (
                        <div key={k} className="text-sm">
                          <span className="font-medium">
                            {diag.permission_labels[k] ?? k}
                          </span>
                          <code className="ml-2 text-xs text-muted-foreground break-all">
                            {k}
                          </code>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
