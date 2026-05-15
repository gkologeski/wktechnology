import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronUp } from "lucide-react";

export type ColumnDef = { key: string; label: string };

export function ColumnEditorDialog({
  open, setOpen, allColumns, value, onApply,
}: {
  open: boolean; setOpen: (b: boolean) => void;
  allColumns: ColumnDef[]; value: string[] | null; onApply: (order: string[]) => void;
}) {
  const [order, setOrder] = useState<string[]>([]);
  const [visible, setVisible] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      const initial = value && value.length ? value : allColumns.map((c) => c.key);
      setOrder(initial);
      setVisible(new Set(initial));
    }
  }, [open, value, allColumns]);

  const allKeys = allColumns.map((c) => c.key);
  const fullOrder = [...order, ...allKeys.filter((k) => !order.includes(k))];

  const move = (key: string, dir: -1 | 1) => {
    const idx = fullOrder.indexOf(key);
    const swap = idx + dir;
    if (swap < 0 || swap >= fullOrder.length) return;
    const next = [...fullOrder];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setOrder(next);
  };
  const toggle = (key: string) => {
    const next = new Set(visible);
    if (next.has(key)) next.delete(key); else next.add(key);
    setVisible(next);
  };

  const apply = () => {
    onApply(fullOrder.filter((k) => visible.has(k)));
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar colunas</DialogTitle></DialogHeader>
        <div className="space-y-1 max-h-[60vh] overflow-y-auto">
          {fullOrder.map((key) => {
            const col = allColumns.find((c) => c.key === key);
            if (!col) return null;
            return (
              <div key={key} className="flex items-center gap-2 p-2 rounded hover:bg-muted">
                <Checkbox checked={visible.has(key)} onCheckedChange={() => toggle(key)} />
                <span className="flex-1 text-sm">{col.label}</span>
                <Button variant="ghost" size="icon" onClick={() => move(key, -1)}><ChevronUp className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => move(key, 1)}><ChevronDown className="h-4 w-4" /></Button>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={apply}>Aplicar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
