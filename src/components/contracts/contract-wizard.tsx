// Assistente de criação de contrato (mesmo padrão do assistente de cotação):
// Origem -> Tipo -> Dados -> Serviços -> Revisão. Nada é gravado antes de
// "Criar contrato".
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/crm";
import { cn } from "@/lib/utils";
import { createContract } from "@/lib/contracts.functions";
import {
  createContractFromTemplate,
  listContractTemplates,
} from "@/lib/contracts/templates.functions";
import { createContractFromSales, listActiveContractsForSales } from "@/lib/sales-flow.functions";
import { CONTRACT_KIND_LABEL, type ContractKind } from "@/lib/contracts/contract-kinds";
import type { ContractDefaultsMap } from "@/lib/contracts/contract-defaults-shared";
import { ContractKindPicker } from "./contract-form/contract-kind-picker";
import { ContractFieldsForm } from "./contract-form/contract-fields-form";
import { DealServicesPreview } from "./contract-form/deal-services-preview";
import { useContractForm } from "./contract-form/use-contract-form";

const STEPS = ["Origem", "Tipo", "Dados", "Serviços", "Revisão"] as const;

export type ContractWizardSource = {
  dealId?: string | null;
  companyId?: string | null;
  quoteId?: string;
  proposalId?: string;
  /** Pré-seleciona "aditivo deste contrato". */
  mainContractId?: string;
};

type Origin =
  | { type: "blank" }
  | { type: "quote"; id: string; label: string }
  | { type: "proposal"; id: string; label: string }
  | { type: "template"; id: string; label: string };

const key = (o: Origin) => (o.type === "blank" ? "blank" : `${o.type}:${o.id}`);

