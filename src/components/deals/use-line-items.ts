// Estado e persistência dos itens de linha do negócio: autosave por campo,
// pilha de desfazer, indicador de "salvando/salvo/não salvo" e criação de itens
// a partir do catálogo (com preset e modelo de cobrança).
import { useCallback, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { DELETE_DENIED_MESSAGE } from "@/lib/delete-guard";
import { useCurrentUserId } from "@/hooks/use-current-user-id";
import { listPresetsForService } from "@/lib/contracting-presets.functions";
import { presetToLinePatch, type PresetOption } from "@/lib/contracting-presets-shared";
import {
  BILLING_MODEL_DEFAULT_UNIT,
  computeBillingAmount,
  isBillingModel,
  type BillingModel,
} from "@/lib/catalog/billing-model";
import {
  describeEntry,
  previousValues,
  pushHistory,
  type HistoryEntry,
} from "./line-items-history";

export type DiscountType = "pct" | "amount";

export type LineItem = {
  id: string;
  owner_id: string;
  deal_id: string;
  service_catalog_id?: string | null;
  contracting_preset_id?: string | null;
  service_name?: string | null;
  preset_name?: string | null;
  job_profile_id?: string | null;
  seniority?: string | null;
  unit?: string | null;
  billing_model?: BillingModel | string | null;
  percent?: number | null;
  percent_base_amount?: number | null;
  cadence?: string | null;
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

export function n(v: unknown) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

/** Valor bruto da linha, respeitando a forma de cobrança. */
export function lineGross(li: Partial<LineItem>) {
  return computeBillingAmount({
    billing_model: li.billing_model ?? null,
    quantity: li.quantity ?? null,
    unit_price: li.unit_price ?? null,
    percent: li.percent ?? null,
    percent_base_amount: li.percent_base_amount ?? null,
  });
}

export function lineDiscount(li: Partial<LineItem>) {
  const gross = lineGross(li);
  if ((li.discount_type ?? "pct") === "amount") {
    // Desconto em R$ é o valor total da linha (não por unidade).
    return Math.min(Math.max(n(li.discount_amount), 0), gross);
  }
  return gross * (n(li.discount_pct) / 100);
}

export function lineSubtotalAfterDiscount(li: Partial<LineItem>) {
  return lineGross(li) - lineDiscount(li);
}

export function lineTotal(li: Partial<LineItem>) {
  return lineSubtotalAfterDiscount(li) * (1 + n(li.tax_rate) / 100);
}

/**
 * Colunas que existem de fato em `deal_line_items`. Campos como `preset_name`,
 * `service_name` e `job_profile_name` são apenas rótulos derivados dos cadastros
 * relacionados (usados na exibição) e não podem ser enviados ao banco.
 */
export const LINE_ITEM_PERSISTABLE_FIELDS = [
  "id",
  "owner_id",
  "workspace_id",
  "deal_id",
  "service_catalog_id",
  "contracting_preset_id",
  "job_profile_id",
  "seniority",
  "unit",
  "billing_model",
  "percent",
  "percent_base_amount",
  "cadence",
  "name",
  "description",
  "quantity",
  "unit_price",
  "discount_pct",
  "discount_amount",
  "discount_type",
  "tax_rate",
  "position",
] as const;

const PERSISTABLE = new Set<string>(LINE_ITEM_PERSISTABLE_FIELDS);

/** Mantém só as chaves graváveis; descarta rótulos e joins de exibição. */
export function persistableFields<T extends Record<string, unknown>>(patch: T) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (PERSISTABLE.has(key)) out[key] = value;
  }
  return out;
}

export const lineItemsQueryKey = (dealId: string) => ["deal_line_items", dealId, "full"] as const;

export function useLineItems(dealId: string) {
  return useQuery({
    queryKey: lineItemsQueryKey(dealId),
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("deal_line_items")
        .select("*, service:service_catalog(name), preset:contracting_presets(name)")
        .eq("deal_id", dealId)
        .order("position");
      if (error) throw error;
      return (
        (data ?? []) as Array<
          LineItem & {
            service?: { name: string | null } | null;
            preset?: { name: string | null } | null;
          }
        >
      ).map((item) => ({
        ...item,
        service_name: item.service?.name ?? null,
        preset_name: item.preset?.name ?? null,
      }));
    },
  });
}

export type SaveStatus = "idle" | "dirty" | "saving" | "saved";

