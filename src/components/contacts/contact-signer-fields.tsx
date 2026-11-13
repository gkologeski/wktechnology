// Signatário legal + CPF do contato (SIGNATARIO-CONTATO). Usados nos contratos e propostas.
import { usePermissions } from "@/lib/access-control/use-permissions";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { setCustomFieldValue } from "@/lib/custom-properties.functions";
import { formatCpf, isValidCpf } from "@/lib/format/cpf";

type Props = {
  contactId: string;
  customFields: Record<string, unknown> | null;
  disabled?: boolean;
  onSaved?: () => void;
};

export function ContactSignerFields({ contactId, customFields, disabled, onSaved }: Props) {
  const permissions = usePermissions();
  const cannotEdit =
    disabled ||
    !permissions.canAny([
      "techsales.contacts.update.own",
      "techsales.contacts.update.team",
      "techsales.contacts.update.workspace",
    ]);
  const saveFn = useServerFn(setCustomFieldValue);
  const isSigner = String(customFields?.signatario_legal ?? "") === "true";
  const savedCpf = typeof customFields?.cpf === "string" ? customFields.cpf : "";
  const [cpf, setCpf] = useState(savedCpf);
  const [busy, setBusy] = useState(false);

  const save = async (key: string, value: unknown) => {
    if (cannotEdit) return;
    setBusy(true);
    try {
      await saveFn({
        data: { entity: "contacts", entity_id: contactId, key, value: value as never },
      });
      toast.success("Atualizado");
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  };

  const saveCpf = () => {
    if (cpf.trim() && !isValidCpf(cpf)) {
      toast.error("CPF inválido.");
      return;
    }
    void save("cpf", cpf.trim() ? formatCpf(cpf) : null);
  };

  return (
    <div className="bg-card rounded-2xl p-6 shadow-sm border border-border/60 space-y-4">
      <div>
        <h3 className="font-bold text-foreground">Assinatura de contratos</h3>
        <p className="text-xs text-muted-foreground">
          O signatário legal assina contratos e propostas em nome da empresa.
        </p>
      </div>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={`signer-${contactId}`}>Signatário legal</Label>
        <Switch
          id={`signer-${contactId}`}
          checked={isSigner}
          disabled={cannotEdit || busy}
          onCheckedChange={(v) => void save("signatario_legal", v ? true : null)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`cpf-${contactId}`}>CPF</Label>
        <div className="flex gap-2">
          <Input
            id={`cpf-${contactId}`}
            inputMode="numeric"
            placeholder="000.000.000-00"
            maxLength={14}
            disabled={cannotEdit || busy}
            value={cpf}
            onChange={(e) => setCpf(formatCpf(e.target.value))}
            onKeyDown={(e) => e.key === "Enter" && saveCpf()}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={cannotEdit || busy || cpf === savedCpf}
            onClick={saveCpf}
          >
            Salvar
          </Button>
        </div>
        {isSigner && !savedCpf && (
          <p className="text-xs text-destructive">Informe o CPF para usar nos contratos.</p>
        )}
      </div>
    </div>
  );
}
