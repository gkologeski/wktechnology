// Barra de ações em lote da grid de contratos.
// As gravações reutilizam as server functions de contrato, que continuam
// validando permissão, escopo e workspace no backend.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Pencil, Trash2, Type, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  updateContract,
  deleteContract,
  standardizeContractTitles,
} from "@/lib/contracts.functions";
import { listWorkspaceTeam } from "@/lib/workspace-invites.functions";
import { DELETE_NOT_ALLOWED_TITLE } from "@/lib/access-control/use-can-delete";
import { BulkEditFieldsDialog } from "@/components/grid/bulk-edit-fields-dialog";
import type { ContractRow } from "@/components/contracts/contracts-grouped-list";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "draft", label: "Rascunho" },
  { value: "in_review", label: "Em revisão" },
  { value: "in_negotiation", label: "Em negociação" },
  { value: "awaiting_signature", label: "Aguard. assinatura" },
  { value: "active", label: "Ativo" },
  { value: "renewing", label: "Renovando" },
  { value: "ended", label: "Encerrado" },
  { value: "terminated", label: "Rescindido" },
];

export function ContractsBulkBar({
  selected,
  onClear,
  canDelete,
  canDeleteLoading = false,
}: {
  selected: ContractRow[];
  onClear: () => void;
  canDelete: (row: ContractRow) => boolean;
  canDeleteLoading?: boolean;
}) {
  const qc = useQueryClient();
  const update = useServerFn(updateContract);
  const remove = useServerFn(deleteContract);
  const standardizeTitles = useServerFn(standardizeContractTitles);
  const listTeam = useServerFn(listWorkspaceTeam);
  const teamQuery = useQuery({
    queryKey: ["workspace-team", "contracts-bulk"],
    queryFn: () => listTeam(),
    staleTime: 60_000,
  });
  const [busy, setBusy] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);

  const count = selected.length;
  const blocked = selected.filter((r) => !canDelete(r));
  const deleteAllowed = !canDeleteLoading && blocked.length === 0 && count > 0;

  async function runAll(label: string, fn: (row: ContractRow) => Promise<unknown>) {
    setBusy(true);
    let ok = 0;
    const failures: string[] = [];
    for (const row of selected) {
      try {
        await fn(row);
        ok += 1;
      } catch (e) {
        failures.push(`${row.title}: ${(e as Error).message}`);
      }
    }
    setBusy(false);
    await qc.invalidateQueries({ queryKey: ["contracts"] });
    if (ok > 0) toast.success(`${label}: ${ok} de ${count} contrato(s).`);
    if (failures.length > 0) {
      toast.error(`${failures.length} contrato(s) não foram atualizados.`, {
        description: failures.slice(0, 3).join(" · "),
      });
    }
    if (failures.length === 0) onClear();
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
      <span className="text-sm font-medium">
        {count} selecionado{count === 1 ? "" : "s"}
      </span>

      <Select
        disabled={busy}
        onValueChange={(next) =>
          void runAll("Status atualizado", (row) =>
            update({ data: { id: row.id, patch: { status: next } as never } }),
          )
        }
      >
        <SelectTrigger className="h-8 w-44" aria-label="Alterar status em lote">
          <SelectValue placeholder="Alterar status" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        disabled={busy || teamQuery.isLoading}
        onValueChange={(value) => {
          const userId = value === "__none__" ? null : value;
          void runAll("Responsável atualizado", (row) =>
            update({ data: { id: row.id, patch: { assigned_to: userId } as never } }),
          );
        }}
      >
        <SelectTrigger className="h-8 w-56" aria-label="Definir responsável em lote">
          <SelectValue placeholder="Definir responsável" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">Sem responsável</SelectItem>
          {(teamQuery.data?.members ?? []).map((m) => (
            <SelectItem key={m.user_id} value={m.user_id}>
              {m.full_name || m.email || m.user_id.slice(0, 8)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const ids = selected.map((r) => r.id);
            const { changes } = await standardizeTitles({ data: { ids, preview: true } });
            if (!changes.length) {
              toast.info("Nenhum título precisa de ajuste.");
              return;
            }
            const preview = changes
              .slice(0, 3)
              .map((c) => `${c.before} → ${c.after}`)
              .join("\n");
            const ok = await confirmDialog(
              `Padronizar ${changes.length} título(s)?\n\n${preview}${changes.length > 3 ? "\n…" : ""}`,
            );
            if (!ok) return;
            const applied = await standardizeTitles({ data: { ids } });
            await qc.invalidateQueries({ queryKey: ["contracts"] });
            toast.success(`${applied.changes.length} título(s) padronizado(s).`);
          } catch (e) {
            toast.error((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Type className="mr-1 h-4 w-4" aria-hidden="true" /> Padronizar títulos
      </Button>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={busy || !deleteAllowed}
            onClick={async () => {
              if (
                !(await confirmDialog(
                  `Excluir ${count} contrato(s)? Esta ação não pode ser desfeita.`,
                ))
              )
                return;
              await runAll("Excluídos", (row) => remove({ data: { id: row.id } }));
            }}
          >
            {busy ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 className="mr-1 h-4 w-4" aria-hidden="true" />
            )}
            Excluir
          </Button>
        </TooltipTrigger>
        {!deleteAllowed ? <TooltipContent>{DELETE_NOT_ALLOWED_TITLE}</TooltipContent> : null}
      </Tooltip>

      <Button
        variant="outline"
        size="sm"
        disabled={busy || count === 0}
        onClick={() => setBulkEditOpen(true)}
      >
        <Pencil className="mr-1 h-4 w-4" aria-hidden="true" /> Editar em massa
      </Button>

      <Button variant="ghost" size="sm" className="ml-auto" onClick={onClear} disabled={busy}>
        <X className="mr-1 h-4 w-4" aria-hidden="true" /> Limpar seleção
      </Button>

      <BulkEditFieldsDialog
        open={bulkEditOpen}
        setOpen={setBulkEditOpen}
        entity="contracts"
        ids={selected.map((r) => r.id)}
        entityLabel="contrato"
        onDone={() => {
          void qc.invalidateQueries({ queryKey: ["contracts"] });
          onClear();
        }}
      />
    </div>
  );
}
