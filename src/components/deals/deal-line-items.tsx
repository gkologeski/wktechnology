import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EntityCombobox } from "@/components/ui/entity-combobox";
import { Package, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/crm";

type LineItem = {
  id: string;
  owner_id: string;
  deal_id: string;
  product_id: string | null;
  name: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  tax_rate: number;
  position: number;
};

type Product = {
  id: string;
  name: string;
  unit_price: number;
  currency: string;
  tax_rate: number;
  active: boolean;
};

function lineTotal(li: { quantity: number; unit_price: number; discount_pct: number; tax_rate: number }) {
  const sub = Number(li.quantity) * Number(li.unit_price) * (1 - Number(li.discount_pct) / 100);
  return sub * (1 + Number(li.tax_rate) / 100);
}

export function DealLineItems({ dealId, ownerId, currency }: { dealId: string; ownerId: string; currency: string }) {
  const qc = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["deal_line_items", dealId],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("deal_line_items").select("*").eq("deal_id", dealId).order("position");
      if (error) throw error;
      return (data ?? []) as LineItem[];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products", "active"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("products").select("*").eq("active", true).order("name");
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });

  async function addBlank() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("deal_line_items").insert({
      owner_id: ownerId, deal_id: dealId,
      name: "Novo item", quantity: 1, unit_price: 0, discount_pct: 0, tax_rate: 0,
      position: items.length,
    });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["deal_line_items", dealId] });
    qc.invalidateQueries({ queryKey: ["deals"] });
  }
  async function addFromProduct(pid: string) {
    const p = products.find((x) => x.id === pid);
    if (!p) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("deal_line_items").insert({
      owner_id: ownerId, deal_id: dealId, product_id: p.id,
      name: p.name, quantity: 1, unit_price: p.unit_price,
      discount_pct: 0, tax_rate: p.tax_rate, position: items.length,
    });
    if (error) { toast.error(error.message); return; }
    setProductPick("");
    qc.invalidateQueries({ queryKey: ["deal_line_items", dealId] });
    qc.invalidateQueries({ queryKey: ["deals"] });
  }
  async function update(id: string, patch: Partial<LineItem>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("deal_line_items").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["deal_line_items", dealId] });
    qc.invalidateQueries({ queryKey: ["deals"] });
  }
  async function remove(id: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("deal_line_items").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["deal_line_items", dealId] });
    qc.invalidateQueries({ queryKey: ["deals"] });
  }

  const subtotal = items.reduce((s, li) => s + Number(li.quantity) * Number(li.unit_price), 0);
  const discount = items.reduce(
    (s, li) => s + Number(li.quantity) * Number(li.unit_price) * (Number(li.discount_pct) / 100),
    0,
  );
  const tax = items.reduce((s, li) => {
    const base = Number(li.quantity) * Number(li.unit_price) * (1 - Number(li.discount_pct) / 100);
    return s + base * (Number(li.tax_rate) / 100);
  }, 0);
  const total = items.reduce((s, li) => s + lineTotal(li), 0);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <Select value={productPick} onValueChange={(v) => { setProductPick(v); addFromProduct(v); }}>
          <SelectTrigger className="w-[260px]"><SelectValue placeholder="Adicionar do catálogo…" /></SelectTrigger>
          <SelectContent>
            {products.length === 0
              ? <SelectItem value="__empty" disabled>Nenhum produto ativo</SelectItem>
              : products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} · {formatCurrency(p.unit_price, p.currency)}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={addBlank}><Plus className="h-4 w-4 mr-1" /> Item em branco</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum item adicionado.</p>
      ) : (
        <div className="space-y-2">
          {items.map((li) => (
            <div key={li.id} className="rounded-md border p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  className="flex-1"
                  value={li.name}
                  onBlur={(e) => e.target.value !== li.name && update(li.id, { name: e.target.value })}
                  onChange={(e) => (li.name = e.target.value)}
                  defaultValue={li.name}
                />
                <Button variant="ghost" size="icon" onClick={() => remove(li.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <LabeledNumber label="Qtd" value={li.quantity} step="0.01" onCommit={(v) => update(li.id, { quantity: v })} />
                <LabeledNumber label="Preço" value={li.unit_price} step="0.01" onCommit={(v) => update(li.id, { unit_price: v })} />
                <LabeledNumber label="Desc %" value={li.discount_pct} step="0.01" onCommit={(v) => update(li.id, { discount_pct: v })} />
                <LabeledNumber label="Imp %" value={li.tax_rate} step="0.01" onCommit={(v) => update(li.id, { tax_rate: v })} />
              </div>
              <div className="text-right text-sm font-medium tabular-nums">
                {formatCurrency(lineTotal(li), currency)}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
        <Row label="Subtotal" value={formatCurrency(subtotal, currency)} />
        <Row label="Descontos" value={`− ${formatCurrency(discount, currency)}`} />
        <Row label="Impostos" value={`+ ${formatCurrency(tax, currency)}`} />
        <div className="border-t pt-1 mt-1">
          <Row label="Total" value={formatCurrency(total, currency)} bold />
        </div>
      </div>
    </div>
  );
}

function LabeledNumber({ label, value, step, onCommit }: { label: string; value: number; step?: string; onCommit: (v: number) => void }) {
  const [v, setV] = useState(String(value));
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <Input
        type="number"
        step={step}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          const n = Number(v);
          if (!Number.isNaN(n) && n !== Number(value)) onCommit(n);
        }}
      />
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? "font-semibold" : "text-muted-foreground"}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
