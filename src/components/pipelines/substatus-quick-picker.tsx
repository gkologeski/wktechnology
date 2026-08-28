import { useState } from "react";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { deniedIfUnaffected } from "@/lib/access-control/rls-denied";
import { useStageSubstatuses } from "@/lib/pipelines/substatuses";
import { SubstatusBadge } from "./substatus-badge";
import { SubstatusManageHint } from "./substatus-manage-hint";

/**
 * Troca rápida de substatus a partir de um card do Kanban.
 * Nada é renderizado quando a etapa não tem substatus e o registro não tem valor.
 */
export function SubstatusQuickPicker({
  table,
  rowId,
  pipelineId,
  stageValue,
  value,
  canUpdate = true,
  onChanged,
}: {
  table: "deals" | "leads";
  rowId: string;
  pipelineId?: string | null;
  stageValue?: string | null;
  value?: string | null;
  canUpdate?: boolean;
  onChanged?: () => void;
}) {
  const { options, all, isLoading } = useStageSubstatuses(pipelineId, stageValue);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const current = all.find((s) => s.id === value) ?? null;

  // Etapa sem substatus: gestores veem um atalho para configurar; demais, nada.
  if (options.length === 0 && !current) {
    if (isLoading) return null;
    return <SubstatusManageHint onClick={(e) => e.preventDefault?.()} />;
  }
  if (!canUpdate) return <SubstatusBadge substatus={current} />;

  const apply = async (next: string | null) => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from(table)
        .update({ stage_substatus_id: next } as never)
        .eq("id", rowId)
        .select("id");
      if (error) {
        toast.error(error.message);
        return;
      }
      if (deniedIfUnaffected(data, "alterar o substatus deste registro")) return;
      toast.success("Substatus atualizado");
      setOpen(false);
      onChanged?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Alterar substatus"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {current ? (
            <SubstatusBadge substatus={current} />
          ) : (
            <span className="text-[10px] text-muted-foreground underline decoration-dotted">
              definir substatus
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-56 p-1"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {isLoading && (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">Carregando substatus…</p>
        )}
        <div className="max-h-64 overflow-y-auto">
          {options.map((o) => (
            <Button
              key={o.id}
              variant="ghost"
              size="sm"
              disabled={saving}
              className="w-full justify-start gap-2 text-xs"
              onClick={() => void apply(o.id)}
            >
              <Check className={cn("h-3 w-3", o.id === value ? "opacity-100" : "opacity-0")} />
              {o.name}
            </Button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={saving || !value}
          className="w-full justify-start gap-2 text-xs text-muted-foreground"
          onClick={() => void apply(null)}
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <span className="w-3" />}
          Sem substatus
        </Button>
      </PopoverContent>
    </Popover>
  );
}
