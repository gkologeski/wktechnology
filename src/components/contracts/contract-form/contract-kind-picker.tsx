// Escolha do tipo de documento antes de preencher os campos do contrato.
import {
  CONTRACT_KINDS,
  CONTRACT_KIND_HINT,
  CONTRACT_KIND_LABEL,
} from "@/lib/contracts/contract-kinds";
import type { ContractKind } from "@/lib/contracts/contract-kinds";
import { cn } from "@/lib/utils";

export function ContractKindPicker({
  value,
  onChange,
}: {
  value: ContractKind;
  onChange: (v: ContractKind) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Tipo de contrato" className="grid gap-2 sm:grid-cols-3">
      {CONTRACT_KINDS.map((kind) => {
        const active = kind === value;
        return (
          <button
            key={kind}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(kind)}
            className={cn(
              "rounded-lg border p-3 text-left transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
            )}
          >
            <div className="text-sm font-medium">{CONTRACT_KIND_LABEL[kind]}</div>
            <p className="mt-1 text-xs text-muted-foreground">{CONTRACT_KIND_HINT[kind]}</p>
          </button>
        );
      })}
    </div>
  );
}
