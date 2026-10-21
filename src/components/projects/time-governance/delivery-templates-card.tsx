// Modelos de entrega por serviço do catálogo (versionados). Editar cria nova versão; projetos
// que já aplicaram uma versão anterior continuam com ela.
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";

import { SectionHeader, EmptyState, RowSkeleton } from "@/components/techhire/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  listDeliveryTemplates,
  saveDeliveryTemplate,
} from "@/lib/projects/time-governance.functions";
import {
  describeTemplate,
  parseTemplateText,
  TEMPLATE_KIND_LABEL,
  templateToText,
  type TemplateDefinition,
} from "@/lib/projects/delivery-template.shared";

type Kind = "capacity" | "scope" | "hunting" | "package" | "deliverables";
type Form = {
  id: string | null;
  name: string;
  kind: Kind;
  description: string;
  active: boolean;
  serviceIds: string[];
  milestones: string;
  tasks: string;
  clientAcceptance: boolean;
};
const EMPTY: Form = {
  id: null,
  name: "",
  kind: "scope",
  description: "",
  active: true,
  serviceIds: [],
  milestones: "",
  tasks: "",
  clientAcceptance: false,
};

export function DeliveryTemplatesCard() {
  const qc = useQueryClient();
  const listFn = useServerFn(listDeliveryTemplates);
  const saveFn = useServerFn(saveDeliveryTemplate);
  const q = useQuery({ queryKey: ["delivery-templates"], queryFn: () => listFn() });
  const [form, setForm] = useState<Form | null>(null);

  const latest = useMemo(() => {
    const m = new Map<string, { version: number; definition: TemplateDefinition }>();
    for (const v of q.data?.versions ?? []) {
      if (!m.has(v.template_id))
        m.set(v.template_id, {
          version: v.version,
          definition: v.definition as TemplateDefinition,
        });
    }
    return m;
  }, [q.data]);
  const servicesOf = (tid: string) =>
    (q.data?.services ?? []).filter((s) => s.template_id === tid).map((s) => s.service_catalog_id);
  const svcName = (id: string) => q.data?.catalog.find((c) => c.id === id)?.name ?? "Serviço";
  const takenBy = (sid: string) =>
    (q.data?.services ?? []).find((s) => s.service_catalog_id === sid)?.template_id;

  const save = useMutation({
    mutationFn: (f: Form) =>
      saveFn({
        data: {
          id: f.id,
          name: f.name,
          kind: f.kind,
          description: f.description || null,
          active: f.active,
          serviceIds: f.serviceIds,
          definition: parseTemplateText(f.milestones, f.tasks, f.clientAcceptance) as Record<
            string,
            unknown
          >,
        },
      }),
    onSuccess: (r) => {
      toast.success(`Modelo salvo (versão ${r.version})`);
      setForm(null);
      void qc.invalidateQueries({ queryKey: ["delivery-templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const edit = (t: {
    id: string;
    name: string;
    delivery_kind: string;
    description: string | null;
    active: boolean;
  }) => {
    const txt = templateToText(latest.get(t.id)?.definition);
    setForm({
      id: t.id,
      name: t.name,
      kind: t.delivery_kind as Kind,
      description: t.description ?? "",
      active: t.active,
      serviceIds: servicesOf(t.id),
      milestones: txt.milestones,
      tasks: txt.tasks,
      clientAcceptance: txt.clientAcceptance,
    });
  };

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <SectionHeader
        title="Modelos de entrega por serviço"
        description="Sugeridos ao abrir as horas de um projeto do serviço. Aplicação só por ação explícita; projetos e horas importados não são reclassificados."
        actions={
          <Button size="sm" variant="outline" onClick={() => setForm(EMPTY)}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Novo modelo
          </Button>
        }
      />
      {q.isLoading ? (
        <RowSkeleton />
      ) : q.isError ? (
        <EmptyState title="Não foi possível carregar" description={(q.error as Error).message} />
      ) : (q.data?.templates ?? []).length === 0 && !form ? (
        <EmptyState
          title="Nenhum modelo cadastrado"
          description="Crie um modelo e ligue-o aos serviços do catálogo."
        />
      ) : (
        <ul className="divide-y rounded-md border">
          {(q.data?.templates ?? []).map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {t.name}{" "}
                  <Badge variant="secondary">
                    {TEMPLATE_KIND_LABEL[t.delivery_kind] ?? t.delivery_kind}
                  </Badge>{" "}
                  {!t.active && <Badge variant="outline">Inativo</Badge>}
                </p>
                <p className="text-xs text-muted-foreground">
                  v{latest.get(t.id)?.version ?? 0} ·{" "}
                  {describeTemplate(latest.get(t.id)?.definition)} · serviços:{" "}
                  {servicesOf(t.id).map(svcName).join(", ") || "nenhum"}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => edit(t)}>
                Editar
              </Button>
            </li>
          ))}
        </ul>
      )}

      {form && (
        <div className="grid gap-3 rounded-md border p-3 md:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="tpl-name">Nome</Label>
            <Input
              id="tpl-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tpl-kind">Tipo de entrega</Label>
            <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as Kind })}>
              <SelectTrigger id="tpl-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TEMPLATE_KIND_LABEL).map(([k, l]) => (
                  <SelectItem key={k} value={k}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5 md:col-span-2">
            <Label htmlFor="tpl-desc">Descrição</Label>
            <Input
              id="tpl-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <fieldset className="grid gap-1.5 md:col-span-2">
            <legend className="text-sm font-medium">
              Serviços do catálogo (um modelo por serviço)
            </legend>
            <div className="grid gap-1 sm:grid-cols-2">
              {(q.data?.catalog ?? [])
                .filter((c) => c.active)
                .map((c) => {
                  const owner = takenBy(c.id);
                  const busy = !!owner && owner !== form.id;
                  return (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={form.serviceIds.includes(c.id)}
                        disabled={busy}
                        onCheckedChange={(v) =>
                          setForm({
                            ...form,
                            serviceIds: v
                              ? [...form.serviceIds, c.id]
                              : form.serviceIds.filter((x) => x !== c.id),
                          })
                        }
                      />
                      {c.name}
                      {busy && (
                        <span className="text-xs text-muted-foreground">(em outro modelo)</span>
                      )}
                    </label>
                  );
                })}
            </div>
          </fieldset>
          <div className="grid gap-1.5">
            <Label htmlFor="tpl-ms">Marcos (um por linha; "Nome | dias" para prazo)</Label>
            <Textarea
              id="tpl-ms"
              rows={6}
              value={form.milestones}
              onChange={(e) => setForm({ ...form, milestones: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tpl-tk">Tarefas (um por linha; "Marco &gt; Tarefa | horas")</Label>
            <Textarea
              id="tpl-tk"
              rows={6}
              value={form.tasks}
              onChange={(e) => setForm({ ...form, tasks: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="tpl-acc"
              checked={form.clientAcceptance}
              onCheckedChange={(v) => setForm({ ...form, clientAcceptance: v })}
            />
            <Label htmlFor="tpl-acc">Ligar aceite do cliente ao aplicar</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="tpl-active"
              checked={form.active}
              onCheckedChange={(v) => setForm({ ...form, active: v })}
            />
            <Label htmlFor="tpl-active">Ativo</Label>
          </div>
          <div className="flex gap-2 md:col-span-2">
            <Button
              disabled={form.name.trim().length < 2 || save.isPending}
              onClick={() => save.mutate(form)}
            >
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
            <Button variant="ghost" onClick={() => setForm(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