export function useLineItemsEditor(dealId: string) {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useLineItems(dealId);
  const currentUserId = useCurrentUserId();
  const listPresets = useServerFn(listPresetsForService);

  const [history, setHistory] = useState<HistoryEntry<LineItem>[]>([]);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const inflight = useRef(0);

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

  const begin = useCallback(() => {
    inflight.current += 1;
    setStatus("saving");
  }, []);
  const end = useCallback(() => {
    inflight.current = Math.max(0, inflight.current - 1);
    if (inflight.current === 0) setStatus("saved");
  }, []);

  const markDirty = useCallback(() => {
    if (inflight.current === 0) setStatus("dirty");
  }, []);

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

  function errorMessage(message: string) {
    if (/row-level security/i.test(message)) {
      return "Você não tem permissão para alterar os itens deste negócio.";
    }
    return message;
  }

  const setItemsCache = (updater: (current: LineItem[]) => LineItem[]) => {
    qc.setQueryData<LineItem[]>(lineItemsQueryKey(dealId), (current = []) => updater(current));
  };
  const refreshItems = () => qc.invalidateQueries({ queryKey: lineItemsQueryKey(dealId) });

  function notifyDealsChanged() {
    // Não invalidar o cache "full" do editor: o cache otimista é a fonte da
    // verdade durante a edição.
    qc.invalidateQueries({ queryKey: ["deals"] });
    qc.invalidateQueries({ queryKey: ["deal_line_items", dealId, "count"] });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("deal:line-items-changed", { detail: { dealId } }));
    }
  }

  const mergeInserted = (row: LineItem) =>
    setItemsCache((current) =>
      [...current.filter((it) => it.id !== row.id), row].sort(
        (a, b) => n(a.position) - n(b.position),
      ),
    );

  async function insertRow(values: Record<string, unknown>, label: string) {
    begin();
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("deal_line_items")
        .insert(persistableFields(values))
        .select("*")
        .single();
      if (error) {
        toast.error(errorMessage(error.message));
        return null;
      }
      const row = data as LineItem;
      mergeInserted(row);
      setHistory((h) => pushHistory(h, { kind: "insert", id: row.id, label }));
      notifyDealsChanged();
      return row;
    } finally {
      end();
    }
  }

  async function addBlank() {
    const scope = baseInsertScope();
    if (!scope) return;
    await insertRow(
      {
        ...scope,
        name: "Novo item",
        quantity: 1,
        unit_price: 0,
        discount_pct: 0,
        discount_amount: 0,
        discount_type: "pct",
        tax_rate: 0,
        billing_model: "per_unit",
        position: items.length,
      },
      "Novo item",
    );
  }

  async function addFromCatalogService(sid: string) {
    const scope = baseInsertScope();
    if (!scope) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: p, error: perr } = await (supabase as any)
      .from("service_catalog")
      .select(
        "id, name, base_price, tax_rate, unit, billing_model, default_cadence, default_percent",
      )
      .eq("id", sid)
      .maybeSingle();
    if (perr || !p) return toast.error(perr?.message ?? "Serviço não encontrado");

    // Preset de contratação: um único preset ativo é aplicado automaticamente.
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

    const model: BillingModel = isBillingModel(p.billing_model) ? p.billing_model : "per_unit";
    const row = await insertRow(
      {
        ...scope,
        service_catalog_id: p.id,
        name: p.name,
        quantity: 1,
        unit_price: p.base_price ?? 0,
        unit: p.unit ?? BILLING_MODEL_DEFAULT_UNIT[model],
        billing_model: model,
        cadence: p.default_cadence ?? null,
        percent: p.default_percent ?? null,
        ...presetPatch,
        discount_pct: 0,
        discount_amount: 0,
        discount_type: "pct",
        tax_rate: p.tax_rate,
        position: items.length,
      },
      String(p.name ?? "Serviço"),
    );
    if (row && appliedPresetName) toast.success(`Preset aplicado: ${appliedPresetName}`);
    return row;
  }

  async function persistUpdate(id: string, patch: Partial<LineItem>) {
    const previous = qc.getQueryData<LineItem[]>(lineItemsQueryKey(dealId));
    setItemsCache((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
    // Rótulos de exibição (nome do preset/serviço) não são colunas: só aparecem
    // no cache. Se nada gravável sobrar, não há o que enviar ao banco.
    const values = persistableFields(patch as Record<string, unknown>);
    if (Object.keys(values).length === 0) return true;
    begin();
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("deal_line_items")
        .update(values)
        .eq("id", id)
        .select("id");
      if (error) {
        qc.setQueryData(lineItemsQueryKey(dealId), previous);
        refreshItems();
        toast.error(errorMessage(error.message));
        return false;
      }
      // Quando a regra de acesso nega, o banco não devolve erro: só 0 linhas.
      if (!Array.isArray(data) || data.length === 0) {
        qc.setQueryData(lineItemsQueryKey(dealId), previous);
        refreshItems();
        toast.error("Você não tem permissão para alterar este item.");
        return false;
      }
      notifyDealsChanged();
      return true;
    } finally {
      end();
    }
  }

  /** Atualiza um campo (autosave) e registra a ação no histórico. */
  async function update(id: string, patch: Partial<LineItem>) {
    const item = items.find((it) => it.id === id);
    const ok = await persistUpdate(id, patch);
    if (ok && item) {
      setHistory((h) =>
        pushHistory(h, {
          kind: "update",
          id,
          label: item.name || "item",
          previous: previousValues(
            item as unknown as Record<string, unknown>,
            patch,
          ) as Partial<LineItem>,
        }),
      );
    }
  }

  async function removeRow(id: string, record = true) {
    const item = items.find((it) => it.id === id);
    const previous = qc.getQueryData<LineItem[]>(lineItemsQueryKey(dealId));
    setItemsCache((current) => current.filter((it) => it.id !== id));
    begin();
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("deal_line_items")
        .delete()
        .eq("id", id)
        .select("id");
      if (error) {
        qc.setQueryData(lineItemsQueryKey(dealId), previous);
        refreshItems();
        toast.error(errorMessage(error.message));
        return false;
      }
      // Exclusão negada pela regra de acesso não gera erro: apenas 0 linhas.
      if (!Array.isArray(data) || data.length === 0) {
        qc.setQueryData(lineItemsQueryKey(dealId), previous);
        refreshItems();
        toast.error(DELETE_DENIED_MESSAGE);
        return false;
      }
      if (record && item) {
        setHistory((h) =>
          pushHistory(h, { kind: "delete", id, label: item.name || "item", row: item }),
        );
      }
      notifyDealsChanged();
      return true;
    } finally {
      end();
    }
  }

  /** Desfaz a última ação registrada (sem entrar de novo no histórico). */
  async function undo() {
    const entry = history[history.length - 1];
    if (!entry) return;
    setHistory((h) => h.slice(0, -1));
    if (entry.kind === "update") {
      await persistUpdate(entry.id, entry.previous);
    } else if (entry.kind === "insert") {
      await removeRow(entry.id, false);
    } else {
      const { id, owner_id, ...rest } = entry.row;
      void owner_id;
      const scope = baseInsertScope();
      if (!scope) return;
      begin();
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from("deal_line_items")
          .insert(persistableFields({ ...rest, ...scope, id }))
          .select("*")
          .single();
        if (error) {
          toast.error(errorMessage(error.message));
          return;
        }
        mergeInserted(data as LineItem);
        notifyDealsChanged();
      } finally {
        end();
      }
    }
    toast.success(`Desfeito: ${describeEntry(entry)}.`);
  }

  /** Grava agora o que estiver pendente (confirma o campo em edição). */
  async function saveNow() {
    if (typeof document !== "undefined") {
      const el = document.activeElement as HTMLElement | null;
      if (el && typeof el.blur === "function") el.blur();
    }
    await new Promise((r) => setTimeout(r, 60));
    await qc.getQueryCache().find({ queryKey: lineItemsQueryKey(dealId) })?.promise;
    if (inflight.current === 0) setStatus("saved");
    toast.success("Itens de linha salvos.");
  }

  const totals = useMemo(() => {
    const subtotal = items.reduce((s, li) => s + lineGross(li), 0);
    const discount = items.reduce((s, li) => s + lineDiscount(li), 0);
    const tax = items.reduce(
      (s, li) => s + lineSubtotalAfterDiscount(li) * (n(li.tax_rate) / 100),
      0,
    );
    const total = items.reduce((s, li) => s + lineTotal(li), 0);
    return { subtotal, discount, tax, total };
  }, [items]);

  return {
    items,
    isLoading,
    totals,
    status,
    canUndo: history.length > 0,
    markDirty,
    addBlank,
    addFromCatalogService,
    update,
    remove: (id: string) => removeRow(id),
    undo,
    saveNow,
  };
}
