import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useCurrentUserId } from "@/hooks/use-current-user-id";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyCommitInput } from "@/components/ui/currency-commit-input";
import { EntityCombobox } from "@/components/ui/entity-combobox";
import { Wrench, Plus, Trash2, Pencil } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { listPresetsForService } from "@/lib/contracting-presets.functions";
import { PresetLinePicker } from "@/components/catalog/preset-line-picker";
import { presetToLinePatch, type PresetOption } from "@/lib/contracting-presets-shared";
import { SENIORITY_LABEL } from "@/lib/job-profiles-shared";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/crm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type DiscountType = "pct" | "amount";

type LineItem = {
  id: string;
  owner_id: string;
  deal_id: string;
  service_catalog_id?: string | null;
  contracting_preset_id?: string | null;
  job_profile_id?: string | null;
  seniority?: string | null;
  unit?: string | null;
  name: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  discount_amount: number;
  discount_type: DiscountType;
  tax_rate: number;
  position: number;
};

function n(v: unknown) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}
function lineDiscount(li: {
  quantity?: number | null;
  unit_price?: number | null;
  discount_pct?: number | null;
  discount_amount?: number | null;
  discount_type?: DiscountType | string | null;
}) {
  const qty = n(li.quantity);
  const price = n(li.unit_price);
  const gross = qty * price;
  if ((li.discount_type ?? "pct") === "amount") {
    const raw = n(li.discount_amount) * qty;
    return Math.min(Math.max(raw, 0), gross);
  }
  return gross * (n(li.discount_pct) / 100);
}
function lineSubtotalAfterDiscount(li: Parameters<typeof lineDiscount>[0]) {
  return n(li.quantity) * n(li.unit_price) - lineDiscount(li);
}
function lineTotal(li: {
  quantity?: number | null;
  unit_price?: number | null;
  discount_pct?: number | null;
  discount_amount?: number | null;
  discount_type?: DiscountType | string | null;
  tax_rate?: number | null;
}) {
  const sub = lineSubtotalAfterDiscount(li);
  return sub * (1 + n(li.tax_rate) / 100);
}

const lineItemsQueryKey = (dealId: string) => ["deal_line_items", dealId, "full"] as const;

function useLineItems(dealId: string) {
  return useQuery({
    queryKey: lineItemsQueryKey(dealId),
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("deal_line_items")
        .select("*")
        .eq("deal_id", dealId)
        .order("position");
      if (error) throw error;
      return (data ?? []) as LineItem[];
    },
  });
}