export function ContractWizard({
  source,
  onOpenChange,
}: {
  source: ContractWizardSource | null;
  onOpenChange: (open: boolean) => void;
}) {
  const open = !!source;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const createBlank = useServerFn(createContract);
  const fromSales = useServerFn(createContractFromSales);
  const fromTemplate = useServerFn(createContractFromTemplate);
  const listActive = useServerFn(listActiveContractsForSales);
  const listTemplates = useServerFn(listContractTemplates);

  const dealId = source?.dealId ?? null;
  const initialKind: ContractKind = source?.mainContractId ? "amendment" : "provider";
  const form = useContractForm({
    open,
    initialKind,
    initialCompanyId: source?.companyId ?? null,
    initialDealId: dealId,
  });

  const [step, setStep] = useState(0);
  const [originKey, setOriginKey] = useState("blank");
  const [choice, setChoice] = useState("new");
  const [templateTitle, setTemplateTitle] = useState("");
  const [copyServices, setCopyServices] = useState(true);
  const [saving, setSaving] = useState(false);

  const originsQ = useQuery({
    queryKey: ["contract-wizard-origins", dealId, source?.quoteId, source?.proposalId],
    enabled: open,
    queryFn: async () => {
      const list: Origin[] = [{ type: "blank" }];
      const quoteIds = new Set<string>();
      const propIds = new Set<string>();
      if (dealId) {
        const [q, p] = await Promise.all([
          supabase.from("quotes").select("id, number, title").eq("deal_id", dealId),
          supabase.from("proposals").select("id, title").eq("deal_id", dealId),
        ]);
        for (const r of p.data ?? []) {
          propIds.add(r.id);
          list.push({ type: "proposal", id: r.id, label: r.title || "Proposta" });
        }
        for (const r of q.data ?? []) {
          quoteIds.add(r.id);
          list.push({ type: "quote", id: r.id, label: `${r.title || "Cotação"} · ${r.number}` });
        }
      }
      if (source?.proposalId && !propIds.has(source.proposalId)) {
        const { data } = await supabase
          .from("proposals")
          .select("id, title")
          .eq("id", source.proposalId)
          .maybeSingle();
        if (data) list.push({ type: "proposal", id: data.id, label: data.title || "Proposta" });
      }
      if (source?.quoteId && !quoteIds.has(source.quoteId)) {
        const { data } = await supabase
          .from("quotes")
          .select("id, number, title")
          .eq("id", source.quoteId)
          .maybeSingle();
        if (data)
          list.push({
            type: "quote",
            id: data.id,
            label: `${data.title || "Cotação"} · ${data.number}`,
          });
      }
      try {
        const tpls = (await listTemplates({ data: { status: "published" } })) as Array<{
          id: string;
          name: string;
        }>;
        for (const t of tpls) list.push({ type: "template", id: t.id, label: t.name });
      } catch {
        /* sem permissão para modelos: segue sem eles */
      }
      return list;
    },
  });
  const origins = useMemo(() => originsQ.data ?? [{ type: "blank" } as Origin], [originsQ.data]);
  const origin = origins.find((o) => key(o) === originKey) ?? origins[0];
  const salesSource =
    origin.type === "quote"
      ? { quoteId: origin.id }
      : origin.type === "proposal"
        ? { proposalId: origin.id }
        : null;

  // Reinicia ao abrir.
  useEffect(() => {
    if (!open) return;
    setStep(0);
    setOriginKey(
      source?.proposalId
        ? `proposal:${source.proposalId}`
        : source?.quoteId
          ? `quote:${source.quoteId}`
          : "blank",
    );
    setChoice(source?.mainContractId ?? "new");
    setCopyServices(true);
  }, [open, source]);

  // Aditivo a partir do painel do contrato: contrato principal pré-preenchido.
  useEffect(() => {
    if (open && source?.mainContractId) form.setValue("parent_contract_id", source.mainContractId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, source?.mainContractId]);

  useEffect(() => {
    if (origin.type === "template") setTemplateTitle(origin.label);
  }, [origin]);

  const activeQ = useQuery({
    queryKey: ["contract-wizard-active", salesSource],
    enabled: open && !!salesSource,
    queryFn: () => listActive({ data: salesSource! }),
  });

  const quoteItemsQ = useQuery({
    queryKey: ["contract-wizard-quote-items", origin.type === "quote" ? origin.id : null],
    enabled: open && origin.type === "quote",
    queryFn: async () => {
      const { data } = await supabase
        .from("quote_line_items")
        .select("id, name, quantity, unit_price")
        .eq("quote_id", (origin as { id: string }).id)
        .order("position");
      return data ?? [];
    },
  });

  const lineItems = form.prefill.data?.lineItems ?? [];
  const servicesDisabled = form.kind !== "provider";
  const blankTitle = String(form.values["title"] ?? "").trim();

  function validate(): string | null {
    if (step === 2 && origin.type === "blank") {
      if (!blankTitle) return "Informe um título.";
      if (form.kind === "amendment" && !form.values["parent_contract_id"])
        return "Selecione o contrato principal do aditivo.";
    }
    if (step === 2 && origin.type === "template" && !templateTitle.trim())
      return "Informe um título.";
    return null;
  }

  function next() {
    const err = validate();
    if (err) return toast.error(err);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  async function submit() {
    setSaving(true);
    try {
      let id: string;
      if (origin.type === "blank") {
        const row = await createBlank({
          data: {
            kind: form.kind,
            fields: { ...form.values, title: blankTitle } as ContractDefaultsMap,
            dealId: (form.values["deal_id"] as string | null) ?? null,
            copyLineItems: copyServices && !servicesDisabled,
            lineItemIds: form.selectedItemIds ?? null,
          },
        });
        id = row.id;
      } else if (origin.type === "template") {
        const row = await fromTemplate({
          data: {
            templateId: origin.id,
            dealId: dealId ?? undefined,
            companyId: source?.companyId ?? undefined,
            title: templateTitle.trim(),
          },
        });
        id = row.id;
      } else {
        const r = await fromSales({
          data: { ...salesSource!, mainContractId: choice === "new" ? null : choice },
        });
        if (r.reused) toast.info("Este documento já gerou um contrato — abrindo o existente.");
        id = r.contract.id;
      }
      toast.success("Contrato criado.");
      void qc.invalidateQueries({ queryKey: ["deal-contracts"] });
      void qc.invalidateQueries({ queryKey: ["contracts"] });
      onOpenChange(false);
      void navigate({ to: "/contracts/$id", params: { id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const activeList = activeQ.data ?? [];
  const chosenActive = activeList.find((c) => c.id === choice);

  return (
    <Dialog open={open} onOpenChange={(v) => (saving ? undefined : onOpenChange(v))}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Novo contrato</DialogTitle>
          <DialogDescription>
            Revise cada passo. O contrato só é criado no último passo.
          </DialogDescription>
        </DialogHeader>

        <ol className="grid grid-cols-5 gap-2" aria-label="Etapas">
          {STEPS.map((label, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <li key={label} aria-current={active ? "step" : undefined}>
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs",
                    active && "border-primary bg-primary/5 text-primary",
                    done && "border-primary/40 text-foreground",
                    !active && !done && "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px]",
                      (active || done) && "border-primary bg-primary text-primary-foreground",
                    )}
                  >
                    {done ? <Check className="h-3 w-3" /> : i + 1}
                  </span>
                  <span className="truncate">{label}</span>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {step === 0 &&
            (originsQ.isLoading ? (
              <div className="space-y-2" aria-busy="true">
                <div className="h-12 animate-pulse rounded-md bg-muted" />
                <div className="h-12 animate-pulse rounded-md bg-muted" />
              </div>
            ) : (
              <RadioGroup value={originKey} onValueChange={setOriginKey} className="space-y-2">
                {originsQ.isError && (
                  <p className="text-xs text-destructive">
                    Não foi possível carregar todas as origens.
                  </p>
                )}
                {origins.map((o) => {
                  const k = key(o);
                  const title =
                    o.type === "blank"
                      ? dealId
                        ? "A partir do negócio (em branco)"
                        : "Em branco"
                      : o.label;
                  const hint =
                    o.type === "blank"
                      ? "Preencha os campos do contrato com os padrões do workspace."
                      : o.type === "quote"
                        ? "Cotação: itens viram serviços do contrato."
                        : o.type === "proposal"
                          ? "Proposta: guarda a proposta e a cotação de origem."
                          : "Modelo de contrato com as variáveis preenchidas.";
                  return (
                    <Label
                      key={k}
                      htmlFor={`cw-${k}`}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:bg-muted/40"
                    >
                      <RadioGroupItem id={`cw-${k}`} value={k} className="mt-0.5" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{title}</span>
                        <span className="block text-xs text-muted-foreground">{hint}</span>
                      </span>
                    </Label>
                  );
                })}
              </RadioGroup>
            ))}

          {step === 1 &&
            (origin.type === "blank" ? (
              <ContractKindPicker value={form.kind} onChange={form.setKind} />
            ) : origin.type === "template" ? (
              <p className="text-sm text-muted-foreground">
                O tipo (prestação ou compra) vem do modelo escolhido.
              </p>
            ) : activeQ.isLoading ? (
              <div className="h-12 animate-pulse rounded-md bg-muted" aria-busy="true" />
            ) : (
              <RadioGroup value={choice} onValueChange={setChoice} className="space-y-2">
                <Label
                  htmlFor="cw-new"
                  className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:bg-muted/40"
                >
                  <RadioGroupItem id="cw-new" value="new" className="mt-0.5" />
                  <span>
                    <span className="block text-sm font-medium">Novo contrato independente</span>
                    <span className="block text-xs text-muted-foreground">
                      Usa o modelo vinculado ao serviço do catálogo, se houver.
                    </span>
                  </span>
                </Label>
                {activeList.map((c) => (
                  <Label
                    key={c.id}
                    htmlFor={`cw-a-${c.id}`}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:bg-muted/40"
                  >
                    <RadioGroupItem id={`cw-a-${c.id}`} value={c.id} className="mt-0.5" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        Termo aditivo de: {c.title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground tabular-nums">
                        {c.number ?? "—"} ·{" "}
                        {formatCurrency(Number(c.total_value ?? 0), c.currency ?? "BRL")}
                      </span>
                    </span>
                  </Label>
                ))}
                {activeList.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    A empresa não tem contrato ativo, então não há aditivo para escolher.
                  </p>
                )}
              </RadioGroup>
            ))}

          {step === 2 &&
            (origin.type === "blank" ? (
              <ContractFieldsForm
                fields={form.fields}
                values={form.values}
                onChange={form.setValue}
                hints={form.hints}
              />
            ) : origin.type === "template" ? (
              <div className="space-y-1.5">
                <Label htmlFor="cw-title">Título do contrato *</Label>
                <Input
                  id="cw-title"
                  value={templateTitle}
                  onChange={(e) => setTemplateTitle(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Empresa, valores e vigência vêm do negócio e do modelo.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Empresa, contato, valores e vigência vêm da{" "}
                {origin.type === "quote" ? "cotação" : "proposta"}. Você pode ajustar tudo na ficha
                do contrato depois de criar.
              </p>
            ))}

          {step === 3 &&
            (origin.type === "blank" ? (
              form.values["deal_id"] ? (
                <div className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="cw-copy" className="text-sm font-medium">
                      Copiar serviços do negócio para o contrato
                    </Label>
                    <Switch
                      id="cw-copy"
                      checked={copyServices && !servicesDisabled}
                      disabled={servicesDisabled}
                      onCheckedChange={setCopyServices}
                    />
                  </div>
                  {form.prefill.isLoading ? (
                    <div className="h-16 animate-pulse rounded-md bg-muted" />
                  ) : (
                    <DealServicesPreview
                      items={lineItems}
                      selectedIds={form.selectedItemIds ?? []}
                      disabled={servicesDisabled || !copyServices}
                      currency={(form.values["currency"] as string) ?? "BRL"}
                      onToggle={(id, checked) =>
                        form.setSelectedItemIds((cur) => {
                          const base = cur ?? [];
                          return checked
                            ? [...new Set([...base, id])]
                            : base.filter((x) => x !== id);
                        })
                      }
                    />
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Sem negócio vinculado: adicione os serviços na ficha do contrato.
                </p>
              )
            ) : origin.type === "quote" ? (
              quoteItemsQ.isLoading ? (
                <div className="h-16 animate-pulse rounded-md bg-muted" />
              ) : (quoteItemsQ.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">A cotação não tem itens.</p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {(quoteItemsQ.data ?? []).map((it) => (
                    <li key={it.id} className="p-2 text-sm">
                      {it.name ?? "Item"}{" "}
                      <span className="text-xs text-muted-foreground tabular-nums">
                        · {Number(it.quantity ?? 1)} × {formatCurrency(Number(it.unit_price ?? 0))}
                      </span>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <p className="text-sm text-muted-foreground">
                {origin.type === "proposal"
                  ? "Os serviços vêm dos itens da cotação de origem da proposta."
                  : "Os serviços vêm do modelo escolhido."}
              </p>
            ))}

          {step === 4 && (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Origem</dt>
                <dd className="font-medium">
                  {origin.type === "blank" ? "Em branco" : origin.label}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Tipo</dt>
                <dd>
                  {origin.type === "blank"
                    ? CONTRACT_KIND_LABEL[form.kind]
                    : origin.type === "template"
                      ? "Definido pelo modelo"
                      : chosenActive
                        ? `Termo aditivo de ${chosenActive.title}`
                        : "Novo contrato independente"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Título</dt>
                <dd>
                  {origin.type === "blank"
                    ? blankTitle || "—"
                    : origin.type === "template"
                      ? templateTitle
                      : "Gerado a partir da origem"}
                </dd>
              </div>
              {origin.type === "blank" && (
                <div>
                  <dt className="text-xs text-muted-foreground">Serviços</dt>
                  <dd>
                    {copyServices && !servicesDisabled
                      ? `${(form.selectedItemIds ?? []).length} selecionado(s)`
                      : "Não copiar"}
                  </dd>
                </div>
              )}
            </dl>
          )}
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={saving}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
          </div>
          {step < STEPS.length - 1 ? (
            <Button onClick={next} disabled={originsQ.isLoading}>
              Avançar <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={() => void submit()} disabled={saving}>
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Criar contrato
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
