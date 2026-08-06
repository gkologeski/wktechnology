// Associa um serviço já existente no catálogo a um contrato.
// Dentro do contrato não se cria serviço novo: o cadastro vive no catálogo.
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/crm";
import {
  listCatalogServiceOptions,
  linkCatalogServiceToContract,
} from "@/lib/services.functions";

type CatalogItem = {
  id: string;
  name: string;
  code: string | null;
  service_type: string;
  unit: string;
  base_price: number;
  currency: string;
  description: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contractId: string;
  defaultCurrency?: string;
  onCreated?: (id: string) => void;
};

const SERVICE_TYPE_LABEL: Record<string, string> = {
  outsourcing: "Outsourcing",
  desenvolvimento: "Desenvolvimento",
  manutencao: "Manutenção",
  consultoria: "Consultoria",
  licenciamento: "Licenciamento",
  outros: "Outros",
};

export function LinkCatalogServiceDialog({
  open,
  onOpenChange,
  contractId,
  defaultCurrency = "BRL",
  onCreated,
}: Props) {
  const listCatalog = useServerFn(listCatalogServiceOptions);
  const link = useServerFn(linkCatalogServiceToContract);

  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [type, setType] = useState<"one_time" | "recurring" | "usage_based" | "milestone">(
    "recurring",
  );
  const [cadence, setCadence] = useState<"monthly" | "quarterly" | "yearly">("monthly");
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number | "">("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [saving, setSaving] = useState(false);

  const {
    data: catalog = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["catalog-service-options"],
    queryFn: () => listCatalog({ data: {} }) as Promise<CatalogItem[]>,
    enabled: open,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (open) {
      setSearch("");
      setSelectedId(null);
      setType("recurring");
      setCadence("monthly");
      setQuantity(1);
      setUnitPrice("");
      setStartsAt("");
      setEndsAt("");
    }
  }, [open]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return catalog;
    return catalog.filter(
      (c) =>
        c.name.toLowerCase().includes(term) || (c.code ?? "").toLowerCase().includes(term),
    );
  }, [catalog, search]);

  const selected = catalog.find((c) => c.id === selectedId) ?? null;

  function pick(item: CatalogItem) {
    setSelectedId(item.id);
    setUnitPrice(Number(item.base_price) || 0);
  }

  async function submit() {
    if (!selectedId) {
      toast.error("Selecione um serviço do catálogo.");
      return;
    }
    setSaving(true);
    try {
      const row = await link({
        data: {
          contractId,
          serviceCatalogId: selectedId,
          type,
          cadence: type === "recurring" ? cadence : null,
          quantity: Number(quantity) || 1,
          unitPrice: typeof unitPrice === "number" ? unitPrice : 0,
          startsAt: startsAt || null,
          endsAt: endsAt || null,
        },
      });
      toast.success("Serviço associado ao contrato.");
      onOpenChange(false);
      onCreated?.((row as { id: string }).id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Associar serviço ao contrato</DialogTitle>
          <DialogDescription>
            Escolha um serviço do catálogo e defina os parâmetros comerciais desta associação. O
            cadastro de serviços é feito no catálogo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="catalog-picker">Serviço do catálogo *</Label>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen} modal>
              <PopoverTrigger asChild>
                <Button
                  id="catalog-picker"
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={pickerOpen}
                  className="w-full justify-between font-normal"
                >
                  {selected ? (
                    <span className="min-w-0 truncate">
                      {selected.name}
                      <span className="ml-2 text-xs text-muted-foreground tabular-nums">
                        {selected.code ? `${selected.code} · ` : ""}
                        {formatCurrency(Number(selected.base_price), selected.currency)} /{" "}
                        {selected.unit}
                      </span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Buscar serviço do catálogo</span>
                  )}
                  <ChevronsUpDown aria-hidden="true" className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-[--radix-popover-trigger-width] p-0"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                {isLoading ? (
                  <p className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                    <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> Carregando
                    catálogo…
                  </p>
                ) : isError ? (
                  <div className="p-3 text-sm">
                    <p className="text-muted-foreground">Não foi possível carregar o catálogo.</p>
                    <Button size="sm" variant="outline" className="mt-2" onClick={() => refetch()}>
                      Tentar novamente
                    </Button>
                  </div>
                ) : (
                  <Command shouldFilter={false}>
                    <CommandInput
                      value={search}
                      onValueChange={setSearch}
                      placeholder="Buscar por nome ou código"
                    />
                    <CommandList>
                      {filtered.length === 0 ? (
                        <div className="p-3 text-sm">
                          <p className="text-muted-foreground">
                            {catalog.length === 0
                              ? "Nenhum serviço ativo no catálogo."
                              : "Nenhum serviço encontrado para esta busca."}
                          </p>
                          <Button asChild size="sm" variant="outline" className="mt-2">
                            <Link to="/catalog/services" onClick={() => onOpenChange(false)}>
                              Abrir catálogo de serviços
                            </Link>
                          </Button>
                        </div>
                      ) : (
                        <CommandGroup>
                          {filtered.map((item) => {
                            const active = item.id === selectedId;
                            return (
                              <CommandItem
                                key={item.id}
                                value={item.id}
                                onSelect={() => pick(item)}
                                className="items-start gap-2"
                              >
                                <Check
                                  aria-hidden="true"
                                  className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${active ? "opacity-100" : "opacity-0"}`}
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="flex items-center gap-2">
                                    <span className="truncate font-medium">{item.name}</span>
                                    <Badge variant="outline" className="shrink-0">
                                      {SERVICE_TYPE_LABEL[item.service_type] ?? item.service_type}
                                    </Badge>
                                  </span>
                                  <span className="mt-0.5 block text-xs text-muted-foreground tabular-nums">
                                    {item.code ? `${item.code} · ` : ""}
                                    {formatCurrency(Number(item.base_price), item.currency)} /{" "}
                                    {item.unit}
                                  </span>
                                </span>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                )}
              </PopoverContent>
            </Popover>
          </div>

          {selected ? (
            <p className="text-xs text-muted-foreground">
              Nome e descrição vêm do catálogo e não são editáveis no contrato.
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="svc-type">Tipo de cobrança</Label>
              <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                <SelectTrigger id="svc-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recurring">Recorrente</SelectItem>
                  <SelectItem value="one_time">Único</SelectItem>
                  <SelectItem value="milestone">Por marco</SelectItem>
                  <SelectItem value="usage_based">Por uso</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {type === "recurring" ? (
              <div className="space-y-2">
                <Label htmlFor="svc-cadence">Cadência</Label>
                <Select value={cadence} onValueChange={(v) => setCadence(v as typeof cadence)}>
                  <SelectTrigger id="svc-cadence">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="quarterly">Trimestral</SelectItem>
                    <SelectItem value="yearly">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="svc-qty">Quantidade</Label>
              <Input
                id="svc-qty"
                type="number"
                min={0}
                step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Preço unitário</Label>
              <CurrencyInput
                value={typeof unitPrice === "number" ? unitPrice : undefined}
                onValueChange={(v) => setUnitPrice(typeof v === "number" ? v : "")}
                currency={defaultCurrency}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="svc-start">Início</Label>
              <Input
                id="svc-start"
                type="date"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="svc-end">Fim</Label>
              <Input
                id="svc-end"
                type="date"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving || !selectedId}>
            {saving ? "Associando…" : "Associar serviço"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
