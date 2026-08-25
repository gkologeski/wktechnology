// Dialogs for TechERP Access Control (Phase 2 CRUD).
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AccessBundle } from "@/lib/access-control/access.functions";
import {
  upsertJobRole,
  deleteJobRole,
  upsertPermissionSet,
  deletePermissionSet,
  upsertFieldRule,
  deleteFieldRule,
  setMemberAssignments,
} from "@/lib/access-control/access-mutations.functions";

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["access-bundle"] });
}

// ---------------- Role Editor ----------------
export function RoleEditorDialog({
  open,
  onOpenChange,
  role,
  data,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  role: AccessBundle["job_roles"][number] | null;
  data: AccessBundle;
}) {
  const invalidate = useInvalidate();
  const fn = useServerFn(upsertJobRole);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#94a3b8");
  const [dataScope, setDataScope] = useState<"own" | "team" | "workspace" | "custom">("workspace");
  const [selectedSets, setSelectedSets] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setName(role?.name ?? "");
    setDescription(role?.description ?? "");
    setColor(role?.color ?? "#94a3b8");
    setDataScope((role?.data_scope as "own" | "team" | "workspace" | "custom") ?? "workspace");
    setSelectedSets(new Set(role?.set_ids ?? []));
  }, [open, role]);

  const setsByModule = useMemo(() => {
    const m = new Map<string, AccessBundle["permission_sets"]>();
    for (const s of data.permission_sets) {
      const arr = m.get(s.module) ?? [];
      arr.push(s);
      m.set(s.module, arr);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [data.permission_sets]);

  const mut = useMutation({
    mutationFn: () =>
      fn({
        data: {
          id: role?.id ?? null,
          name: name.trim(),
          description: description.trim() || null,
          color,
          data_scope: dataScope,
          set_ids: Array.from(selectedSets),
        },
      }),
    onSuccess: () => {
      toast.success(role ? "Cargo atualizado" : "Cargo criado");
      invalidate();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const isSystem = role?.is_system ?? false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{role ? "Editar cargo" : "Novo cargo"}</DialogTitle>
          <DialogDescription>
            Um cargo combina pacotes de permissões e pode ser atribuído a vários membros.
          </DialogDescription>
        </DialogHeader>
        {isSystem ? (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            Este é um cargo do sistema e não pode ser editado.
          </div>
        ) : null}
        <div className="space-y-4">
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <div>
              <Label htmlFor="role-name">Nome</Label>
              <Input
                id="role-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSystem}
              />
            </div>
            <div>
              <Label htmlFor="role-color">Cor</Label>
              <Input
                id="role-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                disabled={isSystem}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="role-desc">Descrição</Label>
            <Textarea
              id="role-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              disabled={isSystem}
            />
          </div>
          <div>
            <Label htmlFor="role-scope">Escopo de dados</Label>
            <select
              id="role-scope"
              className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
              value={dataScope}
              onChange={(e) =>
                setDataScope(e.target.value as "own" | "team" | "workspace" | "custom")
              }
              disabled={isSystem}
            >
              <option value="own">Somente meus registros</option>
              <option value="team">Registros do meu time (grupos)</option>
              <option value="workspace">Workspace inteiro</option>
              <option value="custom">Personalizado</option>
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Define quais registros o cargo enxerga. Owner e admins veem tudo por padrão.
            </p>
          </div>
          <div>
            <Label>Pacotes de permissões</Label>
            <ScrollArea className="mt-2 h-64 rounded-md border p-3">
              {setsByModule.map(([mod, sets]) => (
                <div key={mod} className="mb-3">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {mod}
                  </div>
                  <div className="space-y-1.5">
                    {sets.map((s) => (
                      <label
                        key={s.id}
                        className="flex items-start gap-2 rounded p-1.5 hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={selectedSets.has(s.id)}
                          onCheckedChange={(v) => {
                            const next = new Set(selectedSets);
                            if (v) next.add(s.id);
                            else next.delete(s.id);
                            setSelectedSets(next);
                          }}
                          disabled={isSystem}
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium">{s.name}</div>
                          {s.description ? (
                            <div className="text-xs text-muted-foreground">{s.description}</div>
                          ) : null}
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                          {s.permission_keys.length} perms
                        </Badge>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </ScrollArea>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={isSystem || !name.trim() || mut.isPending}>
            {mut.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Permission Set Editor ----------------
export function PermissionSetEditorDialog({
  open,
  onOpenChange,
  set,
  data,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  set: AccessBundle["permission_sets"][number] | null;
  data: AccessBundle;
}) {
  const invalidate = useInvalidate();
  const fn = useServerFn(upsertPermissionSet);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [module, setModule] = useState("techsales");
  const [keys, setKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setName(set?.name ?? "");
    setDescription(set?.description ?? "");
    setModule(set?.module ?? "techsales");
    setKeys(new Set(set?.permission_keys ?? []));
  }, [open, set]);

  const modules = useMemo(() => {
    const s = new Set<string>();
    for (const p of data.permissions) s.add(p.module);
    return Array.from(s).sort();
  }, [data.permissions]);

  const permsForModule = useMemo(
    () => data.permissions.filter((p) => p.module === module),
    [data.permissions, module],
  );

  const byResource = useMemo(() => {
    const m = new Map<string, typeof permsForModule>();
    for (const p of permsForModule) {
      const arr = m.get(p.resource) ?? [];
      arr.push(p);
      m.set(p.resource, arr);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [permsForModule]);

  const mut = useMutation({
    mutationFn: () =>
      fn({
        data: {
          id: set?.id ?? null,
          module,
          name: name.trim(),
          description: description.trim() || null,
          permission_keys: Array.from(keys),
        },
      }),
    onSuccess: () => {
      toast.success(set ? "Pacote atualizado" : "Pacote criado");
      invalidate();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const isSystem = set?.is_system ?? false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{set ? "Editar pacote" : "Novo pacote"}</DialogTitle>
          <DialogDescription>
            Um pacote agrupa permissões de um módulo e pode ser reusado em vários cargos.
          </DialogDescription>
        </DialogHeader>
        {isSystem ? (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            Este é um pacote do sistema e não pode ser editado.
          </div>
        ) : null}
        <div className="space-y-4">
          <div className="grid grid-cols-[160px_1fr] gap-3">
            <div>
              <Label>Módulo</Label>
              <Select value={module} onValueChange={setModule} disabled={isSystem}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {modules.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="set-name">Nome</Label>
              <Input
                id="set-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSystem}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="set-desc">Descrição</Label>
            <Textarea
              id="set-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              disabled={isSystem}
            />
          </div>
          <div>
            <Label>Permissões</Label>
            <ScrollArea className="mt-2 h-64 rounded-md border p-3">
              {byResource.map(([res, perms]) => (
                <div key={res} className="mb-3">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {res}
                  </div>
                  <div className="space-y-1">
                    {perms.map((p) => (
                      <label
                        key={p.key}
                        className="flex items-center gap-2 rounded p-1 hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={keys.has(p.key)}
                          onCheckedChange={(v) => {
                            const next = new Set(keys);
                            if (v) next.add(p.key);
                            else next.delete(p.key);
                            setKeys(next);
                          }}
                          disabled={isSystem}
                        />
                        <div className="flex-1 text-sm">{p.label_pt}</div>
                        <Badge variant="outline" className="text-[10px]">
                          {p.action}·{p.scope}
                        </Badge>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </ScrollArea>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={isSystem || !name.trim() || mut.isPending}>
            {mut.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Field Rule Editor ----------------
export function FieldRuleEditorDialog({
  open,
  onOpenChange,
  rule,
  data,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rule: AccessBundle["field_rules"][number] | null;
  data: AccessBundle;
}) {
  const invalidate = useInvalidate();
  const fn = useServerFn(upsertFieldRule);
  const [resource, setResource] = useState("");
  const [field, setField] = useState("");
  const [mode, setMode] = useState<"hidden" | "masked" | "readonly">("masked");
  const [targetType, setTargetType] = useState<"role" | "set">("role");
  const [targetId, setTargetId] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setResource(rule?.resource ?? "");
    setField(rule?.field ?? "");
    setMode(rule?.mode ?? "masked");
    if (rule?.role_id) {
      setTargetType("role");
      setTargetId(rule.role_id);
    } else if (rule?.set_id) {
      setTargetType("set");
      setTargetId(rule.set_id);
    } else {
      setTargetType("role");
      setTargetId("");
    }
  }, [open, rule]);

  const mut = useMutation({
    mutationFn: () =>
      fn({
        data: {
          id: rule?.id ?? null,
          resource: resource.trim(),
          field: field.trim(),
          mode,
          role_id: targetType === "role" ? targetId : null,
          set_id: targetType === "set" ? targetId : null,
        },
      }),
    onSuccess: () => {
      toast.success(rule ? "Regra atualizada" : "Regra criada");
      invalidate();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const isSystem = rule?.is_system ?? false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{rule ? "Editar regra de campo" : "Nova regra de campo"}</DialogTitle>
          <DialogDescription>
            Restringe a exibição de campos sensíveis (ex.: <code>candidates.salary</code>).
          </DialogDescription>
        </DialogHeader>
        {isSystem ? (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            Regra do sistema, não editável.
          </div>
        ) : null}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Recurso</Label>
              <Input
                placeholder="ex: candidates"
                value={resource}
                onChange={(e) => setResource(e.target.value)}
                disabled={isSystem}
              />
            </div>
            <div>
              <Label>Campo</Label>
              <Input
                placeholder="ex: salary"
                value={field}
                onChange={(e) => setField(e.target.value)}
                disabled={isSystem}
              />
            </div>
          </div>
          <div>
            <Label>Modo</Label>
            <Select
              value={mode}
              onValueChange={(v) => setMode(v as typeof mode)}
              disabled={isSystem}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hidden">Ocultar</SelectItem>
                <SelectItem value="masked">Mascarar</SelectItem>
                <SelectItem value="readonly">Somente leitura</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-[140px_1fr] gap-3">
            <div>
              <Label>Aplicar a</Label>
              <Select
                value={targetType}
                onValueChange={(v) => {
                  setTargetType(v as "role" | "set");
                  setTargetId("");
                }}
                disabled={isSystem}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="role">Cargo</SelectItem>
                  <SelectItem value="set">Pacote</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{targetType === "role" ? "Cargo" : "Pacote"}</Label>
              <Select value={targetId} onValueChange={setTargetId} disabled={isSystem}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  {(targetType === "role" ? data.job_roles : data.permission_sets).map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={isSystem || !resource.trim() || !field.trim() || !targetId || mut.isPending}
          >
            {mut.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Member Assignment ----------------
export function MemberAssignmentDialog({
  open,
  onOpenChange,
  member,
  data,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  member: AccessBundle["members"][number] | null;
  data: AccessBundle;
}) {
  const invalidate = useInvalidate();
  const fn = useServerFn(setMemberAssignments);
  const [primary, setPrimary] = useState<string>("");
  const [extraRoles, setExtraRoles] = useState<Set<string>>(new Set());
  const [extraSets, setExtraSets] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open || !member) return;
    setPrimary(member.primary_role_id ?? "");
    setExtraRoles(new Set(member.role_ids.filter((id) => id !== member.primary_role_id)));
    setExtraSets(new Set(member.extra_set_ids));
  }, [open, member]);

  const mut = useMutation({
    mutationFn: () =>
      fn({
        data: {
          user_id: member!.user_id,
          primary_role_id: primary || null,
          extra_role_ids: Array.from(extraRoles),
          extra_set_ids: Array.from(extraSets),
        },
      }),
    onSuccess: () => {
      toast.success("Atribuições atualizadas");
      invalidate();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  if (!member) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Atribuições · {member.full_name || member.email}</DialogTitle>
          <DialogDescription>
            Defina o cargo principal, cargos adicionais e pacotes extras.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Cargo principal</Label>
            <Select
              value={primary || "__none"}
              onValueChange={(v) => setPrimary(v === "__none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">— Sem cargo —</SelectItem>
                {data.job_roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Cargos adicionais</Label>
            <ScrollArea className="mt-2 h-40 rounded-md border p-2">
              {data.job_roles
                .filter((r) => r.id !== primary)
                .map((r) => (
                  <label
                    key={r.id}
                    className="flex items-center gap-2 rounded p-1 hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={extraRoles.has(r.id)}
                      onCheckedChange={(v) => {
                        const next = new Set(extraRoles);
                        if (v) next.add(r.id);
                        else next.delete(r.id);
                        setExtraRoles(next);
                      }}
                    />
                    <span className="text-sm">{r.name}</span>
                  </label>
                ))}
            </ScrollArea>
          </div>
          <div>
            <Label>Pacotes extras (avulsos)</Label>
            <ScrollArea className="mt-2 h-40 rounded-md border p-2">
              {data.permission_sets.map((s) => (
                <label key={s.id} className="flex items-center gap-2 rounded p-1 hover:bg-muted/50">
                  <Checkbox
                    checked={extraSets.has(s.id)}
                    onCheckedChange={(v) => {
                      const next = new Set(extraSets);
                      if (v) next.add(s.id);
                      else next.delete(s.id);
                      setExtraSets(next);
                    }}
                  />
                  <span className="text-sm">
                    <Badge variant="outline" className="mr-2 text-[10px]">
                      {s.module}
                    </Badge>
                    {s.name}
                  </span>
                </label>
              ))}
            </ScrollArea>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Delete Confirm ----------------
export function DeleteAccessRowDialog({
  open,
  onOpenChange,
  kind,
  id,
  label,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: "role" | "set" | "field_rule";
  id: string | null;
  label: string;
}) {
  const invalidate = useInvalidate();
  const roleFn = useServerFn(deleteJobRole);
  const setFn = useServerFn(deletePermissionSet);
  const ruleFn = useServerFn(deleteFieldRule);
  const mut = useMutation({
    mutationFn: async () => {
      if (!id) return;
      if (kind === "role") await roleFn({ data: { id } });
      else if (kind === "set") await setFn({ data: { id } });
      else await ruleFn({ data: { id } });
    },
    onSuccess: () => {
      toast.success("Excluído");
      invalidate();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir {label}?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação é permanente. Atribuições vinculadas serão removidas.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? "Excluindo..." : "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
