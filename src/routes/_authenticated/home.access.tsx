// /home/access — TechERP Access Control Center (Fase 2: CRUD)
// Central de Cargos, Pacotes, Matriz e Membros.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  Shield,
  Users,
  Package,
  Grid3x3,
  Lock,
  CheckCircle2,
  EyeOff,
  Asterisk,
  Ban,
  Plus,
  Pencil,
  Trash2,
  UserCog,
  ClipboardList,
  UserSearch,
  BarChart3,
} from "lucide-react";
import { getAccessBundle, type AccessBundle } from "@/lib/access-control/access.functions";
import {
  RoleEditorDialog,
  PermissionSetEditorDialog,
  FieldRuleEditorDialog,
  MemberAssignmentDialog,
  DeleteAccessRowDialog,
} from "@/components/access-control/access-dialogs";
import {
  AuditTab,
  SimulationTab,
  ReportsTab,
} from "@/components/access-control/governance-tabs";
import { PageHeader, SectionHeader, MetricCard, EmptyState } from "@/components/techhire/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/home/access")({
  component: AccessCenter,
});

const MODULE_META: Record<string, { label: string; tone: string }> = {
  techsales: { label: "TechSales", tone: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  techhire: { label: "TechHire", tone: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  system: { label: "Sistema", tone: "bg-slate-500/10 text-slate-600 border-slate-500/20" },
};

const ACTION_LABEL: Record<string, string> = {
  view: "Visualizar",
  create: "Criar",
  update: "Editar",
  delete: "Excluir",
  export: "Exportar",
  approve: "Aprovar",
  assign: "Atribuir",
  manage: "Gerenciar",
};

const SCOPE_LABEL: Record<string, string> = {
  own: "Próprios",
  team: "Equipe",
  workspace: "Workspace",
  org: "Organização",
};

function ModuleBadge({ module }: { module: string }) {
  const meta = MODULE_META[module] ?? { label: module, tone: "" };
  return (
    <Badge variant="outline" className={cn("border", meta.tone)}>
      {meta.label}
    </Badge>
  );
}

function AccessCenter() {
  const fetchBundle = useServerFn(getAccessBundle);
  const { data, isLoading } = useQuery({
    queryKey: ["access-bundle"],
    queryFn: () => fetchBundle(),
  });

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 md:px-6 lg:px-8">
      <PageHeader
        eyebrow="TechERP"
        title="Controle de Acesso"
        description="Cargos, pacotes de permissões e regras de campo do TechERP"
      />


      {isLoading || !data ? <LoadingState /> : <Content data={data} />}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-24" />
      ))}
    </div>
  );
}

function Content({ data }: { data: AccessBundle }) {
  const [tab, setTab] = useState("roles");

  const stats = useMemo(() => {
    const modules = new Set(data.permissions.map((p) => p.module));
    return {
      modules: modules.size,
      permissions: data.permissions.length,
      sets: data.permission_sets.length,
      roles: data.job_roles.length,
      members: data.members.length,
      rules: data.field_rules.length,
    };
  }, [data]);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Módulos"
          value={stats.modules}
          icon={Grid3x3}
          hint={`${stats.permissions} permissões catalogadas`}
        />
        <MetricCard
          label="Cargos"
          value={stats.roles}
          icon={Shield}
          hint="Papéis reutilizáveis"
        />
        <MetricCard
          label="Pacotes de permissão"
          value={stats.sets}
          icon={Package}
          hint="Blocos combináveis"
        />
        <MetricCard
          label="Regras de campo"
          value={stats.rules}
          icon={Lock}
          hint="Mascaramento e ocultação"
        />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="roles">
            <Shield className="mr-2 h-4 w-4" /> Cargos
          </TabsTrigger>
          <TabsTrigger value="sets">
            <Package className="mr-2 h-4 w-4" /> Pacotes
          </TabsTrigger>
          <TabsTrigger value="matrix">
            <Grid3x3 className="mr-2 h-4 w-4" /> Matriz
          </TabsTrigger>
          <TabsTrigger value="fields">
            <Lock className="mr-2 h-4 w-4" /> Campos sensíveis
          </TabsTrigger>
          <TabsTrigger value="members">
            <Users className="mr-2 h-4 w-4" /> Membros ({stats.members})
          </TabsTrigger>
          <TabsTrigger value="audit">
            <ClipboardList className="mr-2 h-4 w-4" /> Auditoria
          </TabsTrigger>
          <TabsTrigger value="simulate">
            <UserSearch className="mr-2 h-4 w-4" /> Simular
          </TabsTrigger>
          <TabsTrigger value="reports">
            <BarChart3 className="mr-2 h-4 w-4" /> Relatórios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="space-y-4">
          <RolesTab data={data} />
        </TabsContent>

        <TabsContent value="sets" className="space-y-4">
          <SetsTab data={data} />
        </TabsContent>

        <TabsContent value="matrix" className="space-y-4">
          <MatrixTab data={data} />
        </TabsContent>

        <TabsContent value="fields" className="space-y-4">
          <FieldsTab data={data} />
        </TabsContent>

        <TabsContent value="members" className="space-y-4">
          <MembersTab data={data} />
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <AuditTab />
        </TabsContent>

        <TabsContent value="simulate" className="space-y-4">
          <SimulationTab data={data} />
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <ReportsTab />
        </TabsContent>
      </Tabs>
    </>
  );
}

