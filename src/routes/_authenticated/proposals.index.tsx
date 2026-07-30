import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listProposals, createProposal, deleteProposal } from "@/lib/proposals.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ImportContractWizard } from "@/components/import-contract-wizard";
import { AssigneeFilter, useAssigneeFilter } from "@/components/entity/assignee-filter";
import { AssigneeCell } from "@/components/entity/assignee-cell";

export const Route = createFileRoute("/_authenticated/proposals/")({
  component: ProposalsPage,
});

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  in_review: "Em revisão",
  approved: "Aprovada",
  sent: "Enviada",
  accepted: "Aceita",
  rejected: "Recusada",
  expired: "Expirada",
  canceled: "Cancelada",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  in_review: "secondary",
  approved: "secondary",
  sent: "default",
  accepted: "default",
  rejected: "destructive",
  expired: "outline",
  canceled: "outline",
};

function ProposalsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listProposals);
  const create = useServerFn(createProposal);
  const del = useServerFn(deleteProposal);
  const { data } = useQuery({ queryKey: ["proposals"], queryFn: () => list() });
  const { assignee, setAssignee, filterRows } = useAssigneeFilter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");

  const createM = useMutation({
    mutationFn: () => create({ data: { title, totalAmount: amount ? Number(amount) : null } }),
    onSuccess: () => {
      toast.success("Contrato criada");
      setOpen(false);
      setTitle("");
      setAmount("");
      qc.invalidateQueries({ queryKey: ["proposals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Contrato removida");
      qc.invalidateQueries({ queryKey: ["proposals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Contratos</h1>
          <p className="text-sm text-muted-foreground">
            Gere, aprove e envie propostas comerciais com selo de validade.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ImportContractWizard />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novo contrato
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo contrato</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Título</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Contrato Acme — Setembro"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Valor (BRL)</Label>
                  <CurrencyInput
                    currency="BRL"
                    value={amount === "" ? null : Number(amount)}
                    onValueChange={(n) => setAmount(n === null ? "" : String(n))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => createM.mutate()} disabled={!title || createM.isPending}>
                  Criar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Suas propostas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma proposta ainda.</p>
          )}
          {filterRows((data ?? []) as any[]).map((p: any) => (
            <div key={p.id} className="flex items-center justify-between rounded-md border p-3">
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Link
                    to="/proposals/$id"
                    params={{ id: p.id }}
                    className="font-medium hover:underline"
                  >
                    {p.title}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    v{p.version} ·{" "}
                    {p.total_amount
                      ? new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: p.currency,
                        }).format(Number(p.total_amount))
                      : "sem valor"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <AssigneeCell assignedTo={p.assigned_to} className="text-xs" />
                <Badge variant={STATUS_VARIANT[p.status] ?? "outline"}>
                  {STATUS_LABEL[p.status] ?? p.status}
                </Badge>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    if (confirm("Remover proposta?")) delM.mutate(p.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
