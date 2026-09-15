// Novo contrato: escolha do tipo de documento + formulário completo, já com os
// padrões do workspace e os dados/serviços do negócio pré-carregados.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { createContract } from "@/lib/contracts.functions";
import type { ContractKind } from "@/lib/contracts/contract-kinds";
import type { ContractDefaultsMap } from "@/lib/contracts/contract-defaults-shared";
import { ContractKindPicker } from "./contract-form/contract-kind-picker";
import { ContractFieldsForm } from "./contract-form/contract-fields-form";
import { DealServicesPreview } from "./contract-form/deal-services-preview";
import { useContractForm } from "./contract-form/use-contract-form";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (id: string) => void;
  initialCompanyId?: string | null;
  initialDealId?: string | null;
  initialRole?: "provider" | "client";
};

export function QuickCreateContractDialog({
  open,
  onOpenChange,
  onCreated,
  initialCompanyId,
  initialDealId,
  initialRole = "provider",
}: Props) {
  const create = useServerFn(createContract);
  const [saving, setSaving] = useState(false);
  const [copyServices, setCopyServices] = useState(true);

  const form = useContractForm({
    open,
    initialKind: initialRole as ContractKind,
    initialCompanyId,
    initialDealId,
  });

  const dealId = (form.values["deal_id"] as string | null) ?? null;
  const lineItems = form.prefill.data?.lineItems ?? [];
  const servicesDisabled = form.kind !== "provider";

  async function submit() {
    const title = String(form.values["title"] ?? "").trim();
    if (!title) {
      toast.error("Informe um título.");
      return;
    }
    if (form.kind === "amendment" && !form.values["parent_contract_id"]) {
      toast.error("Selecione o contrato principal do aditivo.");
      return;
    }
    setSaving(true);
    try {
      const row = await create({
        data: {
          kind: form.kind,
          fields: { ...form.values, title } as ContractDefaultsMap,
          dealId,
          copyLineItems: copyServices && !servicesDisabled,
          lineItemIds: form.selectedItemIds ?? null,
        },
      });
      toast.success("Contrato criado.");
      onOpenChange(false);
      onCreated?.(row.id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Novo contrato</DialogTitle>
          <DialogDescription>
            Escolha o tipo de contrato. Os campos já vêm com os padrões do workspace e, quando há
            negócio vinculado, com os dados e serviços contratados.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <ContractKindPicker value={form.kind} onChange={form.setKind} />

          {form.prefill.isLoading && dealId && (
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-20 w-full" />
            </div>
          )}
          {form.prefill.isError && (
            <p className="text-xs text-destructive">
              Não foi possível carregar os dados do negócio. Verifique a seleção do negócio e tente
              novamente.
            </p>
          )}

          <ContractFieldsForm
            fields={form.fields}
            values={form.values}
            onChange={form.setValue}
            hints={form.hints}
          />

          {dealId && (
            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="copy-services" className="text-sm font-medium">
                  Copiar serviços do negócio para o contrato
                </Label>
                <Switch
                  id="copy-services"
                  checked={copyServices && !servicesDisabled}
                  disabled={servicesDisabled}
                  onCheckedChange={setCopyServices}
                />
              </div>
              <DealServicesPreview
                items={lineItems}
                selectedIds={form.selectedItemIds ?? []}
                disabled={servicesDisabled || !copyServices}
                currency={(form.values["currency"] as string) ?? "BRL"}
                onToggle={(id, checked) =>
                  form.setSelectedItemIds((cur) => {
                    const base = cur ?? [];
                    return checked ? [...new Set([...base, id])] : base.filter((x) => x !== id);
                  })
                }
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Criando…" : "Criar contrato"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
