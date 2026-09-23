// Itens de linha do negócio: resumo, contador e editor completo (autosave por
// campo, botão de salvar e desfazer da última ação).
import { useState } from "react";
import { Plus, Save, Undo2, Wrench, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EntityCombobox } from "@/components/ui/entity-combobox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/crm";
import { formatLineItemIdentity } from "@/lib/line-item-display";
import { Row } from "./line-item-fields";
import { LineItemCard } from "./line-item-card";
import { lineTotal, useLineItems, useLineItemsEditor } from "./use-line-items";

export type { LineItem } from "./use-line-items";
export { lineDiscount, lineSubtotalAfterDiscount, lineTotal } from "./use-line-items";

export function DealLineItems({
  dealId,
  currency,
}: {
  dealId: string;
  ownerId?: string;
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
            <span className="text-sm">{formatLineItemIdentity(li)}</span>
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

const STATUS_TEXT: Record<string, string> = {
  idle: "Alterações salvas automaticamente",
  dirty: "Alterações não salvas",
  saving: "Salvando…",
  saved: "Tudo salvo",
};

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
  const {
    items,
    isLoading,
    totals,
    status,
    canUndo,
    markDirty,
    addBlank,
    addFromCatalogService,
    update,
    remove,
    undo,
    saveNow,
  } = useLineItemsEditor(dealId);
  const [productPickerKey, setProductPickerKey] = useState(0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
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
              if (id) {
                void addFromCatalogService(id).then(() => setProductPickerKey((k) => k + 1));
              }
            }}
            placeholder="Adicionar serviço do catálogo…"
            emptyLabel="Nenhum serviço"
            icon={Wrench}
            clearable={false}
          />
        </div>
        <Button size="sm" variant="outline" onClick={() => void addBlank()}>
          <Plus className="h-4 w-4 mr-1" /> Item em branco
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <span aria-live="polite" className="text-xs text-muted-foreground">
            {STATUS_TEXT[status] ?? STATUS_TEXT.idle}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void undo()}
            disabled={!canUndo}
            aria-label="Desfazer última ação"
          >
            <Undo2 className="h-4 w-4 mr-1" /> Desfazer
          </Button>
          <Button size="sm" onClick={() => void saveNow()} disabled={status === "saving"}>
            <Save className="h-4 w-4 mr-1" /> Salvar
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum item adicionado.</p>
      ) : (
        <div className="space-y-2">
          {items.map((li) => (
            <LineItemCard
              key={li.id}
              item={li}
              currency={currency}
              onDirty={markDirty}
              onUpdate={(patch) => void update(li.id, patch)}
              onRemove={() => void remove(li.id)}
            />
          ))}
        </div>
      )}

      <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
        <Row label="Subtotal" value={formatCurrency(totals.subtotal, currency)} />
        <Row label="Descontos" value={`− ${formatCurrency(totals.discount, currency)}`} />
        <Row label="Impostos" value={`+ ${formatCurrency(totals.tax, currency)}`} />
        <div className="border-t pt-1 mt-1">
          <Row label="Total" value={formatCurrency(totals.total, currency)} bold />
        </div>
      </div>
    </div>
  );
}

export { Pencil };
