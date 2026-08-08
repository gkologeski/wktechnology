// Painel de vínculo de outsourcing entre contratos.
// - Contrato provider (venda): lista contratos filhos (compra) + margem.
// - Contrato client (compra): mostra contrato pai (venda) e permite alterar/remover.
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link2, Search, Unlink, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { listLinkableContracts, linkContractParent } from "@/lib/contracts.functions";
import { formatCurrency } from "@/lib/crm";
import { confirmDialog } from "@/components/ui/confirm-dialog";

type Role = "provider" | "client";

type ChildRow = {
  id: string;
  number: string | null;
  title: string;
  status: string;
  total_value: number;
  currency: string;
  role: Role;
  counterparty_company_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  companies?: { name: string | null } | null;
};

type ParentRow = {
  id: string;
  number: string | null;
  title: string;
  status: string;
  total_value: number;
  currency: string;
  role: Role;
};

interface Props {
  contractId: string;
  role: Role;
  currency: string;
  totalValue: number;
  parent: ParentRow | null;
  children: ChildRow[];
  canEdit?: boolean;
}

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

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}

function formatPeriod(row: { starts_at: string | null; ends_at: string | null }) {
  if (!row.starts_at && !row.ends_at) return "vigência não informada";
  return `${formatDate(row.starts_at)} → ${formatDate(row.ends_at)}`;
}

function useLinkMutations(contractId: string) {
  const qc = useQueryClient();
  const link = useServerFn(linkContractParent);
  async function setParent(parentId: string | null) {
    await link({ data: { childId: contractId, parentId } });
    await qc.invalidateQueries({ queryKey: ["contract", contractId] });
    await qc.invalidateQueries({ queryKey: ["contracts"] });
  }
  return { setParent };
}

export function ContractParentLink({
  contractId,
  role,
  currency,
  totalValue,
  parent,
  children,
  canEdit = true,
}: Props) {
  return role === "provider" ? (
    <ProviderView
      contractId={contractId}
      currency={currency}
      totalValue={totalValue}
      canEdit={canEdit}
      children={children}
    />
  ) : (
    <ClientView contractId={contractId} parent={parent} canEdit={canEdit} />
  );
}

// ---------- PROVIDER (venda): lista de filhos + margem ----------

function ProviderView({
  contractId,
  currency,
  totalValue,
  children,
  canEdit,
}: {
  contractId: string;
  currency: string;
  totalValue: number;
  children: ChildRow[];
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ordered = useMemo(
    () =>
      [...children].sort((a, b) => (a.starts_at ?? "").localeCompare(b.starts_at ?? "")),
    [children],
  );
  const totalCost = useMemo(
    () => children.reduce((acc, c) => acc + Number(c.total_value ?? 0), 0),
    [children],
  );
  const margin = totalValue - totalCost;
  const marginPct = totalValue > 0 ? (margin / totalValue) * 100 : 0;
  const negative = margin < 0;

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Contratos de compra aninhados
            {children.length > 0 ? (
              <Badge variant="secondary">
                {children.length} {children.length === 1 ? "aninhado" : "aninhados"}
              </Badge>
            ) : null}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Contratos de compra (fornecedores/desenvolvedores) que executam este contrato de
            prestação. Quando aninhados, aparecem indentados sob este contrato na listagem.
          </p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)} disabled={!canEdit}>
          Aninhar contrato de compra
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Margem */}
        <div className="grid grid-cols-3 gap-3">
          <MetricTile label="Valor da venda" value={formatCurrency(totalValue, currency)} />
          <MetricTile label="Custo (compras)" value={formatCurrency(totalCost, currency)} />
          <MetricTile
            label="Margem"
            value={formatCurrency(margin, currency)}
            hint={`${marginPct.toFixed(1)}%`}
            tone={negative ? "danger" : margin > 0 ? "success" : "muted"}
          />
        </div>

        {/* Lista de filhos */}
        {children.length === 0 ? (
          <div className="text-sm text-muted-foreground border border-dashed rounded-lg py-6 text-center">
            Nenhum contrato de compra aninhado ainda. Use “Aninhar contrato de compra” para
            agrupá-los sob este contrato.
          </div>
        ) : (
          <div className="border rounded-lg divide-y">
            {ordered.map((c) => (
              <ChildRowItem key={c.id} row={c} canEdit={canEdit} />
            ))}
          </div>
        )}
      </CardContent>

      <LinkPickerDialog
        open={open}
        onOpenChange={setOpen}
        contractId={contractId}
        mode="provider-adds-child"
      />
    </Card>
  );
}

