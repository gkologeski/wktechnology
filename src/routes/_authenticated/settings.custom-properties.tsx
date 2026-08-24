// Página /settings/custom-properties — gerencia definições de campos personalizados.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Can } from "@/lib/access-control/use-permissions";
import { PROPERTIES_MANAGE, PROPERTIES_PERMS } from "@/lib/access-control/admin-permission-keys";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  listCustomProperties,
  upsertCustomProperty,
  deleteCustomProperty,
  CUSTOM_ENTITIES,
  CUSTOM_TYPES,
  CUSTOM_TYPE_LABELS,
  CUSTOM_ENTITY_LABELS,
  type CustomEntity,
  type CustomType,
} from "@/lib/custom-properties.functions";

export const Route = createFileRoute("/_authenticated/settings/custom-properties")({
  component: CustomPropsPage,
});

type Row = Awaited<ReturnType<typeof listCustomProperties>>[number];

function CustomPropsPage() {
  const listFn = useServerFn(listCustomProperties);
  const saveFn = useServerFn(upsertCustomProperty);
  const delFn = useServerFn(deleteCustomProperty);

  const [rows, setRows] = useState<Row[]>([]);
  const [entity, setEntity] = useState<CustomEntity>("leads");
  const [editing, setEditing] = useState<Partial<Row> | null>(null);
  const [open, setOpen] = useState(false);

  const refresh = async () => setRows(await listFn({ data: {} }));
  useEffect(() => {
    refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  const grouped = useMemo(() => {
    const m = new Map<CustomEntity, Row[]>();
    for (const e of CUSTOM_ENTITIES) m.set(e, []);
    for (const r of rows) m.get(r.entity as CustomEntity)?.push(r);
    return m;
  }, [rows]);

  const openNew = () => {
    setEditing({ entity, type: "text", options: [], enabled: true, required: false, position: 0 });
    setOpen(true);
  };
  const openEdit = (r: Row) => {
    setEditing(r);
    setOpen(true);
  };

  const handleSave = async (form: Partial<Row>) => {
    try {
      await saveFn({
        data: {
          id: form.id ?? null,
          entity: (form.entity ?? entity) as CustomEntity,
          key: form.key ?? "",
          label: form.label ?? "",
          type: (form.type ?? "text") as CustomType,
          options: (form.options ?? []) as string[],
          position: form.position ?? 0,
          required: !!form.required,
          enabled: form.enabled ?? true,
          ai_prompt: (form as { ai_prompt?: string | null }).ai_prompt ?? null,
          group_name: (form as { group_name?: string | null }).group_name ?? null,
        },
      });
      toast.success("Salvo");
      setOpen(false);
      setEditing(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const handleDelete = async (r: Row) => {
    if (
      !(await confirmDialog(
        `Remover a propriedade "${r.label}"? Os valores já gravados nos registros não serão excluídos.`,
      ))
    )
      return;
    try {
      await delFn({ data: { id: r.id } });
      await refresh();
      toast.success("Removida");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Propriedades personalizadas</h2>
          <p className="text-sm text-muted-foreground">
            Crie campos próprios para leads, contatos, empresas e negócios. Aparecem na ficha do
            registro.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={entity} onValueChange={(v) => setEntity(v as CustomEntity)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CUSTOM_ENTITIES.map((e) => (
                <SelectItem key={e} value={e}>
                  {CUSTOM_ENTITY_LABELS[e]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Can any={PROPERTIES_PERMS.create}>
            <Button onClick={openNew}>
              <Plus className="h-4 w-4 mr-2" />
              Nova propriedade
            </Button>
          </Can>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{CUSTOM_ENTITY_LABELS[entity]}</CardTitle>
        </CardHeader>
        <CardContent>
          {(grouped.get(entity) ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma propriedade ainda.</p>
          )}
          <div className="text-sm">
            {Object.entries(
              (grouped.get(entity) ?? []).reduce<Record<string, Row[]>>((acc, r) => {
                const g = (r as { group_name?: string | null }).group_name || "Sem grupo";
                (acc[g] ||= []).push(r);
                return acc;
              }, {}),
            ).map(([g, list]) => (
              <div key={g} className="mb-3">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground py-1">
                  {g}
                </div>
                {list.map((r) => (
                  <div
                    key={r.id}
                    className="grid grid-cols-[1fr_160px_120px_100px_auto] gap-2 items-center py-2 border-b last:border-0"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{r.label}</div>
                      <code className="text-xs text-muted-foreground">{r.key}</code>
                    </div>
                    <span className="text-xs">{CUSTOM_TYPE_LABELS[r.type as CustomType]}</span>
                    <div className="flex gap-1">
                      {r.required && <Badge variant="secondary">obrigatório</Badge>}
                      {!r.enabled && <Badge variant="outline">desativado</Badge>}
                    </div>
                    <span className="text-xs text-muted-foreground">pos {r.position}</span>
                    <div className="flex gap-1">
                      <Can any={PROPERTIES_MANAGE}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(r)}
                          aria-label="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </Can>
                      <Can any={PROPERTIES_PERMS.delete}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(r)}
                          aria-label="Remover"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </Can>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <span />
        </DialogTrigger>
        <PropertyDialog editing={editing} onSave={handleSave} onCancel={() => setOpen(false)} />
      </Dialog>
    </div>
  );
}

function PropertyDialog({
  editing,
  onSave,
  onCancel,
}: {
  editing: Partial<Row> | null;
  onSave: (f: Partial<Row>) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Partial<Row>>(editing ?? {});
  useEffect(() => {
    setForm(editing ?? {});
  }, [editing]);
  if (!editing) return null;

  const needOptions = form.type === "select" || form.type === "multiselect";

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{editing.id ? "Editar propriedade" : "Nova propriedade"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label>Entidade</Label>
            <Select
              value={(form.entity as string) ?? "leads"}
              onValueChange={(v) => setForm((f) => ({ ...f, entity: v as CustomEntity }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CUSTOM_ENTITIES.map((e) => (
                  <SelectItem key={e} value={e}>
                    {CUSTOM_ENTITY_LABELS[e]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Tipo</Label>
            <Select
              value={(form.type as string) ?? "text"}
              onValueChange={(v) => setForm((f) => ({ ...f, type: v as CustomType }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CUSTOM_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {CUSTOM_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label>Rótulo</Label>
            <Input
              value={form.label ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label>Chave (sem espaços)</Label>
            <Input
              value={form.key ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
                }))
              }
              placeholder="ex: budget_estimate"
              disabled={!!editing.id}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label>Grupo (opcional)</Label>
          <Input
            list="cp-groups"
            value={(form as { group_name?: string | null }).group_name ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, group_name: e.target.value }))}
            placeholder="Ex.: Comercial, Financeiro, Operacional"
          />
          <p className="text-[11px] text-muted-foreground">
            Propriedades do mesmo grupo aparecem juntas na ficha do registro.
          </p>
        </div>
        {needOptions && (
          <div className="space-y-1">
            <Label>Opções (uma por linha)</Label>
            <Textarea
              value={((form.options as string[] | undefined) ?? []).join("\n")}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  options: e.target.value
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                }))
              }
              rows={5}
            />
          </div>
        )}
        <div className="space-y-1">
          <Label>Prompt de IA (opcional)</Label>
          <Textarea
            rows={3}
            placeholder="Ex.: classifique este lead como Quente, Morno ou Frio com base no histórico."
            value={(form as { ai_prompt?: string | null }).ai_prompt ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, ai_prompt: e.target.value }))}
          />
          <p className="text-[11px] text-muted-foreground">
            Se preenchido, aparece o botão "Calcular com IA" na ficha do registro.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 items-center">
          <div className="space-y-1">
            <Label>Ordem</Label>
            <Input
              type="number"
              value={form.position ?? 0}
              onChange={(e) =>
                setForm((f) => ({ ...f, position: parseInt(e.target.value, 10) || 0 }))
              }
            />
          </div>
          <label className="flex items-center gap-2 pt-5">
            <Switch
              checked={!!form.required}
              onCheckedChange={(v) => setForm((f) => ({ ...f, required: v }))}
            />
            <span className="text-sm">Obrigatório</span>
          </label>
          <label className="flex items-center gap-2 pt-5">
            <Switch
              checked={form.enabled ?? true}
              onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
            />
            <span className="text-sm">Ativo</span>
          </label>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button onClick={() => onSave(form)} disabled={!form.label || !form.key}>
          Salvar
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
