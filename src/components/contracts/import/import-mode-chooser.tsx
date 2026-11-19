import { useId } from "react";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  IMPORT_MODE_OPTIONS,
  LEGACY_REASON_MAX,
  legacyReasonError,
  type ImportMode,
  importModeAccess,
  type ImportModeAccess,
} from "@/lib/contracts/import-mode";

/** Acesso por modo a partir das permissões efetivas; nega enquanto carregam ou falham. */
export function useImportModeAccess() {
  const permissions = usePermissions();
  const ready = !permissions.isLoading && !permissions.isError;
  return {
    access: importModeAccess(permissions, ready),
    ready,
    canViewLegacy: ready && permissions.can("techcontracts.legacy_contracts.view.workspace"),
  };
}

/** Escolha obrigatória e visível do modo antes da extração (presentacional). */
export function ImportModeChooser({
  mode,
  onModeChange,
  reason,
  onReasonChange,
  access,
  disabled,
}: {
  mode: ImportMode | null;
  onModeChange: (m: ImportMode) => void;
  reason: string;
  onReasonChange: (r: string) => void;
  access: ImportModeAccess;
  disabled?: boolean;
}) {
  const id = useId();
  const reasonError = mode === "legacy" && reason.length > 0 ? legacyReasonError(reason) : null;
  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="text-sm font-medium">
        Tipo de importação <span className="text-destructive">*</span>
      </legend>
      <RadioGroup
        value={mode ?? ""}
        onValueChange={(v) => onModeChange(v as ImportMode)}
        aria-required="true"
        className="grid gap-2 sm:grid-cols-2"
      >
        {IMPORT_MODE_OPTIONS.map((o) => {
          const allowed = o.value === "draft" ? access.draft : access.legacy;
          return (
            <Label
              key={o.value}
              htmlFor={`${id}-${o.value}`}
              className={`flex gap-3 rounded-md border p-3 font-normal ${
                allowed ? "cursor-pointer" : "opacity-60"
              } ${mode === o.value ? "border-primary bg-primary/5" : "border-border"}`}
            >
              <RadioGroupItem id={`${id}-${o.value}`} value={o.value} disabled={!allowed} />
              <span className="space-y-1">
                <span className="block text-sm font-medium">{o.label}</span>
                <span className="block text-xs text-muted-foreground">{o.description}</span>
                {o.value === "legacy" && !allowed && access.legacyMissing.length > 0 ? (
                  <span className="block text-xs text-destructive">
                    Sem permissão para: {access.legacyMissing.join(", ")}.
                  </span>
                ) : null}
              </span>
            </Label>
          );
        })}
      </RadioGroup>
      {mode === "legacy" ? (
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-reason`}>
            Motivo do reconhecimento como legado <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id={`${id}-reason`}
            value={reason}
            maxLength={LEGACY_REASON_MAX}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="Ex.: contrato assinado em papel em 2021, acervo do jurídico"
            aria-invalid={!!reasonError}
            aria-describedby={`${id}-reason-help`}
          />
          <p
            id={`${id}-reason-help`}
            className={`text-xs ${reasonError ? "text-destructive" : "text-muted-foreground"}`}
          >
            {reasonError ??
              "O contrato fica pendente de regularização. Assinatura, datas e situação só valem depois da conferência humana na ficha com o PDF original assinado. Dados de assinatura extraídos pela IA são apenas referência."}
          </p>
        </div>
      ) : null}
    </fieldset>
  );
}
