// Unified matrix editor: Role × (Resource × Action × Scope).
// Reads catalog + roles via getAccessBundle; grava via bulkSetRolePermissions.
// System roles are read-only. Custom roles can be created / duplicated / renamed / deleted.
import { useEffect, useMemo, useState, Fragment } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAccessBundle, type AccessBundle } from "@/lib/access-control/access.functions";
import {
  bulkSetRolePermissions,
  getMatrixState,
  createJobRole,
  duplicateJobRole,
  renameJobRole,
  deleteJobRole,
  restoreRoleDefaults,
  copyRolePermissions,
} from "@/lib/access-control/role-bundle.functions";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildScopeMatrixRows,
  keysForSelection,
  selectValue,
  NONE_VALUE,
  NONE_LABEL,
  SCOPE_SELECT_LABELS,
  type ScopeMatrixRow,
  type ScopeValue,
} from "@/lib/access-control/scope-matrix";
import {
  Lock,
  Search,
  Plus,
  MoreVertical,
  Copy,
  ClipboardCopy,
  Pencil,
  Trash2,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

export const MODULE_META: Record<string, { label: string; tone: string }> = {
  techsales: { label: "TechSales", tone: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  techhire: { label: "TechHire", tone: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  techpeople: {
    label: "TechPeople",
    tone: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  },
  techcontracts: {
    label: "TechContracts",
    tone: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  },
  techservice: { label: "TechService", tone: "bg-rose-500/10 text-rose-600 border-rose-500/20" },
  techfinance: { label: "TechFinance", tone: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20" },
  techprojects: {
    label: "TechProjects",
    tone: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  },
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

type Role = AccessBundle["job_roles"][number];

export function PermissionsMatrix() {
  const getBundleFn = useServerFn(getAccessBundle);
  const getMatrixFn = useServerFn(getMatrixState);
  const bulkFn = useServerFn(bulkSetRolePermissions);
  const createRoleFn = useServerFn(createJobRole);
  const duplicateRoleFn = useServerFn(duplicateJobRole);
  const renameRoleFn = useServerFn(renameJobRole);
  const deleteRoleFn = useServerFn(deleteJobRole);
  const restoreFn = useServerFn(restoreRoleDefaults);
  const copyPermsFn = useServerFn(copyRolePermissions);
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

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [renameTarget, setRenameTarget] = useState<Role | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
  const [duplicateTarget, setDuplicateTarget] = useState<Role | null>(null);
  const [duplicateName, setDuplicateName] = useState("");
  const [copyTarget, setCopyTarget] = useState<Role | null>(null);
  const [copySource, setCopySource] = useState<Role | null>(null);
  const [copyMode, setCopyMode] = useState<"merge" | "replace">("merge");
  const [copyScope, setCopyScope] = useState<"module" | "all">("module");

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["access"] });
  };

  // Gravação granular por chave permanece disponível via bulkSetRolePermissions.

  const bulkMut = useMutation({
    mutationFn: (v: { role_id: string; keys: string[]; granted: boolean }) => bulkFn({ data: v }),
    onSuccess: () => {
      invalidateAll();
      toast.success("Permissões atualizadas.");
    },
    onError: (err: Error) => toast.error(err.message ?? "Falha ao atualizar em massa"),
  });

  // Troca de escopo de uma célula: concede a chave do escopo escolhido e
  // remove as demais chaves da mesma ação/recurso (escopo é exclusivo).
  const scopeMut = useMutation({
    mutationFn: async (v: { role_id: string; grant: string[]; revoke: string[] }) => {
      if (v.revoke.length)
        await bulkFn({ data: { role_id: v.role_id, keys: v.revoke, granted: false } });
      if (v.grant.length)
        await bulkFn({ data: { role_id: v.role_id, keys: v.grant, granted: true } });
    },
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ["access", "matrix"] });
      const prev = qc.getQueryData<Record<string, string[]>>(["access", "matrix"]);
      qc.setQueryData<Record<string, string[]>>(["access", "matrix"], (old) => {
        const next = { ...(old ?? {}) };
        const cur = new Set(next[v.role_id] ?? []);
        for (const k of v.revoke) cur.delete(k);
        for (const k of v.grant) cur.add(k);
        next[v.role_id] = Array.from(cur);
        return next;
      });
      return { prev };
    },
    onError: (err: Error, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["access", "matrix"], ctx.prev);
      toast.error(err.message ?? "Falha ao atualizar permissão");
    },
    onSuccess: invalidateAll,
  });

  const createMut = useMutation({
    mutationFn: (v: { name: string; description?: string | null }) => createRoleFn({ data: v }),
    onSuccess: () => {
      invalidateAll();
      setCreateOpen(false);
      setCreateName("");
      setCreateDesc("");
      toast.success("Cargo criado.");
    },
    onError: (err: Error) => toast.error(err.message ?? "Falha ao criar cargo"),
  });

  const duplicateMut = useMutation({
    mutationFn: (v: { source_role_id: string; name?: string }) => duplicateRoleFn({ data: v }),
    onSuccess: () => {
      invalidateAll();
      setDuplicateTarget(null);
      setDuplicateName("");
      toast.success("Cargo duplicado.");
    },
    onError: (err: Error) => toast.error(err.message ?? "Falha ao duplicar cargo"),
  });

  const renameMut = useMutation({
    mutationFn: (v: { role_id: string; name: string }) => renameRoleFn({ data: v }),
    onSuccess: () => {
      invalidateAll();
      setRenameTarget(null);
      toast.success("Cargo renomeado.");
    },
    onError: (err: Error) => toast.error(err.message ?? "Falha ao renomear cargo"),
  });

  const deleteMut = useMutation({
    mutationFn: (v: { role_id: string }) => deleteRoleFn({ data: v }),
    onSuccess: () => {
      invalidateAll();
      setDeleteTarget(null);
      toast.success("Cargo excluído.");
    },
    onError: (err: Error) => toast.error(err.message ?? "Falha ao excluir cargo"),
  });

  const restoreMut = useMutation({
    mutationFn: (v: { role_id: string }) => restoreFn({ data: v }),
    onSuccess: (res) => {
      invalidateAll();
      toast.success(`Padrões restaurados (${(res as { count: number }).count} permissões).`);
    },
    onError: (err: Error) => toast.error(err.message ?? "Falha ao restaurar padrões"),
  });

  const copyMut = useMutation({
    mutationFn: (v: {
      source_role_id: string;
      target_role_id: string;
      mode: "merge" | "replace";
      module?: string;
    }) => copyPermsFn({ data: v }),
    onSuccess: (res) => {
      invalidateAll();
      const r = res as { granted: number; revoked: number };
      setCopyTarget(null);
      setCopySource(null);
      toast.success(`Permissões copiadas (${r.granted} concedidas, ${r.revoked} removidas).`);
    },
    onError: (err: Error) => toast.error(err.message ?? "Falha ao copiar permissões"),
  });

  // Prévia da cópia (client-side) usando o catálogo e a matriz já carregados.
  const copyPreview = useMemo(() => {
    if (!copyTarget || !copySource) return null;
    const matrix = matrixQ.data ?? {};
    const catalog = bundleQ.data?.permissions ?? [];
    const allowed =
      copyScope === "module"
        ? new Set(catalog.filter((p) => p.module === activeModule).map((p) => p.key))
        : null;
    const inScope = (k: string) => (allowed ? allowed.has(k) : true);
    const source = new Set((matrix[copySource.id] ?? []).filter(inScope));
    const target = new Set((matrix[copyTarget.id] ?? []).filter(inScope));
    let granted = 0;
    for (const k of source) if (!target.has(k)) granted += 1;
    let revoked = 0;
    for (const k of target) if (!source.has(k)) revoked += 1;
    return { granted, revoked };
  }, [copyTarget, copySource, copyScope, activeModule, matrixQ.data, bundleQ.data]);

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

  // Uma linha por (módulo, recurso, funcionalidade); o escopo virou combo.
  const scopeRows = useMemo<ScopeMatrixRow[]>(
    () => buildScopeMatrixRows(filteredPerms),
    [filteredPerms],
  );

  const roles = useMemo(() => bundleQ.data?.job_roles ?? [], [bundleQ.data]);

  // Se o módulo selecionado não existir no catálogo carregado, cai no primeiro
  // módulo disponível — evita a matriz aparecer vazia sem motivo.
  useEffect(() => {
    if (modulesWithData.length === 0) return;
    if (!modulesWithData.includes(activeModule)) setActiveModule(modulesWithData[0]);
  }, [modulesWithData, activeModule]);

  if (bundleQ.isLoading || matrixQ.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  const loadError = (bundleQ.error ?? matrixQ.error) as Error | null;
  if (loadError) {
    return (
      <div
        role="alert"
        className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive space-y-3"
      >
        <p>Falha ao carregar permissões: {loadError.message}</p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void bundleQ.refetch();
            void matrixQ.refetch();
          }}
        >
          Tentar novamente
        </Button>
      </div>
    );
  }

  const matrix = matrixQ.data ?? {};
  const grantedByRole = (roleId: string) => new Set(matrix[roleId] ?? []);
  const applyScope = (roleId: string, row: ScopeMatrixRow, next: string) => {
    const scope = next === NONE_VALUE ? null : (next as ScopeValue);
    const { grant, revoke } = keysForSelection(row, scope);
    const current = grantedByRole(roleId);
    const toRevoke = revoke.filter((k) => current.has(k));
    const toGrant = grant.filter((k) => !current.has(k));
    if (!toRevoke.length && !toGrant.length) return;
    scopeMut.mutate({ role_id: roleId, grant: toGrant, revoke: toRevoke });
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={activeModule} onValueChange={setActiveModule} className="min-w-0">
          <TabsList className="flex-wrap h-auto">
            {modulesWithData.map((m) => (
              <TabsTrigger key={m} value={m}>
                {MODULE_META[m]?.label ?? m}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button size="sm" onClick={() => setCreateOpen(true)} className="shrink-0">
          <Plus className="h-4 w-4 mr-1" />
          Novo cargo
        </Button>
      </div>

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
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead className="bg-muted/40">
            <tr>
              <th className="sticky left-0 top-0 z-40 bg-muted text-left p-2 min-w-[110px] font-medium border-r border-b">
                Módulo
              </th>
              <th className="sticky left-[110px] top-0 z-30 bg-muted text-left p-2 min-w-[160px] font-medium border-r border-b">
                Recurso
              </th>
              <th className="sticky left-[270px] top-0 z-20 bg-muted text-left p-2 min-w-[150px] font-medium border-r border-b">
                Funcionalidade
              </th>
              {roles.map((r) => (
                <th
                  key={r.id}
                  className="sticky top-0 z-30 bg-muted p-2 text-center font-medium whitespace-nowrap border-b min-w-[190px]"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>{r.name}</span>
                    {r.is_system ? (
                      <Lock
                        className="h-3 w-3 text-muted-foreground"
                        aria-label="Cargo padrão do sistema"
                      />
                    ) : null}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          aria-label={`Ações para ${r.name}`}
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {!r.is_system && roles.length > 1 && (
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger aria-label={`Copiar permissões para ${r.name}`}>
                              <ClipboardCopy className="h-4 w-4 mr-2" />
                              Copiar de...
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                              {roles
                                .filter((src) => src.id !== r.id)
                                .map((src) => (
                                  <DropdownMenuItem
                                    key={src.id}
                                    onClick={() => {
                                      setCopyTarget(r);
                                      setCopySource(src);
                                      setCopyMode("merge");
                                      setCopyScope("module");
                                    }}
                                  >
                                    {src.name}
                                  </DropdownMenuItem>
                                ))}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                        )}
                        <DropdownMenuItem
                          onClick={() => {
                            setDuplicateTarget(r);
                            setDuplicateName(`${r.name} (cópia)`);
                          }}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicar
                        </DropdownMenuItem>
                        {r.is_system && (
                          <DropdownMenuItem
                            disabled={restoreMut.isPending}
                            onClick={() => restoreMut.mutate({ role_id: r.id })}
                          >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Restaurar padrões
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          disabled={r.is_system}
                          onClick={() => {
                            setRenameTarget(r);
                            setRenameValue(r.name);
                          }}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Renomear
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={r.is_system}
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteTarget(r)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scopeRows.map((row) => (
              <tr key={row.id} className="hover:bg-muted/20">
                <td className="sticky left-0 z-10 bg-background p-3 border-b border-r align-middle">
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-normal ${MODULE_META[row.module]?.tone ?? ""}`}
                  >
                    {MODULE_META[row.module]?.label ?? row.module}
                  </Badge>
                </td>
                <td className="sticky left-[110px] z-10 bg-background p-3 border-b border-r align-middle">
                  <span
                    className="whitespace-normal break-words leading-snug"
                    title={`${row.module}.${row.resource}`}
                  >
                    {row.resourceLabel}
                  </span>
                </td>
                <td className="sticky left-[270px] z-10 bg-background p-3 border-b border-r align-middle">
                  <span
                    className="inline-flex items-center gap-1 whitespace-normal break-words leading-snug"
                    title={row.description}
                  >
                    {row.actionLabel}
                    {row.action === "manage" && (
                      <AlertTriangle
                        className="h-3.5 w-3.5 shrink-0 text-amber-500"
                        aria-label="Permissão ampla"
                        title="Gerenciar engloba todas as ações neste recurso, inclusive editar e excluir registros de outros usuários. Para limitar ao responsável, use Ver/Criar/Editar/Excluir com escopo Próprio."
                      />
                    )}
                  </span>
                </td>

                {roles.map((r) => {
                  const granted = grantedByRole(r.id);
                  const value = selectValue(row, granted);
                  const locked = row.lockedScope !== null;
                  const disabled = r.is_system || scopeMut.isPending;
                  return (
                    <td key={r.id} className="p-2 border-b align-middle text-center">
                      <Select
                        value={value}
                        disabled={disabled}
                        onValueChange={(next) => applyScope(r.id, row, next)}
                      >
                        <SelectTrigger
                          className="h-8 w-full text-xs"
                          aria-label={`${r.name} — ${row.actionLabel} ${row.resourceLabel}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE_VALUE}>{NONE_LABEL}</SelectItem>
                          {row.options.map((s) => (
                            <SelectItem key={s} value={s}>
                              {SCOPE_SELECT_LABELS[s]}
                              {locked ? " (fixo)" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  );
                })}
              </tr>
            ))}
            {scopeRows.length === 0 && (
              <tr>
                <td colSpan={roles.length + 3} className="p-6 text-center text-muted-foreground">
                  Nenhuma permissão encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {roles.length > 0 && scopeRows.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <span className="text-xs text-muted-foreground self-center mr-2">
            Aplicar em massa (módulo atual):
          </span>
          {roles.map((r) => (
            <div key={r.id} className="flex items-center gap-1">
              <span className="text-xs">{r.name}</span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                disabled={r.is_system || bulkMut.isPending}
                onClick={() =>
                  bulkMut.mutate({
                    role_id: r.id,
                    keys: scopeRows.flatMap((row) =>
                      row.options[0] ? [row.keysByScope[row.options[0]]] : [],
                    ),
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
                disabled={r.is_system || bulkMut.isPending}
                onClick={() =>
                  bulkMut.mutate({
                    role_id: r.id,
                    keys: scopeRows.flatMap((row) => row.allKeys),
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

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo cargo</DialogTitle>
            <DialogDescription>
              Crie um cargo personalizado para atribuir permissões específicas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="role-name">Nome</Label>
              <Input
                id="role-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Ex.: Coordenador Comercial"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="role-desc">Descrição (opcional)</Label>
              <Input
                id="role-desc"
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                placeholder="Como esse cargo é utilizado"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!createName.trim() || createMut.isPending}
              onClick={() =>
                createMut.mutate({
                  name: createName.trim(),
                  description: createDesc.trim() || null,
                })
              }
            >
              Criar cargo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate dialog */}
      <Dialog
        open={!!duplicateTarget}
        onOpenChange={(o) => {
          if (!o) setDuplicateTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicar cargo</DialogTitle>
            <DialogDescription>
              Cria um cargo editável a partir de <strong>{duplicateTarget?.name}</strong>, copiando
              as permissões concedidas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="dup-name">Nome do novo cargo</Label>
            <Input
              id="dup-name"
              value={duplicateName}
              onChange={(e) => setDuplicateName(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateTarget(null)}>
              Cancelar
            </Button>
            <Button
              disabled={!duplicateName.trim() || duplicateMut.isPending}
              onClick={() =>
                duplicateTarget &&
                duplicateMut.mutate({
                  source_role_id: duplicateTarget.id,
                  name: duplicateName.trim(),
                })
              }
            >
              Duplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog
        open={!!renameTarget}
        onOpenChange={(o) => {
          if (!o) setRenameTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear cargo</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="ren-name">Nome</Label>
            <Input
              id="ren-name"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              Cancelar
            </Button>
            <Button
              disabled={!renameValue.trim() || renameMut.isPending}
              onClick={() =>
                renameTarget &&
                renameMut.mutate({ role_id: renameTarget.id, name: renameValue.trim() })
              }
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir cargo</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>? Esta ação remove
              todas as permissões atribuídas a este cargo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMut.isPending}
              onClick={() => deleteTarget && deleteMut.mutate({ role_id: deleteTarget.id })}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Copy permissions dialog */}
      <Dialog
        open={!!copyTarget && !!copySource}
        onOpenChange={(o) => {
          if (!o) {
            setCopyTarget(null);
            setCopySource(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copiar permissões</DialogTitle>
            <DialogDescription>
              Copiar as permissões de <strong>{copySource?.name}</strong> para{" "}
              <strong>{copyTarget?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Modo</Label>
              <RadioGroup
                value={copyMode}
                onValueChange={(v) => setCopyMode(v as "merge" | "replace")}
                className="gap-2"
              >
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="merge" id="copy-mode-merge" className="mt-1" />
                  <Label htmlFor="copy-mode-merge" className="font-normal leading-snug">
                    Somar
                    <span className="block text-xs text-muted-foreground">
                      Mantém as permissões atuais e adiciona as da origem.
                    </span>
                  </Label>
                </div>
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="replace" id="copy-mode-replace" className="mt-1" />
                  <Label htmlFor="copy-mode-replace" className="font-normal leading-snug">
                    Substituir tudo
                    <span className="block text-xs text-muted-foreground">
                      Espelha a origem, removendo o que ela não tem.
                    </span>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label>Abrangência</Label>
              <RadioGroup
                value={copyScope}
                onValueChange={(v) => setCopyScope(v as "module" | "all")}
                className="gap-2"
              >
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="module" id="copy-scope-module" className="mt-1" />
                  <Label htmlFor="copy-scope-module" className="font-normal leading-snug">
                    Apenas o módulo atual
                    <span className="block text-xs text-muted-foreground">
                      {MODULE_META[activeModule]?.label ?? activeModule}
                    </span>
                  </Label>
                </div>
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="all" id="copy-scope-all" className="mt-1" />
                  <Label htmlFor="copy-scope-all" className="font-normal leading-snug">
                    Todos os módulos
                    <span className="block text-xs text-muted-foreground">
                      Copia a matriz completa da origem.
                    </span>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {copyPreview && (
              <p className="text-xs text-muted-foreground" aria-live="polite">
                Prévia: {copyPreview.granted} permissão(ões) serão concedidas
                {copyMode === "replace" ? ` e ${copyPreview.revoked} removida(s)` : ""}.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCopyTarget(null);
                setCopySource(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              disabled={copyMut.isPending}
              onClick={() =>
                copyTarget &&
                copySource &&
                copyMut.mutate({
                  source_role_id: copySource.id,
                  target_role_id: copyTarget.id,
                  mode: copyMode,
                  ...(copyScope === "module" ? { module: activeModule } : {}),
                })
              }
            >
              {copyMut.isPending ? "Copiando..." : "Copiar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
