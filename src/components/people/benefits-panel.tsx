// TechPeople · Sprint 10 — Benefícios, Folha e Custos
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, HeartHandshake, DollarSign, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  listPeopleBenefits,
  upsertPeopleBenefit,
  deletePeopleBenefit,
  getPersonTotalCost,
  BENEFIT_TYPES,
  BENEFIT_TYPE_LABELS,
  type BenefitType,
  type PeopleBenefitRow,
} from "@/lib/people/benefits.functions";

const brl = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });

export function BenefitsPanel({ personId, canWrite }: { personId: string; canWrite: boolean }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listPeopleBenefits);
  const costFn = useServerFn(getPersonTotalCost);
  const delFn = useServerFn(deletePeopleBenefit);

  const [editing, setEditing] = useState<PeopleBenefitRow | null>(null);
  const [open, setOpen] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["people_benefits", personId],
    queryFn: () => listFn({ data: { personId } }),
  });
  const { data: cost } = useQuery({
    queryKey: ["people_total_cost", personId],
    queryFn: () => costFn({ data: { personId } }),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Benefício removido");
      qc.invalidateQueries({ queryKey: ["people_benefits", personId] });
      qc.invalidateQueries({ queryKey: ["people_total_cost", personId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activeRows = rows.filter((r) => r.active);
  const benefitsTotal = activeRows.reduce((sum, r) => sum + Number(r.monthly_value), 0);
  const employeeShareTotal = activeRows.reduce((sum, r) => sum + Number(r.employee_share), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <Wallet className="h-3.5 w-3.5" /> Custo mensal (base)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold truncate">{brl(cost?.monthly_cost)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <HeartHandshake className="h-3.5 w-3.5" /> Benefícios ativos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold truncate">{brl(benefitsTotal)}</div>
            <div className="text-xs text-muted-foreground">
              {activeRows.length} item(ns) · desconto do prestador {brl(employeeShareTotal)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <DollarSign className="h-3.5 w-3.5" /> Custo total mensal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-primary truncate">
              {brl(cost?.total_cost_monthly)}
            </div>
            <div className="text-xs text-muted-foreground">Salário/custo + benefícios ativos</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Benefícios</CardTitle>
            <CardDescription>
              Registre planos, valores e vigência. Somente administradores podem editar.
            </CardDescription>
          </div>
          {canWrite ? (
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> Novo benefício
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              Nenhum benefício cadastrado.
            </div>
          ) : (
            <div className="divide-y">
              {rows.map((r) => (
                <div key={r.id} className="flex items-start justify-between py-3 gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{BENEFIT_TYPE_LABELS[r.benefit_type]}</span>
                      {r.provider ? (
                        <span className="text-sm text-muted-foreground">· {r.provider}</span>
                      ) : null}
                      {r.plan_name ? (
                        <Badge variant="outline" className="text-xs">
                          {r.plan_name}
                        </Badge>
                      ) : null}
                      {!r.active ? (
                        <Badge variant="secondary" className="text-xs">
                          Inativo
                        </Badge>
                      ) : null}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3">
                      <span>Valor: {brl(Number(r.monthly_value))}/mês</span>
                      {Number(r.employee_share) > 0 ? (
                        <span>Desconto prestador: {brl(Number(r.employee_share))}</span>
                      ) : null}
                      {r.starts_on ? <span>Início: {r.starts_on}</span> : null}
                      {r.ends_on ? <span>Fim: {r.ends_on}</span> : null}
                    </div>
                    {r.notes ? (
                      <p className="mt-1 text-xs text-muted-foreground">{r.notes}</p>
                    ) : null}
                  </div>
                  {canWrite ? (
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditing(r);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          if (await confirmDialog("Remover este benefício?")) del.mutate(r.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <BenefitDialog personId={personId} open={open} onClose={() => setOpen(false)} row={editing} />
    </div>
  );
}

function BenefitDialog({
  personId,
  open,
  onClose,
  row,
}: {
  personId: string;
  open: boolean;
  onClose: () => void;
  row: PeopleBenefitRow | null;
}) {
  const qc = useQueryClient();
  const upsert = useServerFn(upsertPeopleBenefit);

  const [benefitType, setBenefitType] = useState<BenefitType>(
    (row?.benefit_type as BenefitType) ?? "health",
  );
  const [provider, setProvider] = useState(row?.provider ?? "");
  const [planName, setPlanName] = useState(row?.plan_name ?? "");
  const [monthlyValue, setMonthlyValue] = useState<string>(row ? String(row.monthly_value) : "0");
  const [employeeShare, setEmployeeShare] = useState<string>(
    row ? String(row.employee_share) : "0",
  );
  const [startsOn, setStartsOn] = useState(row?.starts_on ?? "");
  const [endsOn, setEndsOn] = useState(row?.ends_on ?? "");
  const [active, setActive] = useState<boolean>(row?.active ?? true);
  const [notes, setNotes] = useState(row?.notes ?? "");

  const mut = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          id: row?.id ?? null,
          person_id: personId,
          benefit_type: benefitType,
          provider: provider.trim() || null,
          plan_name: planName.trim() || null,
          monthly_value: Number(monthlyValue) || 0,
          employee_share: Number(employeeShare) || 0,
          starts_on: startsOn || null,
          ends_on: endsOn || null,
          active,
          notes: notes.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success(row ? "Benefício atualizado" : "Benefício adicionado");
      qc.invalidateQueries({ queryKey: ["people_benefits", personId] });
      qc.invalidateQueries({ queryKey: ["people_total_cost", personId] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{row ? "Editar benefício" : "Novo benefício"}</DialogTitle>
          <DialogDescription>
            Registre valor mensal e vigência. Este dado compõe o custo total da pessoa.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={benefitType} onValueChange={(v) => setBenefitType(v as BenefitType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BENEFIT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {BENEFIT_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fornecedor</Label>
              <Input
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="Unimed, Sodexo…"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Plano / descrição</Label>
            <Input
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              placeholder="Enfermaria, Executivo, VR R$ 40/dia…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Valor mensal (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={monthlyValue}
                onChange={(e) => setMonthlyValue(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Desconto do prestador (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={employeeShare}
                onChange={(e) => setEmployeeShare(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Início</Label>
              <Input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fim</Label>
              <Input type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="text-sm">Ativo</Label>
              <p className="text-xs text-muted-foreground">
                Inclui no cálculo do custo mensal total.
              </p>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Dependentes incluídos, cláusulas específicas…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={mut.isPending} onClick={() => mut.mutate()}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