export function DealLineItems({
  dealId,
  ownerId,
  currency,
}: {
  dealId: string;
  ownerId: string;
  currency: string;
}) {
  const { data: items = [], isLoading } = useLineItems(dealId);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum item adicionado. Clique em "Editar" para adicionar.
      </p>
    );
  }

  return (
    <ul className="divide-y">
      {items.map((li) => (
        <li key={li.id} className="flex items-baseline justify-between gap-3 py-2">
          <div className="min-w-0 truncate">
            <span className="text-sm">{li.name || "—"}</span>{" "}
            <span className="text-xs text-muted-foreground">x{n(li.quantity)}</span>
          </div>
          <div className="text-sm tabular-nums shrink-0">
            {formatCurrency(lineTotal(li), currency)}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DealLineItemsEditor({
  dealId,
  ownerId,
  currency,
  trigger,
}: {
  dealId: string;
  ownerId: string;
  currency: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Itens de linha</DialogTitle>
        </DialogHeader>
        <LineItemsEditorBody dealId={dealId} ownerId={ownerId} currency={currency} />
      </DialogContent>
    </Dialog>
  );
}

export function DealLineItemsCount({ dealId }: { dealId: string }) {
  const { data: items = [] } = useLineItems(dealId);
  return <>{items.length}</>;
}

export function LineItemsEditorBody({
  dealId,
  // Mantido por compatibilidade com as telas que já passam o dono do negócio,
  // mas o dono do item precisa ser o usuário autenticado (regras de acesso).
  ownerId: _ownerId,
  currency,
}: {
  dealId: string;
  ownerId: string;
  currency: string;
}) {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useLineItems(dealId);
  const currentUserId = useCurrentUserId();
  const listPresets = useServerFn(listPresetsForService);

  // O item precisa herdar o workspace do negócio para passar pelas regras de acesso.
  const { data: dealScope } = useQuery({
    queryKey: ["deal_scope", dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("workspace_id")
        .eq("id", dealId)
        .maybeSingle();
      if (error) throw error;
      return data as { workspace_id: string | null } | null;
    },
  });

  function baseInsertScope() {
    if (!currentUserId) {
      toast.error("Sessão não identificada. Recarregue a página e tente novamente.");
      return null;
    }
    if (!dealScope?.workspace_id) {
      toast.error("Não foi possível identificar o workspace do negócio.");
      return null;
    }
    return { owner_id: currentUserId, workspace_id: dealScope.workspace_id, deal_id: dealId };
  }

  function insertErrorMessage(message: string) {
    if (/row-level security/i.test(message)) {
      return "Você não tem permissão para alterar os itens deste negócio.";
    }
    return message;
  }

  const setItemsCache = (updater: (current: LineItem[]) => LineItem[]) => {
    qc.setQueryData<LineItem[]>(lineItemsQueryKey(dealId), (current = []) => updater(current));
  };

  const refreshItems = () => {
    qc.invalidateQueries({ queryKey: lineItemsQueryKey(dealId) });
  };

  function notifyDealsChanged() {
    // Do NOT invalidate the editor's "full" cache here — optimistic cache is
    // the source of truth during editing. Invalidating mid-flight would race
    // with sibling queries (e.g. the "count" query used by DealQuotes) and
    // could wipe unit_price/name/etc. from the editor.
    qc.invalidateQueries({ queryKey: ["deals"] });
    qc.invalidateQueries({ queryKey: ["deal_line_items", dealId, "count"] });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("deal:line-items-changed", { detail: { dealId } }));
    }
  }

  async function addBlank() {
    const scope = baseInsertScope();
    if (!scope) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("deal_line_items")
      .insert({
        ...scope,
        name: "Novo item",
        quantity: 1,
        unit_price: 0,
        discount_pct: 0,
        discount_amount: 0,
        discount_type: "pct",
        tax_rate: 0,
        position: items.length,
      })
      .select("*")
      .single();
    if (error) return toast.error(insertErrorMessage(error.message));

    if (data) {
      setItemsCache((current) =>
        [...current.filter((it) => it.id !== (data as LineItem).id), data as LineItem].sort(
          (a, b) => n(a.position) - n(b.position),
        ),
      );
    }
    notifyDealsChanged();
  }
  async function addFromCatalogService(sid: string) {
    const scope = baseInsertScope();
    if (!scope) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: p, error: perr } = await (supabase as any)
      .from("service_catalog")
      .select("id, name, base_price, tax_rate, unit")
      .eq("id", sid)
      .maybeSingle();
    if (perr || !p) return toast.error(perr?.message ?? "Serviço não encontrado");

    // Preset de contratação: quando o serviço tem exatamente um preset ativo,
    // aplicamos automaticamente (cargo, senioridade, unidade e preço sugerido).
    let presetPatch: Record<string, unknown> = {};
    let appliedPresetName: string | null = null;
    try {
      const presets = (await listPresets({
        data: { serviceCatalogId: p.id },
      })) as unknown as PresetOption[];
      if (presets.length === 1 && presets[0]) {
        presetPatch = presetToLinePatch(presets[0]) as unknown as Record<string, unknown>;
        appliedPresetName = presets[0].name;
      }
    } catch {
      // Presets são opcionais: falha de permissão/rede não bloqueia o item.
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("deal_line_items")
      .insert({
        ...scope,
        service_catalog_id: p.id,
        name: p.name,
        quantity: 1,
        unit_price: p.base_price ?? 0,
        unit: p.unit ?? null,
        ...presetPatch,
        discount_pct: 0,
        discount_amount: 0,
        discount_type: "pct",
        tax_rate: p.tax_rate,
        position: items.length,
      })
      .select("*")
      .single();
    if (error) return toast.error(insertErrorMessage(error.message));

    if (data) {
      setItemsCache((current) =>
        [...current.filter((it) => it.id !== (data as LineItem).id), data as LineItem].sort(
          (a, b) => n(a.position) - n(b.position),
        ),
      );
      setProductPickerKey((k) => k + 1);
      if (appliedPresetName) toast.success(`Preset aplicado: ${appliedPresetName}`);
    }
    notifyDealsChanged();
  }
  async function update(id: string, patch: Partial<LineItem>) {
    const previous = qc.getQueryData<LineItem[]>(lineItemsQueryKey(dealId));
    setItemsCache((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("deal_line_items").update(patch).eq("id", id);
    if (error) {
      qc.setQueryData(lineItemsQueryKey(dealId), previous);
      refreshItems();
      return toast.error(insertErrorMessage(error.message));
    }
    notifyDealsChanged();
  }
  async function remove(id: string) {
    const previous = qc.getQueryData<LineItem[]>(lineItemsQueryKey(dealId));
    setItemsCache((current) => current.filter((item) => item.id !== id));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("deal_line_items").delete().eq("id", id);
    if (error) {
      qc.setQueryData(lineItemsQueryKey(dealId), previous);
      refreshItems();
      return toast.error(insertErrorMessage(error.message));
    }
    notifyDealsChanged();
  }

  const [productPickerKey, setProductPickerKey] = useState(0);

  const subtotal = items.reduce((s, li) => s + n(li.quantity) * n(li.unit_price), 0);
  const discount = items.reduce((s, li) => s + lineDiscount(li), 0);
  const tax = items.reduce(
    (s, li) => s + lineSubtotalAfterDiscount(li) * (n(li.tax_rate) / 100),
    0,
  );
  const total = items.reduce((s, li) => s + lineTotal(li), 0);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <div className="w-[260px]">
          <EntityCombobox
            key={`service-picker-${productPickerKey}`}
            entity="service_catalog"
            select="id, name, code, base_price, currency, unit"
            searchColumns={["name", "code", "description"]}
            labelFrom={(r) => String((r as { name?: string }).name ?? "Serviço")}
            hintFrom={(r) => {
              const row = r as { base_price?: number; currency?: string; unit?: string };
              if (row.base_price == null) return null;
              const price = formatCurrency(Number(row.base_price), row.currency ?? "BRL");
              return row.unit ? `${price} / ${row.unit}` : price;
            }}
            value={null}
            onChange={(id) => {
              if (id) addFromCatalogService(id);
            }}
            placeholder="Adicionar serviço do catálogo…"
            emptyLabel="Nenhum serviço"
            icon={Wrench}
            clearable={false}
          />
        </div>
        <Button size="sm" variant="outline" onClick={addBlank}>
          <Plus className="h-4 w-4 mr-1" /> Item em branco
        </Button>
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
                <TextField
                  className="flex-1"
                  value={li.name ?? ""}
                  placeholder="Nome do item"
                  onCommit={(v) => {
                    if (v !== (li.name ?? "")) update(li.id, { name: v });
                  }}
                />
                <Button variant="ghost" size="icon" onClick={() => remove(li.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {li.service_catalog_id ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <PresetLinePicker
                    serviceCatalogId={li.service_catalog_id}
                    value={li.contracting_preset_id ?? null}
                    onApply={(preset) => {
                      if (!preset) {
                        update(li.id, {
                          contracting_preset_id: null,
                          job_profile_id: null,
                          seniority: null,
                        });
                        return;
                      }
                      update(li.id, presetToLinePatch(preset) as Partial<LineItem>);
                    }}
                  />
                  {li.job_profile_id || li.seniority ? (
                    <div className="space-y-1">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Cargo / senioridade
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {[
                          li.seniority ? (SENIORITY_LABEL[li.seniority] ?? li.seniority) : null,
                          li.unit ? `por ${li.unit}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed bg-muted/30 p-2">
                  <span className="text-xs text-muted-foreground">
                    Item sem linha de serviço. Vincule ao catálogo para entrar nos relatórios por
                    serviço.
                  </span>
                  <div className="w-[240px]">
                    <EntityCombobox
                      entity="service_catalog"
                      select="id, name, code, unit"
                      searchColumns={["name", "code", "description"]}
                      filters={{ active: true }}
                      labelFrom={(r) => String((r as { name?: string }).name ?? "Serviço")}
                      value={null}
                      onChange={(id, item) => {
                        if (!id) return;
                        update(li.id, {
                          service_catalog_id: id,
                          ...(li.name ? {} : { name: item?.label ?? null }),
                        } as Partial<LineItem>);
                      }}
                      placeholder="Vincular serviço…"
                      emptyLabel="Nenhum serviço"
                      icon={Wrench}
                      clearable={false}
                    />
                  </div>
                </div>
              )}


              <div className="grid grid-cols-4 gap-2">
                <LabeledNumber
                  label="Qtd"
                  value={n(li.quantity)}
                  step="0.01"
                  onCommit={(v) => update(li.id, { quantity: v })}
                />
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Preço
                  </div>
                  <CurrencyCommitInput
                    aria-label="Preço"
                    currency={currency}
                    value={n(li.unit_price)}
                    onCommit={(v) => update(li.id, { unit_price: v ?? 0 })}
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Desconto
                  </div>
                  <div className="relative">
                    {(li.discount_type ?? "pct") === "amount" ? (
                      <CurrencyCommitInput
                        aria-label="Desconto em valor"
                        className="pr-14"
                        currency={currency}
                        value={n(li.discount_amount)}
                        onCommit={(v) => update(li.id, { discount_amount: v ?? 0 })}
                      />
                    ) : (
                      <Input
                        type="number"
                        step="0.01"
                        className="pr-14"
                        defaultValue={String(n(li.discount_pct))}
                        key={`pct-${li.id}-${n(li.discount_pct)}`}
                        onBlur={(e) => {
                          const num = Number(e.currentTarget.value);
                          if (!Number.isNaN(num) && num !== n(li.discount_pct)) {
                            update(li.id, { discount_pct: num });
                          }
                        }}
                      />
                    )}
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex rounded-md border overflow-hidden text-[10px] h-5">
                      <button
                        type="button"
                        className={`px-1.5 ${
                          (li.discount_type ?? "pct") === "pct"
                            ? "bg-primary text-primary-foreground"
                            : "bg-transparent text-muted-foreground"
                        }`}
                        onClick={() => {
                          if ((li.discount_type ?? "pct") !== "pct") {
                            update(li.id, { discount_type: "pct", discount_amount: 0 });
                          }
                        }}
                        aria-label="Desconto em porcentagem"
                      >
                        %
                      </button>
                      <button
                        type="button"
                        className={`px-1.5 border-l ${
                          li.discount_type === "amount"
                            ? "bg-primary text-primary-foreground"
                            : "bg-transparent text-muted-foreground"
                        }`}
                        onClick={() => {
                          if (li.discount_type !== "amount") {
                            update(li.id, { discount_type: "amount", discount_pct: 0 });
                          }
                        }}
                        aria-label="Desconto em valor"
                      >
                        R$
                      </button>
                    </div>
                  </div>
                </div>
                <LabeledNumber
                  label="Imp %"
                  value={n(li.tax_rate)}
                  step="0.01"
                  onCommit={(v) => update(li.id, { tax_rate: v })}
                />
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

function LabeledNumber({
  label,
  value,
  step,
  onCommit,
}: {
  label: string;
  value: number;
  step?: string;
  onCommit: (v: number) => void;
}) {
  const [v, setV] = useState(String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setV(String(value));
  }, [value, focused]);
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <Input
        type="number"
        step={step}
        value={v}
        onFocus={() => setFocused(true)}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          setFocused(false);
          const num = Number(v);
          if (!Number.isNaN(num) && num !== Number(value)) onCommit(num);
        }}
      />
    </div>
  );
}

function TextField({
  value,
  placeholder,
  className,
  onCommit,
}: {
  value: string;
  placeholder?: string;
  className?: string;
  onCommit: (v: string) => void;
}) {
  const [v, setV] = useState(value);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setV(value);
  }, [value, focused]);
  return (
    <Input
      className={className}
      placeholder={placeholder}
      value={v}
      onFocus={() => setFocused(true)}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        setFocused(false);
        if (v !== value) onCommit(v);
      }}
    />
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between ${bold ? "font-semibold" : "text-muted-foreground"}`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

export { Pencil };
