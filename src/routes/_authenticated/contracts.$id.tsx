import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, FileText, Trash2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getContract,
  updateContract,
  deleteContract,
} from "@/lib/contracts.functions";
import { ContractServices } from "@/components/services/contract-services";
import { ContractApprovalsPanel } from "@/components/contracts/contract-approvals-panel";
import { ContractParentLink } from "@/components/contracts/contract-parent-link";
import { formatCurrency, formatDateTime } from "@/lib/crm";


export const Route = createFileRoute("/_authenticated/contracts/$id")({
  head: () => ({ meta: [{ title: "Contrato" }] }),
  component: ContractDetail,
});

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  in_review: "Em revisão",
  in_negotiation: "Em negociação",
  awaiting_signature: "Aguardando assinatura",
  active: "Ativo",
  renewing: "Renovando",
  ended: "Encerrado",
  terminated: "Rescindido",
};

const STATUS_TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  in_review: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  in_negotiation: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  awaiting_signature: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  renewing: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400",
  ended: "bg-muted text-muted-foreground",
  terminated: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
};

type Status = keyof typeof STATUS_LABEL;

function ContractDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const get = useServerFn(getContract);
  const upd = useServerFn(updateContract);
  const del = useServerFn(deleteContract);

  const { data: contract, isLoading } = useQuery({
    queryKey: ["contract", id],
    queryFn: () => get({ data: { id } }),
  });

  const [title, setTitle] = useState("");
  const [role, setRole] = useState<"provider" | "client">("provider");
  const [status, setStatus] = useState<Status>("draft");
  const [totalValue, setTotalValue] = useState<number>(0);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [autoRenew, setAutoRenew] = useState(false);
  const [noticeDays, setNoticeDays] = useState<number>(30);
  const [bodyHtml, setBodyHtml] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!contract) return;
    setTitle(contract.title ?? "");
    setRole((contract.role as "provider" | "client") ?? "provider");
    setStatus((contract.status as Status) ?? "draft");
    setTotalValue(Number(contract.total_value ?? 0));
    setStartsAt(contract.starts_at ? contract.starts_at.slice(0, 10) : "");
    setEndsAt(contract.ends_at ? contract.ends_at.slice(0, 10) : "");
    setAutoRenew(Boolean(contract.auto_renew));
    setNoticeDays(Number(contract.notice_days ?? 30));
    setBodyHtml(contract.body_html ?? "");
  }, [contract]);

  async function save() {
    setSaving(true);
    try {
      await upd({
        data: {
          id,
          patch: {
            title: title.trim(),
            role,
            status,
            total_value: totalValue,
            starts_at: startsAt || null,
            ends_at: endsAt || null,
            auto_renew: autoRenew,
            notice_days: noticeDays,
            body_html: bodyHtml || null,
          },
        },
      });
      toast.success("Contrato atualizado.");
      qc.invalidateQueries({ queryKey: ["contract", id] });
      qc.invalidateQueries({ queryKey: ["contracts"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm("Excluir este contrato?")) return;
    try {
      await del({ data: { id } });
      toast.success("Contrato excluído.");
      navigate({ to: "/contracts" });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (isLoading) {
    return <p className="p-6 text-sm text-muted-foreground">Carregando…</p>;
  }
  if (!contract) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Contrato não encontrado.</p>
        <Button variant="outline" asChild className="mt-4">
          <Link to="/contracts">Voltar</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <div className="bg-card rounded-2xl shadow-sm border border-border/60 p-6 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-5 min-w-0">
            <Button variant="ghost" size="icon" asChild className="rounded-full">
              <Link to="/contracts">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="w-14 h-14 shrink-0 rounded-full bg-gradient-to-tr from-primary to-purple-500 flex items-center justify-center text-white shadow-lg shadow-primary/20 border-4 border-card">
              <FileText className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-foreground truncate">{contract.title}</h1>
                <Badge variant="outline" className={STATUS_TONE[status] ?? ""}>
                  {STATUS_LABEL[status] ?? status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5 font-mono">
                {contract.number} · {formatCurrency(Number(contract.total_value), contract.currency)}
                {contract.starts_at && (
                  <span> · Início {formatDateTime(contract.starts_at).split(" ")[0]}</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={save} disabled={saving}>
              <Save className="h-4 w-4 mr-1" /> {saving ? "Salvando…" : "Salvar"}
            </Button>
            <Button variant="ghost" size="icon" onClick={remove} aria-label="Excluir">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Dados principais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={role} onValueChange={(v) => setRole(v as "provider" | "client")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="provider">Prestação</SelectItem>
                    <SelectItem value="client">Compra</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABEL).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Valor total</Label>
              <CurrencyInput
                value={totalValue}
                onValueChange={(v) => setTotalValue(typeof v === "number" ? v : 0)}
                currency={contract.currency ?? "BRL"}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Vigência</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Início</Label>
                <Input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Fim</Label>
                <Input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Renovação automática</Label>
                <Select
                  value={autoRenew ? "yes" : "no"}
                  onValueChange={(v) => setAutoRenew(v === "yes")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">Não</SelectItem>
                    <SelectItem value="yes">Sim</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Aviso prévio (dias)</Label>
                <Input
                  type="number"
                  min={0}
                  value={noticeDays}
                  onChange={(e) => setNoticeDays(Number(e.target.value) || 0)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Serviços</CardTitle>
        </CardHeader>
        <CardContent>
          <ContractServices contractId={contract.id} currency={contract.currency ?? "BRL"} />
        </CardContent>
      </Card>

      <ContractParentLink
        contractId={contract.id}
        role={role}
        currency={contract.currency ?? "BRL"}
        totalValue={Number(contract.total_value ?? 0)}
        parent={(contract as { parent?: Parameters<typeof ContractParentLink>[0]["parent"] }).parent ?? null}
        children={(contract as { children?: Parameters<typeof ContractParentLink>[0]["children"] }).children ?? []}
      />

      <ContractApprovalsPanel contractId={contract.id} />

      <ImportedFieldsCard contract={contract} />




      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cláusulas / corpo do contrato</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
            placeholder="Cole aqui o texto do contrato ou HTML. Um editor rico será adicionado numa próxima sprint."
            rows={10}
          />
        </CardContent>
      </Card>


      {contract.deal_id && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Origem</CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              to="/deals/$id"
              params={{ id: contract.deal_id }}
              className="text-primary hover:underline text-sm"
            >
              Ver negócio de origem →
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
