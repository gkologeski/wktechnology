// "Contratar fornecedor": cria o contrato de compra (PJ ou PF) aninhado à venda,
// com a proposta aceita da venda como anexo técnico.
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, UserPlus } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SearchCreateField } from "@/components/ui/search-create-field";
import {
  createPurchaseFromSale,
  searchPurchaseCounterparty,
} from "@/lib/contracts/purchase-from-sale.functions";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { usePermissions } from "@/lib/access-control/use-permissions";

export function PurchaseFromSaleButton({
  saleContractId,
  disabled,
}: {
  saleContractId: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const p = usePermissions();
  const canCreate = p.canAny(
    ["own", "workspace"].map((s) => `techcontracts.contracts.create.${s}`),
  );
  if (!canCreate) return null;
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} disabled={disabled}>
        <UserPlus className="mr-1 h-4 w-4" aria-hidden="true" />
        Contratar fornecedor
      </Button>
      {open ? (
        <PurchaseDialog saleContractId={saleContractId} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

export function CounterpartyField(props: {
  id: string;
  label: string;
  entity: "company" | "contact" | "sale" | "sale_any";
  companyId?: string | null;
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const search = useServerFn(searchPurchaseCounterparty);
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const term = useDebouncedValue(text, 300);
  const enabled =
    focused &&
    !props.value &&
    (term.trim().length >= 2 ||
      (props.entity === "contact" && !!props.companyId) ||
      props.entity === "sale" ||
      props.entity === "sale_any");
  const q = useQuery({
    queryKey: ["purchase-counterparty", props.entity, props.companyId ?? null, term],
    enabled,
    retry: false,
    queryFn: () =>
      search({ data: { entity: props.entity, search: term, companyId: props.companyId ?? null } }),
  });
  return (
    <div className="space-y-1.5">
      <Label htmlFor={props.id}>{props.label}</Label>
      <SearchCreateField
        id={props.id}
        label={props.label}
        text={text}
        selectedId={props.value}
        options={q.data ?? []}
        loading={q.isFetching}
        searched={q.isSuccess}
        error={q.isError ? "Não foi possível carregar as opções." : null}
        onTextChange={(t) => {
          setText(t);
          if (props.value) props.onChange(null);
        }}
        onFocus={() => setFocused(true)}
        onPick={(o) => {
          setText(o.label);
          props.onChange(o.id);
        }}
        onClear={() => {
          setText("");
          props.onChange(null);
        }}
        onRetry={() => void q.refetch()}
      />
    </div>
  );
}

export function PurchaseDialog({
  saleContractId: fixedSale,
  onClose,
}: {
  saleContractId?: string;
  onClose: () => void;
}) {
  const [pickedSale, setPickedSale] = useState<string | null>(null);
  const saleContractId = fixedSale ?? pickedSale;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const create = useServerFn(createPurchaseFromSale);
  const [kind, setKind] = useState<"company" | "person">("company");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [contactId, setContactId] = useState<string | null>(null);
  const [extraSale, setExtraSale] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ready = !!saleContractId && (kind === "company" ? !!companyId : !!contactId);

  async function submit() {
    if (!saleContractId) return;
    setBusy(true);
    try {
      const r = await create({
        data: {
          saleContractId,
          counterpartyKind: kind,
          companyId,
          contactId,
          ...(extraSale && extraSale !== saleContractId ? { extraSaleIds: [extraSale] } : {}),
        },
      });
      toast.success("Contrato de compra criado em rascunho.");
      await qc.invalidateQueries({ queryKey: ["contract", saleContractId] });
      await qc.invalidateQueries({ queryKey: ["contracts"] });
      onClose();
      void navigate({ to: "/contracts/$id", params: { id: r.contract.id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {fixedSale ? "Contratar fornecedor para esta venda" : "Contratar fornecedor"}
          </DialogTitle>
          <DialogDescription>
            Cria um contrato de compra em rascunho, ligado{" "}
            {fixedSale ? "a esta venda" : "à venda escolhida"}. A proposta comercial aceita segue
            como anexo técnico.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          {!fixedSale && (
            <CounterpartyField
              id="purchase-sale"
              label="Contrato de venda"
              entity="sale"
              value={pickedSale}
              onChange={setPickedSale}
            />
          )}
          <div className="space-y-1">
            <CounterpartyField
              id="purchase-extra-sale"
              label="Outra venda atendida (opcional)"
              entity="sale_any"
              value={extraSale}
              onChange={setExtraSale}
            />
            <p className="text-xs text-muted-foreground">
              Use quando a mesma compra atende mais de uma venda (por exemplo, um aditivo de horas
              com negócio próprio). Outras vendas podem ser incluídas depois na ficha.
            </p>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Tipo de contraparte</legend>
            <RadioGroup
              value={kind}
              onValueChange={(v) => {
                setKind(v as "company" | "person");
                setCompanyId(null);
                setContactId(null);
              }}
              className="flex gap-4"
            >
              <Label className="flex items-center gap-2 font-normal" htmlFor="cp-company">
                <RadioGroupItem id="cp-company" value="company" /> Empresa (PJ)
              </Label>
              <Label className="flex items-center gap-2 font-normal" htmlFor="cp-person">
                <RadioGroupItem id="cp-person" value="person" /> Pessoa física
              </Label>
            </RadioGroup>
          </fieldset>
          {kind === "company" ? (
            <>
              <CounterpartyField
                key="company"
                id="purchase-company"
                label="Empresa fornecedora"
                entity="company"
                value={companyId}
                onChange={(id) => {
                  setCompanyId(id);
                  setContactId(null);
                }}
              />
              {companyId ? (
                <CounterpartyField
                  key={`contact-${companyId}`}
                  id="purchase-contact"
                  label="Contato que assina (opcional)"
                  entity="contact"
                  companyId={companyId}
                  value={contactId}
                  onChange={setContactId}
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Escolha a empresa para listar os contatos dela.
                </p>
              )}
            </>
          ) : (
            <CounterpartyField
              key="person"
              id="purchase-person"
              label="Profissional (contato)"
              entity="contact"
              value={contactId}
              onChange={setContactId}
            />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={!ready || busy}>
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Criar contrato de compra
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Lista de contratos: contratar fornecedor escolhendo a venda de origem. */
export function NewPurchaseButton() {
  const [open, setOpen] = useState(false);
  const p = usePermissions();
  const canCreate =
    !p.isLoading &&
    !p.isError &&
    p.canAny(["own", "workspace"].map((s) => `techcontracts.contracts.create.${s}`));
  if (!canCreate) return null;
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <UserPlus className="mr-1 h-4 w-4" aria-hidden="true" />
        Contratar fornecedor
      </Button>
      {open ? <PurchaseDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}
