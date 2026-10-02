// Botão "Gerar contrato" de Propostas e Cotações: abre o assistente de
// contrato com a origem já escolhida (novo contrato ou termo aditivo no passo 2).
import { useState } from "react";
import { FileSignature } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContractWizard, type ContractWizardSource } from "./contract-wizard";

type Source = { proposalId?: string; quoteId?: string };

export function GenerateContractButton({
  source,
  size = "sm",
  variant = "outline",
}: {
  source: Source;
  size?: "sm" | "default";
  variant?: "outline" | "default";
}) {
  const [wizard, setWizard] = useState<ContractWizardSource | null>(null);
  return (
    <>
      <Button variant={variant} size={size} onClick={() => setWizard({ ...source })}>
        <FileSignature className="mr-1 h-4 w-4" aria-hidden="true" />
        Gerar contrato
      </Button>
      <ContractWizard source={wizard} onOpenChange={(o) => !o && setWizard(null)} />
    </>
  );
}
