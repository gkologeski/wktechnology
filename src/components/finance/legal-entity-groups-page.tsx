import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Users, Building2, Lock } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  listLegalEntityGroups,
  upsertLegalEntityGroup,
  deleteLegalEntityGroup,
  setLegalEntityGroupMembers,
} from "@/lib/legal-entity-groups.functions";
import { listLegalEntities } from "@/lib/legal-entities.functions";

type Group = {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  color: string | null;
  is_system: boolean;
  active: boolean;
  member_ids: string[];
};

type LE = { id: string; code: string | null; name: string; cnpj: string | null; active: boolean };

export function LegalEntityGroupsPage() {
  const qc = useQueryClient();
  const listGroups = useServerFn(listLegalEntityGroups);
  const listEntities = useServerFn(listLegalEntities);
  const upsert = useServerFn(upsertLegalEntityGroup);
  const del = useServerFn(deleteLegalEntityGroup);
  const setMembers = useServerFn(setLegalEntityGroupMembers);

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["legal-entity-groups"],
    queryFn: () => listGroups() as Promise<Group[]>,
  });
  const { data: entities = [] } = useQuery({
    queryKey: ["legal-entities", "list"],
    queryFn: () => listEntities() as Promise<LE[]>,
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{
    id?: string;
    code: string;
    name: string;
    description: string;
    active: boolean;
    member_ids: string[];
  }>({ code: "", name: "", description: "", active: true, member_ids: [] });

  const entitiesById = useMemo(() => {
    const m = new Map<string, LE>();
    entities.forEach((e) => m.set(e.id, e));
    return m;
  }, [entities]);

  function openCreate() {
    setForm({ code: "", name: "", description: "", active: true, member_ids: [] });
    setOpen(true);
  }
  function openEdit(g: Group) {
    setForm({
      id: g.id,
      code: g.code ?? "",
      name: g.name,
      description: g.description ?? "",
      active: g.active,
      member_ids: g.member_ids,
    });
    setOpen(true);
  }

  async function submit() {
    if (!form.name.trim()) return toast.error("Informe o nome do grupo");
    try {
      const res = await upsert({
        data: {
          id: form.id,
          code: form.code.trim() || null,
          name: form.name.trim(),
          description: form.description.trim() || null,
          active: form.active,
        },
      });
      const id = form.id ?? (res as { id: string }).id;
      await setMembers({ data: { group_id: id, legal_entity_ids: form.member_ids } });
      toast.success(form.id ? "Grupo atualizado" : "Grupo criado");
      qc.invalidateQueries({ queryKey: ["legal-entity-groups"] });
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
    }
  }

  async function remove(g: Group) {
    if (!confirm(`Excluir grupo "${g.name}"?`)) return;
    try {
      await del({ data: { id: g.id } });
      toast.success("Grupo excluído");
      qc.invalidateQueries({ queryKey: ["legal-entity-groups"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  }

  function toggleMember(id: string) {
    setForm((f) => ({
      ...f,
      member_ids: f.member_ids.includes(id)
        ? f.member_ids.filter((x) => x !== id)
        : [...f.member_ids, id],
    }));
  }

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Grupos empresariais"
        description="Agrupe múltiplos CNPJs em grupos para consolidar relatórios e filtros. Um CNPJ pode pertencer a vários grupos."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Novo grupo
          </Button>
        }
      />

      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Grupo</th>
              <th className="text-left px-4 py-2 font-medium">CNPJs</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
              <th className="text-right px-4 py-2 font-medium w-32">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  Carregando…
                </td>
              </tr>
            )}
            {!isLoading && groups.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhum grupo cadastrado.
                </td>
              </tr>
            )}
            {groups.map((g) => (
              <tr key={g.id} className="border-t align-top">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {g.is_system ? (
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span className="font-medium">{g.name}</span>
                    {g.code && (
                      <span className="font-mono text-xs text-muted-foreground">
                        {g.code}
                      </span>
                    )}
                    {g.is_system && (
                      <Badge variant="outline" className="text-xs">
                        Automático
                      </Badge>
                    )}
                  </div>
                  {g.description && (
                    <div className="mt-1 text-xs text-muted-foreground">{g.description}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1 max-w-xl">
                    {g.member_ids.length === 0 && (
                      <span className="text-xs text-muted-foreground">Nenhum CNPJ</span>
                    )}
                    {g.member_ids.map((id) => {
                      const e = entitiesById.get(id);
                      if (!e) return null;
                      return (
                        <Badge key={id} variant="secondary" className="gap-1">
                          <Building2 className="h-3 w-3" />
                          {e.code ? `${e.code} · ${e.name}` : e.name}
                        </Badge>
                      );
                    })}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {g.active ? (
                    <Badge variant="outline" className="border-emerald-500 text-emerald-600">
                      Ativo
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Inativo</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    {!g.is_system && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(g)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(g)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar grupo" : "Novo grupo empresarial"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Código</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="Ex: HOLDING"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Nome *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Holding BR"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
              <Label>Ativo</Label>
            </div>

            <div className="space-y-2">
              <Label>CNPJs do grupo ({form.member_ids.length})</Label>
              <ScrollArea className="h-64 rounded-md border p-2">
                <div className="space-y-1">
                  {entities.length === 0 && (
                    <div className="text-sm text-muted-foreground p-2">
                      Nenhum CNPJ cadastrado. Cadastre em Empresas (CNPJs).
                    </div>
                  )}
                  {entities.map((e) => {
                    const checked = form.member_ids.includes(e.id);
                    return (
                      <label
                        key={e.id}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 cursor-pointer"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleMember(e.id)}
                        />
                        <span className="text-sm">
                          {e.code && (
                            <span className="font-mono text-xs text-muted-foreground mr-1">
                              {e.code}
                            </span>
                          )}
                          {e.name}
                        </span>
                        {e.cnpj && (
                          <span className="text-xs text-muted-foreground ml-auto font-mono">
                            {e.cnpj}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submit}>{form.id ? "Salvar" : "Criar grupo"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