// -------------- Roles Tab --------------
function RolesTab({ data }: { data: AccessBundle }) {
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<AccessBundle["job_roles"][number] | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<AccessBundle["job_roles"][number] | null>(null);
  const setsById = useMemo(
    () => new Map(data.permission_sets.map((s) => [s.id, s])),
    [data.permission_sets],
  );
  const filtered = data.job_roles.filter(
    (r) =>
      !q ||
      r.name.toLowerCase().includes(q.toLowerCase()) ||
      (r.description ?? "").toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <SectionHeader
          title="Cargos (Job Roles)"
          description="Cada cargo agrupa um ou mais pacotes de permissões e representa um papel/função dentro do TechERP."
        />
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Novo cargo
        </Button>
      </div>
      <Input
        placeholder="Buscar cargo..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-md"
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((role) => {
          const sets = role.set_ids
            .map((id) => setsById.get(id))
            .filter((s): s is NonNullable<typeof s> => Boolean(s));
          const permCount = new Set(sets.flatMap((s) => s.permission_keys)).size;
          return (
            <Card key={role.id}>
              <CardHeader className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: role.color ?? "#94a3b8" }}
                    />
                    {role.name}
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    {role.is_system ? (
                      <Badge variant="secondary" className="text-[10px]">
                        Sistema
                      </Badge>
                    ) : (
                      <Badge className="text-[10px]">Custom</Badge>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => setEditing(role)}
                      aria-label="Editar cargo"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {!role.is_system ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => setDeleting(role)}
                        aria-label="Excluir cargo"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                  </div>
                </div>
                {role.description ? (
                  <CardDescription>{role.description}</CardDescription>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Package className="h-3.5 w-3.5" /> {sets.length} pacotes
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {permCount} permissões
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    Escopo:{" "}
                    {role.data_scope === "own"
                      ? "Meus registros"
                      : role.data_scope === "team"
                        ? "Meu time"
                        : role.data_scope === "workspace"
                          ? "Workspace"
                          : "Personalizado"}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {sets.map((s) => (
                    <Badge key={s.id} variant="outline" className="gap-1">
                      <ModuleBadge module={s.module} />
                      <span>{s.name}</span>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <RoleEditorDialog
        open={creating || Boolean(editing)}
        onOpenChange={(v) => {
          if (!v) {
            setCreating(false);
            setEditing(null);
          }
        }}
        role={editing}
        data={data}
      />
      <DeleteAccessRowDialog
        open={Boolean(deleting)}
        onOpenChange={(v) => !v && setDeleting(null)}
        kind="role"
        id={deleting?.id ?? null}
        label={deleting?.name ?? ""}
      />
    </>
  );
}

// -------------- Sets Tab --------------
function SetsTab({ data }: { data: AccessBundle }) {
  const [editing, setEditing] = useState<AccessBundle["permission_sets"][number] | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<AccessBundle["permission_sets"][number] | null>(null);
  const permsByKey = useMemo(
    () => new Map(data.permissions.map((p) => [p.key, p])),
    [data.permissions],
  );
  const byModule = useMemo(() => {
    const m = new Map<string, typeof data.permission_sets>();
    for (const s of data.permission_sets) {
      const arr = m.get(s.module) ?? [];
      arr.push(s);
      m.set(s.module, arr);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [data.permission_sets]);

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <SectionHeader
          title="Pacotes de permissões"
          description="Blocos reutilizáveis de permissões. Um pacote pode ser atribuído a vários cargos e a usuários específicos."
        />
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Novo pacote
        </Button>
      </div>
      <div className="space-y-6">
        {byModule.map(([mod, sets]) => (
          <div key={mod} className="space-y-3">
            <div className="flex items-center gap-2">
              <ModuleBadge module={mod} />
              <span className="text-xs text-muted-foreground">{sets.length} pacotes</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {sets.map((s) => (
                <Card key={s.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-sm">{s.name}</CardTitle>
                      <div className="flex items-center gap-1">
                        {s.is_system ? (
                          <Badge variant="secondary" className="text-[10px]">
                            Sistema
                          </Badge>
                        ) : null}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => setEditing(s)}
                          aria-label="Editar pacote"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {!s.is_system ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={() => setDeleting(s)}
                            aria-label="Excluir pacote"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    {s.description ? (
                      <CardDescription className="text-xs">{s.description}</CardDescription>
                    ) : null}
                  </CardHeader>
                  <CardContent>
                    <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                      {s.permission_keys.length} permissões
                    </div>
                    <ul className="space-y-1 text-xs">
                      {s.permission_keys.slice(0, 8).map((k) => {
                        const p = permsByKey.get(k);
                        return (
                          <li key={k} className="flex items-center gap-2 text-muted-foreground">
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                            <span className="truncate">{p?.label_pt ?? k}</span>
                            <span className="ml-auto text-[10px] opacity-60">
                              {SCOPE_LABEL[p?.scope ?? ""] ?? p?.scope}
                            </span>
                          </li>
                        );
                      })}
                      {s.permission_keys.length > 8 ? (
                        <li className="pt-1 text-[11px] italic text-muted-foreground">
                          +{s.permission_keys.length - 8} outras
                        </li>
                      ) : null}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
      <PermissionSetEditorDialog
        open={creating || Boolean(editing)}
        onOpenChange={(v) => {
          if (!v) {
            setCreating(false);
            setEditing(null);
          }
        }}
        set={editing}
        data={data}
      />
      <DeleteAccessRowDialog
        open={Boolean(deleting)}
        onOpenChange={(v) => !v && setDeleting(null)}
        kind="set"
        id={deleting?.id ?? null}
        label={deleting?.name ?? ""}
      />
    </>
  );
}

// -------------- Matrix Tab --------------
function MatrixTab({ data }: { data: AccessBundle }) {
  // Compute effective permissions per role (union of permission_set_items across sets)
  const setsById = useMemo(
    () => new Map(data.permission_sets.map((s) => [s.id, s])),
    [data.permission_sets],
  );
  const permsById = useMemo(
    () => new Map(data.permissions.map((p) => [p.key, p])),
    [data.permissions],
  );

  const rolePerms = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const r of data.job_roles) {
      const set = new Set<string>();
      for (const sid of r.set_ids) {
        const s = setsById.get(sid);
        if (!s) continue;
        for (const k of s.permission_keys) set.add(k);
      }
      m.set(r.id, set);
    }
    return m;
  }, [data.job_roles, setsById]);

  const groups = useMemo(() => {
    const g = new Map<string, Map<string, string[]>>(); // module -> resource -> perm keys
    for (const p of data.permissions) {
      if (!g.has(p.module)) g.set(p.module, new Map());
      const rm = g.get(p.module)!;
      const arr = rm.get(p.resource) ?? [];
      arr.push(p.key);
      rm.set(p.resource, arr);
    }
    return Array.from(g.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [data.permissions]);

  return (
    <>
      <SectionHeader
        title="Matriz Cargo × Permissão"
        description="Visão consolidada de quais cargos concedem cada permissão. Útil para auditoria rápida."
      />
      <div className="rounded-md border overflow-auto">
        <Table className="text-xs">
          <TableHeader className="sticky top-0 bg-background">
            <TableRow>
              <TableHead className="min-w-[280px]">Permissão</TableHead>
              {data.job_roles.map((r) => (
                <TableHead key={r.id} className="text-center whitespace-nowrap">
                  <div
                    className="mx-auto h-2 w-2 rounded-full mb-1"
                    style={{ backgroundColor: r.color ?? "#94a3b8" }}
                  />
                  <div className="text-[10px] font-normal">{r.name}</div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map(([mod, resources]) => (
              <>
                <TableRow key={`h-${mod}`} className="bg-muted/50">
                  <TableCell colSpan={data.job_roles.length + 1}>
                    <ModuleBadge module={mod} />
                  </TableCell>
                </TableRow>
                {Array.from(resources.entries()).flatMap(([res, keys]) =>
                  keys.map((k) => {
                    const p = permsById.get(k)!;
                    return (
                      <TableRow key={k}>
                        <TableCell>
                          <div className="font-medium">{p.label_pt}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {res} · {ACTION_LABEL[p.action]} · {SCOPE_LABEL[p.scope]}
                          </div>
                        </TableCell>
                        {data.job_roles.map((r) => (
                          <TableCell key={r.id} className="text-center">
                            {rolePerms.get(r.id)?.has(k) ? (
                              <CheckCircle2 className="mx-auto h-3.5 w-3.5 text-emerald-500" />
                            ) : (
                              <span className="text-muted-foreground/30">·</span>
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  }),
                )}
              </>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

// -------------- Fields Tab --------------
function FieldsTab({ data }: { data: AccessBundle }) {
  const [editing, setEditing] = useState<AccessBundle["field_rules"][number] | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<AccessBundle["field_rules"][number] | null>(null);
  const setsById = useMemo(
    () => new Map(data.permission_sets.map((s) => [s.id, s])),
    [data.permission_sets],
  );
  const rolesById = useMemo(
    () => new Map(data.job_roles.map((r) => [r.id, r])),
    [data.job_roles],
  );

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <SectionHeader
          title="Regras de campo (Field-Level Security)"
          description="Campos sensíveis mascarados, ocultados ou marcados como somente leitura conforme cargo ou pacote."
        />
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Nova regra
        </Button>
      </div>
      {data.field_rules.length === 0 ? (
        <EmptyState
          icon={Lock}
          title="Nenhuma regra de campo"
          description="Clique em Nova regra para adicionar."
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recurso</TableHead>
                <TableHead>Campo</TableHead>
                <TableHead>Modo</TableHead>
                <TableHead>Aplica-se a</TableHead>
                <TableHead className="w-[100px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.field_rules.map((r) => {
                const target = r.role_id
                  ? rolesById.get(r.role_id)?.name
                  : r.set_id
                    ? setsById.get(r.set_id)?.name
                    : "—";
                const ModeIcon =
                  r.mode === "hidden" ? EyeOff : r.mode === "masked" ? Asterisk : Ban;
                const modeLabel =
                  r.mode === "hidden"
                    ? "Oculto"
                    : r.mode === "masked"
                      ? "Mascarado"
                      : "Somente leitura";
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.resource}</TableCell>
                    <TableCell className="font-mono text-xs">{r.field}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1">
                        <ModeIcon className="h-3 w-3" />
                        {modeLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {target}
                      {r.is_system ? (
                        <Badge variant="secondary" className="ml-2 text-[10px]">
                          Sistema
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => setEditing(r)}
                        aria-label="Editar regra"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {!r.is_system ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={() => setDeleting(r)}
                          aria-label="Excluir regra"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <FieldRuleEditorDialog
        open={creating || Boolean(editing)}
        onOpenChange={(v) => {
          if (!v) {
            setCreating(false);
            setEditing(null);
          }
        }}
        rule={editing}
        data={data}
      />
      <DeleteAccessRowDialog
        open={Boolean(deleting)}
        onOpenChange={(v) => !v && setDeleting(null)}
        kind="field_rule"
        id={deleting?.id ?? null}
        label={
          deleting ? `${deleting.resource}.${deleting.field}` : ""
        }
      />
    </>
  );
}

// -------------- Members Tab --------------
function MembersTab({ data }: { data: AccessBundle }) {
  const rolesById = useMemo(
    () => new Map(data.job_roles.map((r) => [r.id, r])),
    [data.job_roles],
  );
  const setsById = useMemo(
    () => new Map(data.permission_sets.map((s) => [s.id, s])),
    [data.permission_sets],
  );

  const [managing, setManaging] = useState<AccessBundle["members"][number] | null>(null);

  return (
    <>
      <SectionHeader
        title="Membros do workspace"
        description="Cargo principal e pacotes extras atribuídos a cada membro."
      />
      {data.members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum membro"
          description="Convide membros pela tela de Time do workspace."
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Membro</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Cargo principal</TableHead>
                <TableHead>Pacotes extras</TableHead>
                <TableHead className="w-[120px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.members.map((m) => {
                const primary = m.primary_role_id ? rolesById.get(m.primary_role_id) : null;
                return (
                  <TableRow key={m.user_id}>
                    <TableCell className="font-medium">
                      {m.full_name || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {m.email || "—"}
                    </TableCell>
                    <TableCell>
                      {primary ? (
                        <Badge variant="outline" className="gap-1.5">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: primary.color ?? "#94a3b8" }}
                          />
                          {primary.name}
                        </Badge>
                      ) : (
                        <span className="text-xs italic text-muted-foreground">
                          Não atribuído
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {m.extra_set_ids.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          m.extra_set_ids.map((sid) => {
                            const s = setsById.get(sid);
                            return s ? (
                              <Badge key={sid} variant="secondary" className="text-[10px]">
                                {s.name}
                              </Badge>
                            ) : null;
                          })
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setManaging(m)}
                        className="gap-1.5"
                      >
                        <UserCog className="h-3.5 w-3.5" /> Gerenciar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <MemberAssignmentDialog
        open={Boolean(managing)}
        onOpenChange={(v) => !v && setManaging(null)}
        member={managing}
        data={data}
      />
    </>
  );
}
