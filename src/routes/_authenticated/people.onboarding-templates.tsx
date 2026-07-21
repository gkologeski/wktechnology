// TechPeople · Sprint 6 — Templates de Onboarding/Offboarding
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Plus, Pencil, Trash2, ClipboardList, GripVertical } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  listOnbTemplates,
  upsertOnbTemplate,
  deleteOnbTemplate,
  ONB_KINDS,
  ONB_KIND_LABELS,
  type OnbKind,
  type OnbTemplateItem,
  type OnbTemplateRow,
} from "@/lib/people/onboarding.functions";

export const Route = createFileRoute("/_authenticated/people/onboarding-templates")({
  head: () => ({
    meta: [
      { title: "Modelos de Onboarding · TechPeople" },
      {
        name: "description",
        content: "Modelos reutilizáveis de checklist para admissão e desligamento.",
      },
    ],
  }),
  component: OnbTemplatesPage,
});

function OnbTemplatesPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listOnbTemplates);
  const delFn = useServerFn(deleteOnbTemplate);

  const [filter, setFilter] = useState<OnbKind | "all">("all");
  const [editing, setEditing] = useState<OnbTemplateRow | "new" | null>(null);

  const { data: templates = [] } = useQuery({
    queryKey: ["onb-templates-all"],
    queryFn: () => listFn({ data: {} }),
    staleTime: 15_000,
  });

  const filtered = useMemo(
    () => (filter === "all" ? templates : templates.filter((t) => t.kind === filter)),
    [templates, filter],
  );

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onb-templates-all"] });
      qc.invalidateQueries({ queryKey: ["onb-templates"] });
      toast.success("Modelo removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="container max-w-5xl mx-auto p-6 space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3">
        <Link to="/people">
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Link>
      </Button>

      <PageHeader
        title="Modelos de Onboarding & Offboarding"
        description="Checklists reutilizáveis aplicáveis a qualquer pessoa."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4 mr-2" /> Novo modelo
          </Button>
        }
      />

      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">Filtrar:</Label>
        <Select value={filter} onValueChange={(v) => setFilter(v as OnbKind | "all")}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {ONB_KINDS.map((k) => (
              <SelectItem key={k} value={k}>
                {ONB_KIND_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-60" />
            Nenhum modelo encontrado.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((tpl) => (
            <Card key={tpl.id}>
              <CardHeader className="p-4 flex flex-row items-start justify-between gap-3">
                <div className="flex-1">
                  <CardTitle className="text-base flex items-center gap-2">
                    {tpl.name}
                    <Badge variant="outline">{ONB_KIND_LABELS[tpl.kind]}</Badge>
                    {!tpl.is_active ? (
                      <Badge variant="secondary">Inativo</Badge>
                    ) : null}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {tpl.items.length} tarefas
                    {tpl.role_title ? ` · ${tpl.role_title}` : ""}
                    {tpl.employment_type ? ` · ${tpl.employment_type}` : ""}
                    {tpl.description ? ` · ${tpl.description}` : ""}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setEditing(tpl)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground"
                    onClick={() => {
                      if (confirm(`Excluir modelo "${tpl.name}"?`)) {
                        delMut.mutate(tpl.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {editing ? (
        <TemplateDialog
          template={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["onb-templates-all"] });
            qc.invalidateQueries({ queryKey: ["onb-templates"] });
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

function TemplateDialog({
  template,
  onClose,
  onSaved,
}: {
  template: OnbTemplateRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const upsertFn = useServerFn(upsertOnbTemplate);

  const [name, setName] = useState(template?.name ?? "");
  const [kind, setKind] = useState<OnbKind>(template?.kind ?? "onboarding");
  const [roleTitle, setRoleTitle] = useState(template?.role_title ?? "");
  const [employmentType, setEmploymentType] = useState(template?.employment_type ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [isActive, setIsActive] = useState(template?.is_active ?? true);
  const [items, setItems] = useState<OnbTemplateItem[]>(
    template?.items ?? [
      { title: "Enviar documentação", category: "RH", due_offset_days: 3 },
      { title: "Criar acessos (e-mail, ferramentas)", category: "TI", due_offset_days: 1 },
    ],
  );

  const mut = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          id: template?.id ?? null,
          name,
          kind,
          role_title: roleTitle || null,
          employment_type: employmentType || null,
          description: description || null,
          is_active: isActive,
          items,
        },
      }),
    onSuccess: () => {
      toast.success(template ? "Modelo atualizado" : "Modelo criado");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addItem = () =>
    setItems((prev) => [
      ...prev,
      { title: "", category: null, description: null, due_offset_days: null },
    ]);

  const updateItem = (idx: number, patch: Partial<OnbTemplateItem>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const removeItem = (idx: number) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));

  const moveItem = (idx: number, delta: number) => {
    const next = idx + delta;
    if (next < 0 || next >= items.length) return;
    setItems((prev) => {
      const copy = [...prev];
      const [it] = copy.splice(idx, 1);
      copy.splice(next, 0, it);
      return copy;
    });
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? "Editar modelo" : "Novo modelo"}</DialogTitle>
          <DialogDescription>
            Defina as tarefas padrão que serão aplicadas ao criar um plano.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as OnbKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ONB_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {ONB_KIND_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cargo (opcional)</Label>
              <Input
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                placeholder="Ex.: Desenvolvedor"
              />
            </div>
            <div className="space-y-2">
              <Label>Vínculo (opcional)</Label>
              <Input
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value)}
                placeholder="PJ, CLT…"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} id="is-active" />
            <Label htmlFor="is-active" className="text-sm">
              Modelo ativo
            </Label>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Tarefas ({items.length})</Label>
              <Button size="sm" variant="outline" onClick={addItem}>
                <Plus className="h-4 w-4 mr-2" /> Adicionar tarefa
              </Button>
            </div>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[auto_1fr_120px_100px_auto] gap-2 items-start p-2 rounded border bg-muted/30"
                >
                  <div className="flex flex-col gap-1 pt-1">
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => moveItem(idx, -1)}
                    >
                      <GripVertical className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="space-y-1">
                    <Input
                      placeholder="Título da tarefa"
                      value={it.title}
                      onChange={(e) => updateItem(idx, { title: e.target.value })}
                    />
                    <Input
                      placeholder="Descrição (opcional)"
                      value={it.description ?? ""}
                      onChange={(e) => updateItem(idx, { description: e.target.value || null })}
                      className="text-xs"
                    />
                  </div>
                  <Input
                    placeholder="Categoria"
                    value={it.category ?? ""}
                    onChange={(e) => updateItem(idx, { category: e.target.value || null })}
                  />
                  <Input
                    type="number"
                    placeholder="Dias"
                    value={it.due_offset_days ?? ""}
                    onChange={(e) =>
                      updateItem(idx, {
                        due_offset_days: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    title="Prazo (dias após início do plano)"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(idx)}
                    className="text-muted-foreground"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {items.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-4">
                  Nenhuma tarefa. Adicione a primeira acima.
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={mut.isPending || !name.trim() || items.some((i) => !i.title.trim())}
            onClick={() => mut.mutate()}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
