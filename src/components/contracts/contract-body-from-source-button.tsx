import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { reloadContractBodyFromSource } from "@/lib/contracts/import.functions";
import { canReloadBodyFromSource } from "@/lib/contracts/import-body";
import { usePermissions } from "@/lib/access-control/use-permissions";

type Props = {
  contract: { id: string; status?: string | null; source_file_path?: string | null };
  /** Corpo atual no editor (pode estar sem salvar). */
  bodyHtml: string;
  canUpdate: boolean;
  onLoaded: () => void;
};

/** Rascunho importado sem corpo: lê o arquivo original guardado e preenche o corpo. */
export function ContractBodyFromSourceButton({ contract, bodyHtml, canUpdate, onLoaded }: Props) {
  const reload = useServerFn(reloadContractBodyFromSource);
  const permissions = usePermissions();
  const [busy, setBusy] = useState(false);
  // Chave de edição + capacidade do registro; nega enquanto carrega.
  const allowed =
    canUpdate &&
    !permissions.isLoading &&
    !permissions.isError &&
    ["own", "team", "workspace"].some((s) =>
      permissions.can(`techcontracts.contracts.update.${s}`),
    );
  if (!canReloadBodyFromSource({ ...contract, body_html: bodyHtml })) return null;

  async function run() {
    setBusy(true);
    try {
      const r = await reload({ data: { id: contract.id } });
      toast.success(
        r.truncated
          ? "Corpo carregado do arquivo original (truncado por ser muito longo)."
          : "Corpo carregado do arquivo original.",
      );
      onLoaded();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível carregar o corpo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/40 p-3">
      <p className="text-sm text-muted-foreground">
        Este contrato foi importado de um arquivo e está sem corpo.
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void run()}
        disabled={busy || !allowed}
        title={allowed ? undefined : "Você não tem permissão para editar este contrato."}
      >
        <FileDown className="mr-1 h-4 w-4" aria-hidden="true" />
        {busy ? "Carregando…" : "Carregar corpo do arquivo original"}
      </Button>
    </div>
  );
}
