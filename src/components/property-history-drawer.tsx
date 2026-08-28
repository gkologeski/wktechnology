import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatDateTime } from "@/lib/crm";
import { labelProperty, labelValue } from "@/lib/timeline/property-labels";
import { useHistoryLabels } from "@/components/activity/use-history-labels";

type Row = {
  id: string;
  entity: string;
  entity_id: string;
  property: string;
  old_value: unknown;
  new_value: unknown;
  changed_at: string;
  changed_by: string | null;
};

export function PropertyHistoryDrawer({
  open,
  onOpenChange,
  entity,
  entityId,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  entity: string;
  entityId: string;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("property_history")
      .select("*")
      .eq("entity", entity)
      .eq("entity_id", entityId)
      .order("changed_at", { ascending: false })
      .limit(200)
      .then((r: { data: Row[] | null }) => setRows(r.data ?? []));
  }, [open, entity, entityId]);

  // Resolve UUIDs (substatus, empresa, responsável…) para nomes legíveis.
  const { resolveValue, resolveActor } = useHistoryLabels(rows);
  const display = (property: string, raw: unknown) =>
    resolveValue(property, raw) ?? labelValue(raw);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Histórico de propriedades</SheetTitle>
        </SheetHeader>
        <ol className="mt-4 space-y-3">
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground">Sem alterações registradas.</p>
          )}
          {rows.map((h) => (
            <li key={h.id} className="rounded border p-3 text-sm">
              <div className="font-medium">{labelProperty(h.property)}</div>
              <div className="text-xs text-muted-foreground mt-1">
                <span className="line-through">{display(h.property, h.old_value)}</span>
                {" → "}
                <span className="text-foreground">{display(h.property, h.new_value)}</span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                {resolveActor(h.changed_by)} · {formatDateTime(h.changed_at)}
              </div>
            </li>
          ))}
        </ol>
      </SheetContent>
    </Sheet>
  );
}
