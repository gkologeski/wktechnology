import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fillPurchaseContractBody,
  listPurchaseContractTemplates,
} from "@/lib/contracts/purchase-from-sale.functions";
import { usePermissions } from "@/lib/access-control/use-permissions";

type Props = {
  contract: { id: string; role?: string | null; status?: string | null };
  canUpdate: boolean;
  onFilled: () => void;
};

/** Compra em rascunho: aplica um modelo de Compra com os dados do fornecedor (PJ ou PF). */
export function PurchaseTemplateFill({ contract, canUpdate, onFilled }: Props) {
  const permissions = usePermissions();
  const allowed =
    canUpdate &&
    !permissions.isLoading &&
    !permissions.isError &&
    ["own", "team", "workspace"].some((s) =>
      permissions.can(`techcontracts.contracts.update.${s}`),
    );
  const list = useServerFn(listPurchaseContractTemplates);
  const fill = useServerFn(fillPurchaseContractBody);
  const [templateId, setTemplateId] = useState("");
  const [busy, setBusy] = useState(false);
  const show = contract.role === "client" && contract.status === "draft";
  const templates = useQuery({
    queryKey: ["purchase-templates"],
    queryFn: () => list(),
    enabled: show && allowed,
  });
  if (!show || !allowed) return null;

  async function run() {
    if (!templateId) return;
    setBusy(true);
    try {
      const r = await fill({ data: { contractId: contract.id, templateId } });
      if (r.missing.length)
        toast.warning(`Texto preenchido. Complete manualmente: ${r.missing.join(", ")}.`);
      else toast.success("Texto preenchido com os dados do fornecedor.");
      onFilled();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível preencher o texto.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-3 flex flex-wrap items-end gap-3 rounded-md border border-border bg-muted/40 p-3">
      <div className="min-w-64 flex-1 space-y-1">
        <Label htmlFor="purchase-template">Modelo de compra</Label>
        <Select value={templateId} onValueChange={setTemplateId}>
          <SelectTrigger id="purchase-template">
            <SelectValue
              placeholder={
                templates.isLoading
                  ? "Carregando modelos…"
                  : templates.isError
                    ? "Não foi possível carregar os modelos"
                    : templates.data?.length
                      ? "Escolha o modelo"
                      : "Nenhum modelo de compra publicado"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {(templates.data ?? []).map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={!templateId || busy}
        onClick={() => void run()}
      >
        <FileText className="mr-1 h-4 w-4" aria-hidden="true" />
        {busy ? "Preenchendo…" : "Preencher com dados do fornecedor"}
      </Button>
      <p className="w-full text-xs text-muted-foreground">
        Substitui o texto atual pelo modelo, com WK como contratante e o fornecedor como contratada.
      </p>
    </div>
  );
}
