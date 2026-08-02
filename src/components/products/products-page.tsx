import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { RichHtmlEditor, htmlToPlain } from "@/components/rich-html-editor";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/crm";
import { confirmDialog } from "@/components/ui/confirm-dialog";

type Product = {
  id: string;
  owner_id: string;
  name: string;
  sku: string | null;
  description: string | null;
  unit_price: number;
  currency: string;
  tax_rate: number;
  unit: string | null;
  active: boolean;
};

type Draft = Partial<Product>;

export function ProductsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [draft, setDraft] = useState<Draft>({});

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from("products").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });

  function openNew() {
    setEditing(null);
    setDraft({ active: true, currency: "BRL", unit_price: 0, tax_rate: 0 });
    setOpen(true);
  }
  function openEdit(p: Product) {
    setEditing(p);
    setDraft({ ...p });
    setOpen(true);
  }
  async function save() {
    if (!user) return;
    if (!draft.name?.trim()) {
      toast.error("Informe o nome.");
      return;
    }
    const payload = {
      name: draft.name!.trim(),
      sku: draft.sku?.toString().trim() || null,
      description: draft.description?.toString() || null,
      unit_price: Number(draft.unit_price ?? 0),
      currency: (draft.currency || "BRL").toUpperCase(),
      tax_rate: Number(draft.tax_rate ?? 0),
      unit: draft.unit?.toString().trim() || null,
      active: draft.active ?? true,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { error } = editing
      ? await sb.from("products").update(payload).eq("id", editing.id)
      : await sb.from("products").insert({ ...payload, owner_id: user.id });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? "Produto atualizado." : "Produto criado.");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["products"] });
  }
  async function remove(id: string) {
    if (!(await confirmDialog("Excluir este produto?"))) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("products").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["products"] });
  }
  async function toggle(p: Product, active: boolean) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("products").update({ active }).eq("id", p.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["products"] });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Produtos</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Catálogo reutilizável de produtos e serviços para usar como itens de linha em negócios.
          </p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Novo produto
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : products.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum produto cadastrado.</p>
        ) : (
          <div className="space-y-2">
            {products.map((p) => (
              <div
                key={p.id}
                className="flex items-start justify-between gap-3 rounded-md border p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{p.name}</span>
                    {p.sku && (
                      <Badge variant="outline" className="font-mono text-xs">
                        {p.sku}
                      </Badge>
                    )}
                    {!p.active && (
                      <Badge variant="secondary" className="text-xs">
                        Inativo
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-3">
                    <span>
                      {formatCurrency(p.unit_price, p.currency)}
                      {p.unit ? ` / ${p.unit}` : ""}
                    </span>
                    {Number(p.tax_rate) > 0 && <span>Imposto {p.tax_rate}%</span>}
                  </div>
                  {p.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {htmlToPlain(p.description)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Switch checked={p.active} onCheckedChange={(v) => toggle(p, v)} />
                  <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(p.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar produto" : "Novo produto"}</DialogTitle>
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
                <Label>SKU</Label>
                <Input
                  value={draft.sku ?? ""}
                  onChange={(e) => setDraft({ ...draft, sku: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Preço unitário</Label>
                <CurrencyInput
                  currency="BRL"
                  value={draft.unit_price ?? 0}
                  onValueChange={(n) => setDraft({ ...draft, unit_price: n ?? 0 })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Moeda</Label>
                <Input
                  value={draft.currency ?? "BRL"}
                  onChange={(e) => setDraft({ ...draft, currency: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Imposto %</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={String(draft.tax_rate ?? 0)}
                  onChange={(e) => setDraft({ ...draft, tax_rate: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Unidade</Label>
              <Input
                placeholder="hora, peça, mês…"
                value={draft.unit ?? ""}
                onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <RichHtmlEditor
                value={draft.description ?? ""}
                onChange={(html) => setDraft({ ...draft, description: html })}
                minHeight={140}
              />
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
    </Card>
  );
}
