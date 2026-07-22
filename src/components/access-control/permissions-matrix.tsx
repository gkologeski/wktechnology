// Unified matrix editor: Role × (Resource × Action × Scope).
// Reads catalog + roles via getAccessBundle; toggles bundles via setRolePermission.
// System roles are rendered as read-only.
import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAccessBundle, type AccessBundle } from "@/lib/access-control/access.functions";
import {
  setRolePermission,
  bulkSetRolePermissions,
  getMatrixState,
} from "@/lib/access-control/role-bundle.functions";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Lock, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const MODULE_META: Record<string, { label: string; tone: string }> = {
  techsales: { label: "TechSales", tone: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  techhire: { label: "TechHire", tone: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  techpeople: { label: "TechPeople", tone: "bg-violet-500/10 text-violet-600 border-violet-500/20" },
  techcontracts: { label: "TechContracts", tone: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  techservice: { label: "TechService", tone: "bg-rose-500/10 text-rose-600 border-rose-500/20" },
  techfinance: { label: "TechFinance", tone: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20" },
  techprojects: { label: "TechProjects", tone: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20" },
  system: { label: "Sistema", tone: "bg-slate-500/10 text-slate-600 border-slate-500/20" },
};

const SCOPE_LABEL: Record<string, string> = {
  own: "Próprio",
  team: "Equipe",
  workspace: "Workspace",
  org: "Organização",
};

const ACTION_LABEL: Record<string, string> = {
  view: "Ver",
  create: "Criar",
  update: "Editar",
  delete: "Excluir",
  export: "Exportar",
  approve: "Aprovar",
  assign: "Atribuir",
  manage: "Gerenciar",
};

const MODULE_ORDER = [
  "techsales",
  "techhire",
  "techpeople",
  "techcontracts",
  "techservice",
  "techfinance",
  "techprojects",
  "system",
];

export function PermissionsMatrix() {
  const getBundleFn = useServerFn(getAccessBundle);
  const getMatrixFn = useServerFn(getMatrixState);
  const setPermFn = useServerFn(setRolePermission);
  const bulkFn = useServerFn(bulkSetRolePermissions);
  const qc = useQueryClient();

  const bundleQ = useQuery<AccessBundle>({
    queryKey: ["access", "bundle"],
    queryFn: () => getBundleFn(),
  });
  const matrixQ = useQuery<Record<string, string[]>>({
    queryKey: ["access", "matrix"],
    queryFn: () => getMatrixFn(),
  });

  const [activeModule, setActiveModule] = useState<string>("techsales");
  const [search, setSearch] = useState("");

  const toggleMut = useMutation({
    mutationFn: (v: { role_id: string; permission_key: string; granted: boolean }) =>
      setPermFn({ data: v }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ["access", "matrix"] });
      const prev = qc.getQueryData<Record<string, string[]>>(["access", "matrix"]);
      qc.setQueryData<Record<string, string[]>>(["access", "matrix"], (old) => {
        const next = { ...(old ?? {}) };
        const cur = new Set(next[v.role_id] ?? []);
        if (v.granted) cur.add(v.permission_key);
        else cur.delete(v.permission_key);
        next[v.role_id] = Array.from(cur);
        return next;
      });
      return { prev };
    },
    onError: (err: Error, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["access", "matrix"], ctx.prev);
      toast.error(err.message ?? "Falha ao atualizar permissão");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["access"] });
    },
  });

  const bulkMut = useMutation({
    mutationFn: (v: { role_id: string; keys: string[]; granted: boolean }) =>
      bulkFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["access"] });
      toast.success("Permissões atualizadas.");
    },
    onError: (err: Error) => toast.error(err.message ?? "Falha ao atualizar em massa"),
  });

  const modulesWithData = useMemo(() => {
    const present = new Set((bundleQ.data?.permissions ?? []).map((p) => p.module));
    return MODULE_ORDER.filter((m) => present.has(m));
  }, [bundleQ.data]);

  const filteredPerms = useMemo(() => {
    const list = (bundleQ.data?.permissions ?? []).filter((p) => p.module === activeModule);
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (p) =>
        p.label_pt.toLowerCase().includes(q) ||
        p.resource.toLowerCase().includes(q) ||
        p.key.toLowerCase().includes(q),
    );
  }, [bundleQ.data, activeModule, search]);

  // Group by resource for readability.
  const grouped = useMemo(() => {
    const g: Record<string, typeof filteredPerms> = {};
    for (const p of filteredPerms) (g[p.resource] ??= []).push(p);
    return g;
  }, [filteredPerms]);

  const roles = useMemo(() => bundleQ.data?.job_roles ?? [], [bundleQ.data]);

  if (bundleQ.isLoading || matrixQ.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (bundleQ.error) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        Falha ao carregar catálogo: {(bundleQ.error as Error).message}
      </div>
    );
  }

  const matrix = matrixQ.data ?? {};
  const isGranted = (roleId: string, key: string) => (matrix[roleId] ?? []).includes(key);

  return (
    <div className="space-y-4">
      <Tabs value={activeModule} onValueChange={setActiveModule}>
        <TabsList className="flex-wrap h-auto">
          {modulesWithData.map((m) => (
            <TabsTrigger key={m} value={m}>
              {MODULE_META[m]?.label ?? m}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar recurso, ação ou chave…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-md border overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 sticky top-0 z-10">
            <tr>
              <th className="text-left p-2 min-w-[280px] font-medium">Recurso / Ação</th>
              {roles.map((r) => (
                <th key={r.id} className="p-2 text-center font-medium whitespace-nowrap">
                  <div className="flex items-center justify-center gap-1">
                    <span>{r.name}</span>
                    {r.is_system && <Lock className="h-3 w-3 text-muted-foreground" />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(grouped).map(([resource, perms]) => (
              <>
                <tr key={`hdr-${resource}`} className="bg-muted/20">
                  <td colSpan={roles.length + 1} className="p-2 font-medium text-xs uppercase tracking-wide text-muted-foreground">
                    {resource}
                  </td>
                </tr>
                {perms.map((p) => (
                  <tr key={p.key} className="border-t hover:bg-muted/20">
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {ACTION_LABEL[p.action] ?? p.action}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {SCOPE_LABEL[p.scope] ?? p.scope}
                        </Badge>
                        <span className="text-foreground">{p.label_pt}</span>
                      </div>
                    </td>
                    {roles.map((r) => {
                      const granted = isGranted(r.id, p.key);
                      const disabled = r.is_system || toggleMut.isPending;
                      return (
                        <td key={r.id} className="p-2 text-center">
                          <Checkbox
                            checked={granted}
                            disabled={disabled}
                            onCheckedChange={(v) =>
                              toggleMut.mutate({
                                role_id: r.id,
                                permission_key: p.key,
                                granted: Boolean(v),
                              })
                            }
                            aria-label={`${r.name} — ${p.label_pt}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </>
            ))}
            {filteredPerms.length === 0 && (
              <tr>
                <td colSpan={roles.length + 1} className="p-6 text-center text-muted-foreground">
                  Nenhuma permissão encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {roles.some((r) => !r.is_system) && filteredPerms.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <span className="text-xs text-muted-foreground self-center mr-2">Aplicar em massa (módulo atual):</span>
          {roles
            .filter((r) => !r.is_system)
            .map((r) => (
              <div key={r.id} className="flex items-center gap-1">
                <span className="text-xs">{r.name}</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  disabled={bulkMut.isPending}
                  onClick={() =>
                    bulkMut.mutate({
                      role_id: r.id,
                      keys: filteredPerms.map((p) => p.key),
                      granted: true,
                    })
                  }
                >
                  Conceder todas
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  disabled={bulkMut.isPending}
                  onClick={() =>
                    bulkMut.mutate({
                      role_id: r.id,
                      keys: filteredPerms.map((p) => p.key),
                      granted: false,
                    })
                  }
                >
                  Remover todas
                </Button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
