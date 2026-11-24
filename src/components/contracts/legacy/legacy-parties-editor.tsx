import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { EntityCombobox } from "@/components/ui/entity-combobox";
import { LegalEntityField } from "@/components/finance/legal-entity-select";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { updateContract } from "@/lib/contracts.functions";

/** Existing canonical contract edit action; no status, document or origin writes. */
export function LegacyPartiesEditor({
  contractId,
  companyId,
  legalEntityId,
  allowed,
}: {
  contractId: string;
  companyId: string | null;
  legalEntityId: string | null;
  allowed: boolean;
}) {
  const { workspaceId } = usePermissions();
  const [company, setCompany] = useState(companyId);
  const [entity, setEntity] = useState(legalEntityId);
  const [busy, setBusy] = useState(false);
  const update = useServerFn(updateContract);
  const qc = useQueryClient();
  useEffect(() => {
    setCompany(companyId);
    setEntity(legalEntityId);
  }, [contractId, companyId, legalEntityId]);
  if (!workspaceId || !allowed) return null;
  const changed = company !== companyId || entity !== legalEntityId;
  async function save() {
    if (!allowed || !company || !entity || !changed) return;
    setBusy(true);
    try {
      await update({
        data: {
          id: contractId,
          patch: { counterparty_company_id: company, contracting_legal_entity_id: entity },
        },
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["contract", contractId] }),
        qc.invalidateQueries({ queryKey: ["contract-legacy", contractId] }),
        qc.invalidateQueries({ queryKey: ["contracts"] }),
      ]);
      toast.success("Partes salvas. Confira a revisão do documento antes de regularizar.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Partes do contrato legado" className="space-y-3 border-b pb-4">
      <h3 className="text-sm font-medium">Partes do contrato</h3>
      <p className="text-xs text-muted-foreground">
        Identifique a contraparte e o CNPJ WK do documento, sem vincular um negócio.
      </p>
      <div className="space-y-1">
        <Label>Contraparte (empresa)</Label>
        <EntityCombobox
          entity="companies"
          select="id,name,cnpj"
          filters={{ workspace_id: workspaceId }}
          searchColumns={["name", "cnpj"]}
          labelFrom={(r) => String(r.name ?? "")}
          hintFrom={(r) => (r.cnpj as string | null) ?? null}
          value={company}
          onChange={setCompany}
          placeholder="Selecionar contraparte"
          disabled={busy}
          clearable={false}
          triggerClassName="w-full"
        />
      </div>
      <LegalEntityField
        id="legacy-legal-entity"
        label="Empresa prestadora (CNPJ WK)"
        value={entity}
        onChange={setEntity}
        disabled={busy}
      />
      <Button
        size="sm"
        variant="outline"
        disabled={busy || !company || !entity || !changed}
        onClick={save}
      >
        {busy ? "Salvando…" : "Salvar partes"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Se o legado já foi reconhecido, salvar partes exige conferir e reconhecer a nova revisão
        antes de usar a evidência assinada. Depois de regularizado, alterações são feitas por
        aditivo.
      </p>
    </section>
  );
}