function MetricTile({
  label,
  value,
  hint,
  tone = "muted",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "muted" | "success" | "danger";
}) {
  const toneCls =
    tone === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "danger"
        ? "text-rose-600 dark:text-rose-400"
        : "text-foreground";
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${toneCls}`}>{value}</div>
      {hint && <div className={`text-xs ${toneCls}`}>{hint}</div>}
    </div>
  );
}

function ChildRowItem({ row, canEdit }: { row: ChildRow; canEdit: boolean }) {
  const qc = useQueryClient();
  const link = useServerFn(linkContractParent);
  async function unlink() {
    if (!(await confirmDialog("Desaninhar este contrato de compra do contrato de prestação?")))
      return;
    try {
      await link({ data: { childId: row.id, parentId: null } });
      toast.success("Contrato desaninhado.");
      qc.invalidateQueries();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <Link
          to="/contracts/$id"
          params={{ id: row.id }}
          className="text-sm font-medium text-foreground hover:underline truncate block"
        >
          {row.title}
        </Link>
        <div className="text-xs text-muted-foreground font-mono truncate">
          {row.number ?? "—"} · {STATUS_LABEL[row.status] ?? row.status} · {formatPeriod(row)}
        </div>
        {row.companies?.name ? (
          <div className="text-xs text-muted-foreground truncate">{row.companies.name}</div>
        ) : null}
      </div>
      <Badge variant="outline">Aninhado</Badge>
      <div className="text-sm tabular-nums whitespace-nowrap">
        {formatCurrency(Number(row.total_value ?? 0), row.currency)}
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={unlink}
        disabled={!canEdit}
        title={canEdit ? "Desaninhar" : "Você não tem permissão para alterar este vínculo"}
        aria-label="Desaninhar contrato de compra"
      >
        <Unlink className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ---------- CLIENT (compra): mostra pai e permite alterar ----------

function ClientView({
  contractId,
  parent,
  canEdit,
}: {
  contractId: string;
  parent: ParentRow | null;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { setParent } = useLinkMutations(contractId);

  async function remove() {
    if (!(await confirmDialog("Remover o vínculo com o contrato de venda?"))) return;
    try {
      await setParent(null);
      toast.success("Vínculo removido.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Outsourcing — contrato de venda vinculado
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Este contrato de compra executa parte de um contrato de prestação (venda) para o cliente
            final.
          </p>
        </div>
        <Button
          size="sm"
          variant={parent ? "outline" : "default"}
          onClick={() => setOpen(true)}
          disabled={!canEdit}
        >
          {parent ? "Alterar contrato principal" : "Aninhar sob contrato de venda"}
        </Button>
      </CardHeader>
      <CardContent>
        {parent ? (
          <div className="flex items-center justify-between gap-3 border rounded-lg px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <Link
                to="/contracts/$id"
                params={{ id: parent.id }}
                className="text-sm font-medium text-foreground hover:underline truncate block"
              >
                {parent.title}
              </Link>
              <div className="text-xs text-muted-foreground font-mono truncate">
                {parent.number ?? "—"} · {STATUS_LABEL[parent.status] ?? parent.status} ·{" "}
                {formatCurrency(Number(parent.total_value ?? 0), parent.currency)}
              </div>
            </div>
            <Badge variant="outline">Prestação</Badge>
            <Button
              variant="ghost"
              size="icon"
              onClick={remove}
              disabled={!canEdit}
              title={canEdit ? "Desaninhar" : "Você não tem permissão para alterar este vínculo"}
              aria-label="Desaninhar contrato"
            >
              <Unlink className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground border border-dashed rounded-lg py-6 text-center">
            Não aninhado sob nenhum contrato de venda.
          </div>
        )}
      </CardContent>

      <LinkPickerDialog
        open={open}
        onOpenChange={setOpen}
        contractId={contractId}
        mode="client-picks-parent"
      />
    </Card>
  );
}

// ---------- Dialog de seleção ----------

function LinkPickerDialog({
  open,
  onOpenChange,
  contractId,
  mode,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contractId: string;
  mode: "provider-adds-child" | "client-picks-parent";
}) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const search = useServerFn(listLinkableContracts);
  const link = useServerFn(linkContractParent);

  // provider procurando filhos: role client, excludeId = self
  // client procurando pai: role provider, excludeId = self
  const targetRole: Role = mode === "provider-adds-child" ? "client" : "provider";

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["contracts-linkable", targetRole, q, contractId],
    queryFn: () => search({ data: { role: targetRole, q, excludeId: contractId } }),
    enabled: open,
  });

  async function pick(row: { id: string; title: string }) {
    try {
      if (mode === "provider-adds-child") {
        // atualiza o filho apontando para este contrato como pai
        await link({ data: { childId: row.id, parentId: contractId } });
      } else {
        // este contrato (client) passa a apontar para o selecionado (provider)
        await link({ data: { childId: contractId, parentId: row.id } });
      }
      toast.success("Vínculo salvo.");
      await qc.invalidateQueries();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "provider-adds-child"
              ? "Vincular contrato de compra"
              : "Vincular contrato de venda"}
          </DialogTitle>
          <DialogDescription>
            {mode === "provider-adds-child"
              ? "Selecione um contrato de compra (client) para associar como execução deste contrato de prestação."
              : "Selecione o contrato de prestação (provider) do cliente final ao qual este contrato de compra dá suporte."}
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título ou número…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-8 pr-8"
          />
          {q && (
            <button
              onClick={() => setQ("")}
              className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
              aria-label="Limpar"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-auto border rounded-lg divide-y">
          {isFetching && <div className="p-3 text-sm text-muted-foreground">Buscando…</div>}
          {!isFetching && results.length === 0 && (
            <div className="p-3 text-sm text-muted-foreground">Nenhum contrato encontrado.</div>
          )}
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => pick(r)}
              className="w-full text-left px-3 py-2.5 hover:bg-muted/40 transition"
            >
              <div className="text-sm font-medium truncate">{r.title}</div>
              <div className="text-xs text-muted-foreground font-mono truncate">
                {r.number ?? "—"} · {STATUS_LABEL[r.status] ?? r.status} ·{" "}
                {formatCurrency(Number(r.total_value ?? 0), r.currency)}
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
