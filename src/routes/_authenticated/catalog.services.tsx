// /catalog/services — Catálogo global de Serviços (Core ERP).
// Consome public.service_catalog. Compartilhado por Sales, Contracts,
// Services (operacional), Projects e Finance. CRUD com filtro por
// categoria e tipo. Preserva as convenções de UX/UI do TechHire/TechSales.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Pencil, Wrench } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/catalog/services")({
  component: ServiceCatalogPage,
});

type ServiceCatalog = {
  id: string;
  owner_id: string;
  workspace_id: string;
  name: string;
  code: string | null;
  description: string | null;
  category: string | null;
  service_type: string;
  unit: string;
  base_price: number;
  cost: number;
  currency: string;
  tax_rate: number;
  default_sla_hours: number | null;
  competencies: string[];
  tags: string[];
  active: boolean;
};

type Draft = Partial<ServiceCatalog>;

const SERVICE_TYPES: Array<{ value: string; label: string }> = [
  { value: "one_off", label: "Avulso" },
  { value: "recurring", label: "Recorrente" },
  { value: "hour_bank", label: "Bolsa de horas" },
  { value: "sla", label: "SLA / Suporte" },
  { value: "project", label: "Projeto" },
  { value: "subscription", label: "Assinatura" },
];
const UNITS: Array<{ value: string; label: string }> = [
  { value: "hour", label: "Hora" },
  { value: "month", label: "Mês" },
  { value: "pf", label: "Ponto de função" },
  { value: "unit", label: "Unidade" },
  { value: "day", label: "Dia" },
  { value: "user", label: "Usuário" },
  { value: "GB", label: "GB" },
  { value: "fixed", label: "Fixo" },
];

function typeLabel(v: string) {
  return SERVICE_TYPES.find((t) => t.value === v)?.label ?? v;
}
function unitLabel(v: string) {
  return UNITS.find((u) => u.value === v)?.label ?? v;
}

function ServiceCatalogPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceCatalog | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["service_catalog"],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as {
        from: (t: string) => {
          select: (s: string) => { order: (c: string) => Promise<{ data: unknown; error: unknown }> };
        };
      })
        .from("service_catalog")
        .select("*")
        .order("name");
      if (error) throw error as Error;
      return (data ?? []) as ServiceCatalog[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((s) => {
      if (typeFilter !== "all" && s.service_type !== typeFilter) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        (s.code ?? "").toLowerCase().includes(q) ||
        (s.category ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, search, typeFilter]);

  function openNew() {
    setEditing(null);
    setDraft({
      active: true,
      currency: "BRL",
      base_price: 0,
      cost: 0,
      tax_rate: 0,
      service_type: "one_off",
      unit: "hour",
      competencies: [],
      tags: [],
    });
    setOpen(true);
  }
  function openEdit(s: ServiceCatalog) {
    setEditing(s);
    setDraft({ ...s });
    setOpen(true);
  }
  async function save() {
    if (!user) return;
    if (!draft.name?.trim()) {
      toast.error("Informe o nome do serviço.");
      return;
    }
    const payload = {
      name: draft.name!.trim(),
      code: draft.code?.toString().trim() || null,
      description: draft.description?.toString() || null,
      category: draft.category?.toString().trim() || null,
      service_type: draft.service_type || "one_off",
      unit: draft.unit || "hour",
      base_price: Number(draft.base_price ?? 0),
      cost: Number(draft.cost ?? 0),
      currency: (draft.currency || "BRL").toUpperCase(),
      tax_rate: Number(draft.tax_rate ?? 0),
      default_sla_hours:
        draft.default_sla_hours != null && draft.default_sla_hours !== undefined
          ? Number(draft.default_sla_hours)
          : null,
      competencies: draft.competencies ?? [],
      tags: draft.tags ?? [],
      active: draft.active ?? true,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { error } = editing
      ? await sb.from("service_catalog").update(payload).eq("id", editing.id)
      : await sb.from("service_catalog").insert({
          ...payload,
          owner_id: user.id,
          // workspace_id preenchido pelo DEFAULT (mesmo workspace default de products)
          created_by: user.id,
        });
    if (error) {
      toast.error((error as Error).message);
      return;
    }
    toast.success(editing ? "Serviço atualizado." : "Serviço criado.");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["service_catalog"] });
    qc.invalidateQueries({ queryKey: ["catalog_items"] });
  }
  async function remove(id: string) {
    if (!confirm("Excluir este serviço do catálogo?")) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("service_catalog").delete().eq("id", id);
    if (error) {
      toast.error((error as Error).message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["service_catalog"] });
    qc.invalidateQueries({ queryKey: ["catalog_items"] });
  }
  async function toggle(s: ServiceCatalog, active: boolean) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("service_catalog")
      .update({ active })
      .eq("id", s.id);
    if (error) {
      toast.error((error as Error).message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["service_catalog"] });
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Wrench className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">Catálogo de Serviços</h1>
          <p className="text-sm text-muted-foreground">
            Serviços de TI reutilizáveis por Vendas, Contratos, Projetos e Financeiro.
          </p>
        </div>
        <Button onClick={openNew} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Novo serviço
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Serviços cadastrados</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Input
              placeholder="Buscar por nome, código ou categoria…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {SERVICE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              {items.length === 0
                ? "Nenhum serviço cadastrado. Clique em “Novo serviço” para começar."
                : "Nenhum serviço encontrado com os filtros atuais."}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((s) => (
                <div
                  key={s.id}
                  className="flex items-start justify-between gap-3 rounded-md border p-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{s.name}</span>
                      {s.code && (
                        <Badge variant="outline" className="font-mono text-xs">
                          {s.code}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-xs">
                        {typeLabel(s.service_type)}
                      </Badge>
                      {s.category && (
                        <Badge variant="outline" className="text-xs">
                          {s.category}
                        </Badge>
                      )}
                      {!s.active && (
                        <Badge variant="secondary" className="text-xs">
                          Inativo
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-3">
                      <span>
                        {formatCurrency(s.base_price, s.currency)} / {unitLabel(s.unit)}
                      </span>
                      {Number(s.cost) > 0 && (
                        <span>Custo {formatCurrency(s.cost, s.currency)}</span>
                      )}
                      {Number(s.tax_rate) > 0 && <span>Imposto {s.tax_rate}%</span>}
                      {s.default_sla_hours != null && (
                        <span>SLA {s.default_sla_hours}h</span>
                      )}
                    </div>
                    {s.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">
                        {s.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Switch checked={s.active} onCheckedChange={(v) => toggle(s, v)} />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(s)}
                      aria-label="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(s.id)}
                      aria-label="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar serviço" : "Novo serviço"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input
                  value={draft.name ?? ""}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Código</Label>
                <Input
                  value={draft.code ?? ""}
                  onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Input
                  placeholder="Cloud, Suporte, Consultoria…"
                  value={draft.category ?? ""}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select
                  value={draft.service_type ?? "one_off"}
                  onValueChange={(v) => setDraft({ ...draft, service_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Preço base</Label>
                <CurrencyInput
                  currency={draft.currency ?? "BRL"}
                  value={draft.base_price ?? 0}
                  onValueChange={(n) => setDraft({ ...draft, base_price: n ?? 0 })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Moeda</Label>
                <Input
                  value={draft.currency ?? "BRL"}
                  onChange={(e) =>
                    setDraft({ ...draft, currency: e.target.value.toUpperCase() })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Unidade</Label>
                <Select
                  value={draft.unit ?? "hour"}
                  onValueChange={(v) => setDraft({ ...draft, unit: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u.value} value={u.value}>
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Custo</Label>
                <CurrencyInput
                  currency={draft.currency ?? "BRL"}
                  value={draft.cost ?? 0}
                  onValueChange={(n) => setDraft({ ...draft, cost: n ?? 0 })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Imposto %</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={String(draft.tax_rate ?? 0)}
                  onChange={(e) =>
                    setDraft({ ...draft, tax_rate: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>SLA padrão (h)</Label>
                <Input
                  type="number"
                  min={0}
                  value={draft.default_sla_hours ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      default_sla_hours: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea
                rows={3}
                value={draft.description ?? ""}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Competências (separadas por vírgula)</Label>
                <Input
                  value={(draft.competencies ?? []).join(", ")}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      competencies: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tags (separadas por vírgula)</Label>
                <Input
                  value={(draft.tags ?? []).join(", ")}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      tags: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={draft.active ?? true}
                onCheckedChange={(v) => setDraft({ ...draft, active: v })}
              />
              <Label className="cursor-pointer">Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save}>{editing ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
