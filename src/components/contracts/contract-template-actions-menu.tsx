import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  Check,
  Copy,
  FilePen,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { useWorkRecordCapability } from "@/components/work-action";
import { readViewAs } from "@/lib/view-as-client";
import {
  deleteContractTemplate,
  duplicateContractTemplate,
  updateContractTemplate,
} from "@/lib/contracts/templates.functions";

const RES = "techcontracts.contract_templates";
type Status = "draft" | "published" | "archived";

/** UI affordance only — every action is re-checked on the server/DB. */
export function ContractTemplateActionsMenu({
  template,
  variant = "list",
  onDeleted,
}: {
  template: { id: string; name: string; status: string };
  variant?: "list" | "detail";
  onDeleted?: () => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const p = usePermissions();
  const cap = useWorkRecordCapability(RES, template.id);
  const updateFn = useServerFn(updateContractTemplate);
  const removeFn = useServerFn(deleteContractTemplate);
  const dupFn = useServerFn(duplicateContractTemplate);
  const [busy, setBusy] = useState(false);

  const view = readViewAs();
  const readOnly = !!view && (view.readOnly || view.mode === "role");
  const has = (a: string) =>
    !readOnly && p.canAny(["own", "team", "workspace"].map((s) => `${RES}.${a}.${s}`));
  const checking = p.isLoading || (cap as { id?: string }).id === undefined;
  const canCreate = has("create") && has("view");
  const canUpdate = has("update") && !!cap.can_update;
  const canDelete = has("delete") && !!cap.can_delete;
  const hint = checking ? "Verificando permissão…" : "Sem permissão";
  const status = template.status as Status;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["contract-templates"] });
    qc.invalidateQueries({ queryKey: ["contract-template", template.id] });
  };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const setStatus = (next: Status, msg: string) =>
    run(async () => {
      await updateFn({ data: { id: template.id, patch: { status: next } } });
      toast.success(msg);
      refresh();
    });

  const item = (
    label: string,
    Icon: typeof Pencil,
    allowed: boolean,
    onSelect: () => void,
    destructive = false,
  ) => (
    <DropdownMenuItem
      disabled={!allowed || busy}
      onSelect={onSelect}
      className={destructive ? "text-destructive focus:text-destructive" : undefined}
      title={allowed ? undefined : hint}
    >
      <Icon className="mr-2 h-4 w-4" />
      <span className="flex-1">{label}</span>
      {!allowed ? <span className="ml-3 text-[10px] text-muted-foreground">{hint}</span> : null}
    </DropdownMenuItem>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "list" ? (
          <Button variant="ghost" size="icon" aria-label={`Ações do modelo ${template.name}`}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreHorizontal className="h-4 w-4" />
            )}
          </Button>
        ) : (
          <Button variant="outline" aria-label="Mais ações do modelo">
            {busy ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <MoreHorizontal className="mr-1 h-4 w-4" />
            )}
            Mais ações
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="truncate">{template.name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {variant === "list"
          ? item("Editar", Pencil, true, () =>
              navigate({ to: "/contracts/templates/$id", params: { id: template.id } }),
            )
          : null}
        {item("Duplicar", Copy, canCreate, () =>
          run(async () => {
            const row = await dupFn({ data: { id: template.id } });
            toast.success("Modelo duplicado.");
            refresh();
            if (variant === "detail" && row?.id)
              navigate({ to: "/contracts/templates/$id", params: { id: row.id } });
          }),
        )}
        {variant === "list" && status !== "published"
          ? item("Publicar", Check, canUpdate, () => setStatus("published", "Modelo publicado."))
          : null}
        {status !== "draft"
          ? item("Voltar para rascunho", FilePen, canUpdate, () =>
              setStatus("draft", "Modelo voltou para rascunho."),
            )
          : null}
        {status === "archived"
          ? item("Reativar (publicar)", ArchiveRestore, canUpdate, () =>
              setStatus("published", "Modelo reativado."),
            )
          : item("Arquivar", Archive, canUpdate, () => setStatus("archived", "Modelo arquivado."))}
        <DropdownMenuSeparator />
        {item(
          "Excluir",
          Trash2,
          canDelete,
          () =>
            void run(async () => {
              const ok = await confirmDialog({
                title: "Excluir modelo",
                description: `O modelo "${template.name}" será removido. Contratos já gerados não são afetados.`,
                confirmLabel: "Excluir",
                variant: "destructive",
              });
              if (!ok) return;
              await removeFn({ data: { id: template.id } });
              toast.success("Modelo excluído.");
              qc.invalidateQueries({ queryKey: ["contract-templates"] });
              onDeleted?.();
            }),
          true,
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
