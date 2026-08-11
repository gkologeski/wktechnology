// Painel de aditivos do contrato.
// - Contrato principal: lista os aditivos vinculados e permite vincular/desvincular.
// - Aditivo: mostra o contrato principal, número do aditivo e vigência.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FilePlus2, Loader2, Unlink } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { formatCurrency } from "@/lib/crm";
import { linkContractAmendment } from "@/lib/contracts.functions";
import {
  MainContractPicker,
  type MainContractOption,
} from "@/components/contracts/main-contract-picker";

export type AmendmentRow = {
  id: string;
  number: string | null;
  title: string;
  status: string;
  total_value: number | string | null;
  currency: string;
  role: string;
  starts_at?: string | null;
  ends_at?: string | null;
  amendment_number: string | null;
  amendment_effective_at: string | null;
};

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

export function ContractAmendmentsPanel({
  contractId,
  documentKind,
  contractRole,
  amendmentOf,
  amendments,
  amendmentNumber,
  amendmentEffectiveAt,
  canEdit = true,
}: {
  contractId: string;
  documentKind: string;
  /** Papel do contrato atual: o aditivo deve ter o mesmo papel do principal. */
  contractRole?: "provider" | "client";
  amendmentOf: AmendmentRow | null;
  amendments: AmendmentRow[];
  amendmentNumber: string | null;
  amendmentEffectiveAt: string | null;
  canEdit?: boolean;
}) {
  const qc = useQueryClient();
  const linkFn = useServerFn(linkContractAmendment);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["contract", contractId] });
    await qc.invalidateQueries({ queryKey: ["contracts"] });
  }

  async function unlink(id: string) {
    if (!(await confirmDialog("Remover o vínculo de aditivo deste contrato?"))) return;
    try {
      await linkFn({ data: { amendmentId: id, mainContractId: null } });
      toast.success("Vínculo de aditivo removido.");
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const isAmendment = documentKind === "amendment";

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <FilePlus2 className="h-4 w-4" aria-hidden="true" />
            Aditivos
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {isAmendment
              ? "Este documento é um aditivo vinculado a um contrato principal do mesmo papel."
              : contractRole === "client"
                ? "Um contrato de compra só aninha aditivos (termos aditivos) — ele próprio fica aninhado sob um contrato de prestação."
                : "Vincule aditivos (termos aditivos) a este contrato principal."}
          </p>
        </div>
        {canEdit ? (
          <Button size="sm" onClick={() => setOpen(true)}>
            {isAmendment ? "Alterar contrato principal" : "Vincular aditivo"}
          </Button>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-3">
        {isAmendment ? (
          amendmentOf ? (
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Aditivo</Badge>
                {amendmentNumber ? (
                  <span className="text-xs text-muted-foreground">nº {amendmentNumber}</span>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  Vigência: {formatDate(amendmentEffectiveAt)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    to="/contracts/$id"
                    params={{ id: amendmentOf.id }}
                    className="block truncate text-sm font-medium hover:underline"
                  >
                    {amendmentOf.title}
                  </Link>
                  <span className="block truncate font-mono text-xs text-muted-foreground">
                    {amendmentOf.number ?? "—"} ·{" "}
                    {STATUS_LABEL[amendmentOf.status] ?? amendmentOf.status}
                  </span>
                </div>
                {canEdit ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remover vínculo de aditivo"
                    onClick={() => unlink(contractId)}
                  >
                    <Unlink className="h-4 w-4" aria-hidden="true" />
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
              Aditivo sem contrato principal definido.
            </p>
          )
        ) : amendments.length === 0 ? (
          <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
            Nenhum aditivo vinculado ainda.
          </p>
        ) : (
          <div className="divide-y rounded-lg border">
            {amendments.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <Link
                    to="/contracts/$id"
                    params={{ id: a.id }}
                    className="block truncate text-sm font-medium hover:underline"
                  >
                    {a.amendment_number ? `Aditivo ${a.amendment_number} · ` : ""}
                    {a.title}
                  </Link>
                  <span className="block truncate font-mono text-xs text-muted-foreground">
                    {a.number ?? "—"} · {STATUS_LABEL[a.status] ?? a.status} · vigência{" "}
                    {formatDate(a.amendment_effective_at)}
                  </span>
                </div>
                <span className="whitespace-nowrap text-sm tabular-nums">
                  {formatCurrency(Number(a.total_value ?? 0), a.currency)}
                </span>
                {canEdit ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remover vínculo do aditivo ${a.title}`}
                    onClick={() => unlink(a.id)}
                  >
                    <Unlink className="h-4 w-4" aria-hidden="true" />
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <LinkAmendmentDialog
        open={open}
        onOpenChange={setOpen}
        mode={isAmendment ? "set-main" : "add-amendment"}
        contractId={contractId}
        contractRole={contractRole}
        saving={saving}
        onSubmit={async ({ targetId, mainId, number, effectiveAt }) => {
          setSaving(true);
          try {
            await linkFn({
              data: {
                amendmentId: targetId,
                mainContractId: mainId,
                amendmentNumber: number || null,
                effectiveAt: effectiveAt || null,
              },
            });
            toast.success("Aditivo vinculado.");
            setOpen(false);
            await refresh();
          } catch (e) {
            toast.error((e as Error).message);
          } finally {
            setSaving(false);
          }
        }}
      />
    </Card>
  );
}

function LinkAmendmentDialog({
  open,
  onOpenChange,
  mode,
  contractId,
  contractRole,
  saving,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  mode: "set-main" | "add-amendment";
  contractId: string;
  contractRole?: "provider" | "client";
  saving: boolean;
  onSubmit: (input: {
    targetId: string;
    mainId: string;
    number: string;
    effectiveAt: string;
  }) => Promise<void>;
}) {
  const [selected, setSelected] = useState<MainContractOption | null>(null);
  const [number, setNumber] = useState("");
  const [effectiveAt, setEffectiveAt] = useState("");

  const isSetMain = mode === "set-main";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isSetMain ? "Contrato principal" : "Vincular aditivo"}</DialogTitle>
          <DialogDescription>
            {isSetMain
              ? "Escolha o contrato principal ao qual este aditivo pertence."
              : "Escolha um contrato já cadastrado para vinculá-lo como aditivo deste contrato."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label>{isSetMain ? "Contrato principal" : "Contrato que será o aditivo"}</Label>
            <MainContractPicker
              value={selected}
              onChange={setSelected}
              excludeId={contractId}
              role={contractRole}
              placeholder="Buscar contrato…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amendment-number">Número do aditivo</Label>
              <Input
                id="amendment-number"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="Ex.: 1º"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="amendment-date">Vigência do aditivo</Label>
              <Input
                id="amendment-date"
                type="date"
                value={effectiveAt}
                onChange={(e) => setEffectiveAt(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            disabled={!selected || saving}
            onClick={() => {
              if (!selected) return;
              void onSubmit({
                targetId: isSetMain ? contractId : selected.id,
                mainId: isSetMain ? selected.id : contractId,
                number,
                effectiveAt,
              });
            }}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> Salvando…
              </>
            ) : (
              "Vincular"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
