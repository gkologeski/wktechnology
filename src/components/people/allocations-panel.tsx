// TechPeople · Sprint 4 — Alocações & VMS
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Briefcase } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  listAllocationsByPerson,
  upsertAllocation,
  deleteAllocation,
  computeMonthlyMargin,
  ALLOCATION_STATUSES,
  ALLOCATION_STATUS_LABELS,
  type AllocationRow,
  type AllocationStatus,
} from "@/lib/people/allocations.functions";
import { listContracts } from "@/lib/contracts.functions";
import { listProjects } from "@/lib/projects.functions";
import { listPeople } from "@/lib/people/people.functions";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const statusTone: Record<AllocationStatus, string> = {
  active: "bg-emerald-500/10 text-emerald-700",
  paused: "bg-amber-500/10 text-amber-700",
  ended: "bg-muted text-muted-foreground",
};

export function AllocationsPanel({
  personId,
  canWrite,
  canViewSensitive,
}: {
  personId: string;
  canWrite: boolean;
  canViewSensitive: boolean;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listAllocationsByPerson);
  const delFn = useServerFn(deleteAllocation);

  const { data: rows = [] } = useQuery({
    queryKey: ["person-allocations", personId],
    queryFn: () => listFn({ data: { person_id: personId } }),
    staleTime: 15_000,
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AllocationRow | null>(null);

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["person-allocations", personId] });
      toast.success("Alocação removida");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totals = rows.reduce(
    (acc, r) => {
      if (r.status !== "active") return acc;
      const m = computeMonthlyMargin(r);
      acc.revenue += m.revenue;
      acc.cost += m.cost;
      acc.margin += m.margin;
      return acc;
    },
    { revenue: 0, cost: 0, margin: 0 },
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Alocações</h3>
          <p className="text-xs text-muted-foreground">
            Contratos e projetos em que a pessoa está alocada.
          </p>
        </div>
        {canWrite ? (
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" /> Nova alocação
          </Button>
        ) : null}
      </div>

      {canViewSensitive && rows.length > 0 ? (
        <div className="grid grid-cols-3 gap-3">
          <MetricCard label="Receita mensal" value={brl(totals.revenue)} />
          <MetricCard label="Custo mensal" value={brl(totals.cost)} />
          <MetricCard
            label="Margem"
            value={brl(totals.margin)}
            tone={totals.margin >= 0 ? "emerald" : "rose"}
          />
        </div>
      ) : null}

      {rows.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            <Briefcase className="h-6 w-6 mx-auto mb-2 opacity-60" />
            Nenhuma alocação registrada.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const m = canViewSensitive ? computeMonthlyMargin(r) : null;
            return (
              <Card key={r.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-medium text-sm">
                          {r.role_title ?? "Alocação"}
                        </div>
                        <Badge className={statusTone[r.status]} variant="secondary">
                          {ALLOCATION_STATUS_LABELS[r.status]}
                        </Badge>
                        <Badge variant="outline">{r.allocation_pct}%</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {r.contract_title
                          ? `Contrato: ${r.contract_number ? `${r.contract_number} · ` : ""}${r.contract_title}`
                          : r.project_name
                            ? `Projeto: ${r.project_name}`
                            : "Sem vínculo"}
                      </div>
                      {r.manager_name ? (
                        <div className="text-xs text-muted-foreground mt-1">
                          Gestor: {r.manager_name}
                        </div>
                      ) : null}
                      <div className="text-xs text-muted-foreground mt-1">
                        {r.starts_at} → {r.ends_at ?? "aberta"}
                      </div>
                      {canViewSensitive && m ? (
                        <div className="text-xs mt-2 flex gap-3 flex-wrap">
                          <span>Rec: {brl(m.revenue)}</span>
                          <span>Custo: {brl(m.cost)}</span>
                          <span
                            className={
                              m.margin >= 0 ? "text-emerald-700" : "text-rose-700"
                            }
                          >
                            Margem: {brl(m.margin)} ({m.marginPct.toFixed(1)}%)
                          </span>
                        </div>
                      ) : null}
                      {r.notes ? (
                        <div className="text-xs text-muted-foreground mt-2">
                          {r.notes}
                        </div>
                      ) : null}
                    </div>
                    {canWrite ? (
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditing(r);
                            setOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (confirm("Remover esta alocação?"))
                              delMut.mutate(r.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AllocationDialog
        open={open}
        onOpenChange={setOpen}
        personId={personId}
        editing={editing}
        canViewSensitive={canViewSensitive}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["person-allocations", personId] });
          setOpen(false);
        }}
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "emerald" | "rose";
}) {
  const t = tone === "emerald" ? "text-emerald-700" : tone === "rose" ? "text-rose-700" : "";
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-lg font-semibold ${t}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function AllocationDialog({
  open,
  onOpenChange,
  personId,
  editing,
  canViewSensitive,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  personId: string;
  editing: AllocationRow | null;
  canViewSensitive: boolean;
  onSaved: () => void;
}) {
  const upsertFn = useServerFn(upsertAllocation);
  const [contractId, setContractId] = useState<string | null>(editing?.contract_id ?? null);
  const [projectId, setProjectId] = useState<string | null>(editing?.project_id ?? null);
  const [roleTitle, setRoleTitle] = useState(editing?.role_title ?? "");
  const [pct, setPct] = useState<string>(editing?.allocation_pct?.toString() ?? "100");
  const [billable, setBillable] = useState<string>(
    editing?.billable_rate != null ? String(editing.billable_rate) : "",
  );
  const [cost, setCost] = useState<string>(
    editing?.cost_rate != null ? String(editing.cost_rate) : "",
  );
  const [startsAt, setStartsAt] = useState<string>(
    editing?.starts_at ?? new Date().toISOString().slice(0, 10),
  );
  const [endsAt, setEndsAt] = useState<string>(editing?.ends_at ?? "");
  const [status, setStatus] = useState<AllocationStatus>(editing?.status ?? "active");
  const [notes, setNotes] = useState<string>(editing?.notes ?? "");

  const mut = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          id: editing?.id ?? null,
          person_id: personId,
          contract_id: contractId,
          project_id: projectId,
          role_title: roleTitle || null,
          allocation_pct: Number(pct) || 0,
          billable_rate: billable ? Number(billable) : null,
          cost_rate: cost ? Number(cost) : null,
          currency: "BRL",
          starts_at: startsAt,
          ends_at: endsAt || null,
          status,
          notes: notes || null,
        },
      }),
    onSuccess: () => {
      toast.success(editing ? "Alocação atualizada" : "Alocação criada");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar alocação" : "Nova alocação"}</DialogTitle>
          <DialogDescription>
            Vincule a pessoa a um contrato ou projeto e defina o período e taxas.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>Contrato</Label>
            <ContractSelect value={contractId} onChange={setContractId} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Projeto (opcional)</Label>
            <ProjectSelect value={projectId} onChange={setProjectId} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Cargo/Função na alocação</Label>
            <Input
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              placeholder="Ex.: Desenvolvedor Sênior"
            />
          </div>
          <div className="space-y-2">
            <Label>Alocação (%)</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={pct}
              onChange={(e) => setPct(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as AllocationStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALLOCATION_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {ALLOCATION_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Início</Label>
            <Input
              type="date"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Fim (opcional)</Label>
            <Input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </div>
          {canViewSensitive ? (
            <>
              <div className="space-y-2">
                <Label>Taxa faturada (R$/h)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={billable}
                  onChange={(e) => setBillable(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Custo (R$/h)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                />
              </div>
            </>
          ) : null}
          <div className="space-y-2 md:col-span-2">
            <Label>Observações</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
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

function ContractSelect({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const listFn = useServerFn(listContracts);
  const { data: rows = [] } = useQuery({
    queryKey: ["allocations-contracts"],
    queryFn: () => listFn({ data: {} }),
    staleTime: 60_000,
  });
  return (
    <Select
      value={value ?? "__none"}
      onValueChange={(v) => onChange(v === "__none" ? null : v)}
    >
      <SelectTrigger>
        <SelectValue placeholder="Selecionar contrato…" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none">Sem contrato</SelectItem>
        {(rows as Array<{ id: string; number: string | null; title: string }>).map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.number ? `${c.number} · ` : ""}{c.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ProjectSelect({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const listFn = useServerFn(listProjects);
  const { data: rows = [] } = useQuery({
    queryKey: ["allocations-projects"],
    queryFn: () => listFn({ data: {} }),
    staleTime: 60_000,
  });
  return (
    <Select
      value={value ?? "__none"}
      onValueChange={(v) => onChange(v === "__none" ? null : v)}
    >
      <SelectTrigger>
        <SelectValue placeholder="Selecionar projeto…" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none">Sem projeto</SelectItem>
        {(rows as Array<{ id: string; name: string }>).map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
