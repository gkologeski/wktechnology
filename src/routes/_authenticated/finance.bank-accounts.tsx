import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/crm";
import { createBankAccount, listBankAccounts } from "@/lib/finance.functions";
import {
  ALL_LEGAL_ENTITIES,
  LegalEntitySelect,
  useLegalEntities,
  useLegalEntityFilter,
} from "@/components/finance/legal-entity-select";

export const Route = createFileRoute("/_authenticated/finance/bank-accounts")({
  head: () => ({ meta: [{ title: "Contas bancárias" }] }),
  component: BankAccountsPage,
});

function BankAccountsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listBankAccounts);
  const create = useServerFn(createBankAccount);
  const [legalEntityId, setLegalEntityId] = useLegalEntityFilter();
  const { data: legalEntities = [] } = useLegalEntities();

  const leById = useMemo(() => {
    const m = new Map<string, { code: string | null; name: string }>();
    legalEntities.forEach((le) => m.set(le.id, le));
    return m;
  }, [legalEntities]);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("checking");
  const [initial, setInitial] = useState("0");
  const [formLegalEntity, setFormLegalEntity] = useState<string>("__none__");

  const filterLE = legalEntityId === ALL_LEGAL_ENTITIES ? undefined : legalEntityId;
  const { data: rows = [] } = useQuery({
    queryKey: ["finance-banks", filterLE ?? "all"],
    queryFn: () => list({ data: { legalEntityId: filterLE } }),
  });

  function openCreate() {
    setName("");
    setInitial("0");
    setKind("checking");
    // Pré-seleciona a empresa do filtro ativo, se houver.
    setFormLegalEntity(filterLE ?? "__none__");
    setOpen(true);
  }

  async function submit() {
    if (!name.trim()) return;
    try {
      await create({
        data: {
          name: name.trim(),
          kind,
          currency: "BRL",
          initial_balance: Number(String(initial).replace(",", ".")) || 0,
          legal_entity_id: formLegalEntity === "__none__" ? null : formLegalEntity,
        },
      });
      toast.success("Conta criada");
      qc.invalidateQueries({ queryKey: ["finance-banks"] });
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  }

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Contas bancárias"
        description="Contas e caixas usados para conciliação de pagamentos."
        actions={
          <div className="flex items-center gap-2">
            <LegalEntitySelect value={legalEntityId} onChange={setLegalEntityId} />
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Nova conta
            </Button>
          </div>
        }
      />

      <div className="rounded-lg border bg-card">
        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma conta cadastrada.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Moeda</TableHead>
                <TableHead className="text-right">Saldo inicial</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((b) => {
                const le = b.legal_entity_id ? leById.get(b.legal_entity_id) : null;
                return (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell className="text-sm">
                      {le ? (
                        <Badge variant="outline" className="text-xs">
                          {le.code ?? le.name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{b.kind}</TableCell>
                    <TableCell className="text-sm">{b.currency}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(Number(b.initial_balance), b.currency)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova conta bancária</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            {legalEntities.length > 1 && (
              <div className="space-y-2">
                <Label>Empresa</Label>
                <Select value={formLegalEntity} onValueChange={setFormLegalEntity}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Não vincular —</SelectItem>
                    {legalEntities.map((le) => (
                      <SelectItem key={le.id} value={le.id}>
                        {le.code ? `${le.code} · ${le.name}` : le.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="checking">Conta corrente</SelectItem>
                  <SelectItem value="savings">Poupança</SelectItem>
                  <SelectItem value="cash">Caixa</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Saldo inicial</Label>
              <Input
                inputMode="decimal"
                value={initial}
                onChange={(e) => setInitial(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submit}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
