import { useState } from "react";
import { SignerContactPicker } from "./signer-contact-picker";
import type { SignerContact } from "@/lib/contracts/signers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export type ParticipantSelection = { role: string; contact: SignerContact | null; cpf?: string };
export function ContractSignersEditor({
  value,
  onChange,
  disabled = false,
  witnessesDetected = false,
  max = 20,
  showCpf = false,
}: {
  value: ParticipantSelection[];
  onChange: (v: ParticipantSelection[]) => void;
  disabled?: boolean;
  witnessesDetected?: boolean;
  max?: number;
  showCpf?: boolean;
}) {
  const [extraRole, setExtraRole] = useState("");
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        CONTRATANTE e CONTRATADO são obrigatórios. Testemunhas são opcionais; ao incluir uma, a
        assinatura dela será exigida para concluir o documento. Cada participante recebe seu próprio
        link.
      </p>
      {witnessesDetected && (
        <p role="note" className="text-sm">
          Foram encontradas referências a testemunhas no documento. Confira se deseja incluí-las
          antes de preparar.
        </p>
      )}
      {value.map((p, i) => (
        <div key={p.role} className="space-y-1">
          <SignerContactPicker
            role={p.role}
            value={p.contact}
            disabled={disabled}
            onChange={(contact) => onChange(value.map((r, n) => (n === i ? { ...r, contact } : r)))}
          />
          {showCpf && (
            <div className="space-y-1">
              <Label>CPF (opcional)</Label>
              <Input
                aria-label={`CPF de ${p.role}`}
                disabled={disabled}
                value={p.cpf ?? ""}
                maxLength={20}
                onChange={(e) =>
                  onChange(value.map((r, n) => (n === i ? { ...r, cpf: e.target.value } : r)))
                }
              />
            </div>
          )}
          {i > 1 && (
            <Button
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => onChange(value.filter((_, n) => n !== i))}
            >
              Não incluir {p.role}
            </Button>
          )}
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        {["TESTEMUNHA 1", "TESTEMUNHA 2"]
          .filter((r) => !value.some((p) => p.role === r))
          .map((role) => (
            <Button
              key={role}
              variant="outline"
              size="sm"
              disabled={disabled || value.length >= max}
              onClick={() => onChange([...value, { role, contact: null }])}
            >
              + {role}
            </Button>
          ))}
      </div>
      <Label>Outro papel do documento</Label>
      <div className="flex gap-2">
        <Input
          aria-label="Outro papel do documento"
          placeholder="Ex.: INTERVENIENTE"
          value={extraRole}
          maxLength={60}
          disabled={disabled}
          onChange={(e) => setExtraRole(e.target.value.toUpperCase())}
        />
        <Button
          variant="outline"
          disabled={
            disabled ||
            value.length >= max ||
            !/^[A-Z0-9_ -]{2,60}$/.test(extraRole.trim()) ||
            value.some((p) => p.role === extraRole.trim())
          }
          onClick={() => {
            onChange([...value, { role: extraRole.trim(), contact: null }]);
            setExtraRole("");
          }}
        >
          Incluir
        </Button>
      </div>
    </div>
  );
}
