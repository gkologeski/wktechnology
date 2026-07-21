// Gestão de templates de onboarding — listagem + editor JSON simplificado.
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Copy } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  listOnbTemplates,
  upsertOnbTemplate,
  deleteOnbTemplate,
  ONB_PRESETS,
  type OnbEntityType,
  type OnbTemplateRow,
  type OnbStep,
  type OnbTaskTemplate,
} from "@/lib/onboarding/onboarding.functions";

export const Route = createFileRoute("/_authenticated/settings/onboarding-templates")({
  head: () => ({
    meta: [
      { title: "Modelos de onboarding" },
      {
        name: "description",
        content:
          "Configure wizards de criação guiada para leads, contatos e empresas com tarefas automáticas e workflows.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OnbTemplatesPage,
});

const ENTITY_LABEL: Record<OnbEntityType, string> = {
  lead: "Lead",
  company: "Empresa",
  contact: "Contato",
};

type EditorState = {
  id?: string;
  entity_type: OnbEntityType;
  name: string;
  description: string;
  is_default: boolean;
  is_active: boolean;
  segment_field: string;
  segment_value: string;
  workflow_id: string;
  field_config: OnbStep[];
  tasks_template: OnbTaskTemplate[];
};

function newEditorState(entity: OnbEntityType): EditorState {
  const preset = ONB_PRESETS[entity];
  return {
    entity_type: entity,
    name: preset.name,
    description: "",
    is_default: false,
    is_active: true,
    segment_field: "",
    segment_value: "",
    workflow_id: "",
    field_config: preset.steps,
    tasks_template: preset.tasks,
  };
}

function fromRow(r: OnbTemplateRow): EditorState {
  return {
    id: r.id,
    entity_type: r.entity_type,
    name: r.name,
    description: r.description ?? "",
    is_default: r.is_default,
    is_active: r.is_active,
    segment_field: r.segment_field ?? "",
    segment_value: r.segment_value ?? "",
    workflow_id: r.workflow_id ?? "",
    field_config: r.field_config,
    tasks_template: r.tasks_template,
  };
}

function OnbTemplatesPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listOnbTemplates);
  const upsertFn = useServerFn(upsertOnbTemplate);
  const delFn = useServerFn(deleteOnbTemplate);

  const q = useQuery({
    queryKey: ["onb-templates", "all"],
    queryFn: () => listFn({ data: {} }),
  });

  const [editing, setEditing] = useState<EditorState | null>(null);
  const [jsonError, setJsonError] = useState<string>("");

  const upsertMut = useMutation({
    mutationFn: (s: EditorState) =>
      upsertFn({
        data: {
          id: s.id,
          entity_type: s.entity_type,
          name: s.name,
          description: s.description || null,
          is_default: s.is_default,
          is_active: s.is_active,
          segment_field: s.segment_field || null,
          segment_value: s.segment_value || null,
          workflow_id: s.workflow_id || null,
          field_config: s.field_config,
          tasks_template: s.tasks_template,
        },
      }),
    onSuccess: () => {
      toast.success("Modelo salvo");
      qc.invalidateQueries({ queryKey: ["onb-templates"] });
      setEditing(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Modelo removido");
      qc.invalidateQueries({ queryKey: ["onb-templates"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao remover"),
  });

  const rows = q.data?.templates ?? [];

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Modelos de onboarding"
        description="Configure wizards de criação guiada para leads, contatos e empresas. Cada modelo pode disparar tarefas e workflows."
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing(newEditorState("lead"))}>
              <Plus className="mr-1 h-4 w-4" /> Novo · Lead
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(newEditorState("company"))}>
              <Plus className="mr-1 h-4 w-4" /> Novo · Empresa
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(newEditorState("contact"))}>
              <Plus className="mr-1 h-4 w-4" /> Novo · Contato
            </Button>
          </div>
        }
      />

      {q.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhum modelo cadastrado. Crie um clicando em "Novo" acima.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Entidade</TableHead>
                  <TableHead>Segmento</TableHead>
                  <TableHead>Etapas</TableHead>
                  <TableHead>Tarefas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-32 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.name}
                      {r.is_default && (
                        <Badge variant="secondary" className="ml-2">
                          Padrão
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{ENTITY_LABEL[r.entity_type]}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.segment_field && r.segment_value
                        ? `${r.segment_field}=${r.segment_value}`
                        : "—"}
                    </TableCell>
                    <TableCell>{r.field_config.length}</TableCell>
                    <TableCell>{r.tasks_template.length}</TableCell>
                    <TableCell>
                      <Badge variant={r.is_active ? "default" : "outline"}>
                        {r.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            const clone = fromRow(r);
                            clone.id = undefined;
                            clone.name = `${clone.name} (cópia)`;
                            clone.is_default = false;
                            setEditing(clone);
                          }}
                          aria-label="Duplicar"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setEditing(fromRow(r))}
                          aria-label="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`Remover "${r.name}"?`)) delMut.mutate(r.id);
                          }}
                          aria-label="Remover"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing?.id ? "Editar modelo" : "Novo modelo"} de onboarding
            </DialogTitle>
            <DialogDescription>
              Configure etapas, campos, tarefas e disparo de workflow para o wizard de criação guiada.
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ent">Entidade</Label>
                  <Select
                    value={editing.entity_type}
                    onValueChange={(v) =>
                      setEditing({ ...editing, entity_type: v as OnbEntityType })
                    }
                  >
                    <SelectTrigger id="ent">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lead">Lead</SelectItem>
                      <SelectItem value="company">Empresa</SelectItem>
                      <SelectItem value="contact">Contato</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nm">Nome</Label>
                  <Input
                    id="nm"
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="desc">Descrição</Label>
                <Textarea
                  id="desc"
                  rows={2}
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sf">Segmentação — campo</Label>
                  <Input
                    id="sf"
                    placeholder="ex.: source"
                    value={editing.segment_field}
                    onChange={(e) => setEditing({ ...editing, segment_field: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sv">Segmentação — valor</Label>
                  <Input
                    id="sv"
                    placeholder="ex.: inbound"
                    value={editing.segment_value}
                    onChange={(e) => setEditing({ ...editing, segment_value: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wf">Workflow (UUID, opcional)</Label>
                <Input
                  id="wf"
                  placeholder="Disparado ao concluir o onboarding"
                  value={editing.workflow_id}
                  onChange={(e) => setEditing({ ...editing, workflow_id: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    id="def"
                    checked={editing.is_default}
                    onCheckedChange={(v) => setEditing({ ...editing, is_default: v })}
                  />
                  <Label htmlFor="def" className="cursor-pointer">Padrão da entidade</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="act"
                    checked={editing.is_active}
                    onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
                  />
                  <Label htmlFor="act" className="cursor-pointer">Ativo</Label>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Etapas e campos (JSON)</Label>
                <Textarea
                  rows={10}
                  className="font-mono text-xs"
                  defaultValue={JSON.stringify(editing.field_config, null, 2)}
                  onBlur={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      if (!Array.isArray(parsed) || parsed.length === 0) {
                        throw new Error("Deve conter ao menos uma etapa");
                      }
                      setEditing({ ...editing, field_config: parsed });
                      setJsonError("");
                    } catch (err) {
                      setJsonError(err instanceof Error ? err.message : "JSON inválido");
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Ex.: <code>[{"{"} id, title, fields: [{"{"} name, label, type {"}"}] {"}"}]</code>.
                  target_column define a coluna real na entidade.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Tarefas automáticas (JSON)</Label>
                <Textarea
                  rows={6}
                  className="font-mono text-xs"
                  defaultValue={JSON.stringify(editing.tasks_template, null, 2)}
                  onBlur={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      if (!Array.isArray(parsed)) throw new Error("Deve ser um array");
                      setEditing({ ...editing, tasks_template: parsed });
                      setJsonError("");
                    } catch (err) {
                      setJsonError(err instanceof Error ? err.message : "JSON inválido");
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Ex.: <code>[{"{"} title, type: 'call'|'task'|'email'|'meeting'|'note', offset_days {"}"}]</code>
                </p>
              </div>

              {jsonError && <p className="text-xs text-destructive">{jsonError}</p>}
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button
              disabled={!editing || !!jsonError || upsertMut.isPending}
              onClick={() => editing && upsertMut.mutate(editing)}
            >
              {upsertMut.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
