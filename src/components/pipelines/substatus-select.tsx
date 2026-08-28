import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStageSubstatuses } from "@/lib/pipelines/substatuses";
import { SubstatusManageHint } from "./substatus-manage-hint";

const NONE = "__none__";

/**
 * Seletor de substatus da etapa atual. Não renderiza nada quando a etapa
 * não possui substatus configurados (adoção incremental por etapa).
 */
export function SubstatusSelect({
  pipelineId,
  stageValue,
  value,
  onChange,
  disabled,
  label = "Substatus",
  className,
  hideWhenEmpty = true,
}: {
  pipelineId?: string | null;
  stageValue?: string | null;
  value?: string | null;
  onChange: (id: string | null) => void | Promise<void>;
  disabled?: boolean;
  label?: string | null;
  className?: string;
  hideWhenEmpty?: boolean;
}) {
  const { options, isLoading, error } = useStageSubstatuses(pipelineId, stageValue);

  if (isLoading && hideWhenEmpty && !value) return null;
  if (error) {
    return (
      <p className="text-xs text-destructive" role="alert">
        Não foi possível carregar os substatus desta etapa.
      </p>
    );
  }
  if (options.length === 0 && hideWhenEmpty) {
    if (value) return null;
    // Etapa sem substatus: mostra atalho de configuração para gestores.
    return <SubstatusManageHint className={className} />;
  }

  const current = value && options.some((o) => o.id === value) ? value : NONE;

  return (
    <div className={className}>
      {label ? <Label className="text-[10px] text-muted-foreground">{label}</Label> : null}
      <Select
        value={current}
        disabled={disabled || isLoading || options.length === 0}
        onValueChange={(v) => void onChange(v === NONE ? null : v)}
      >
        <SelectTrigger className="h-9" aria-label={label ?? "Substatus"}>
          <SelectValue placeholder={options.length === 0 ? "Sem substatus" : "Selecione"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Sem substatus</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
