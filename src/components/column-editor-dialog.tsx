import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronUp, RotateCcw, Search } from "lucide-react";

export type ColumnDef = { key: string; label: string; group?: string };

export function ColumnEditorDialog({
  open,
  setOpen,
  allColumns,
  value,
  defaults,
  onApply,
  onReset,
}: {
  open: boolean;
  setOpen: (b: boolean) => void;
  allColumns: ColumnDef[];
  value: string[] | null;
  defaults?: string[];
  onApply: (order: string[]) => void;
  onReset?: () => void;
}) {
  const [order, setOrder] = useState<string[]>([]);
  const [visible, setVisible] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  const wasOpen = useRef(false);
  useEffect(() => {
    // Initialize state only on the transition from closed -> open.
    // Re-running on every `value`/`allColumns` change causes a double render
    // when actions like "Restaurar padrão" persist a new value upstream.
    if (open && !wasOpen.current) {
      const initial =
        value && value.length
          ? value
          : defaults && defaults.length
            ? defaults
            : allColumns.map((c) => c.key);
      setOrder(initial);
      setVisible(new Set(initial));
      setQuery("");
    }
    wasOpen.current = open;
  }, [open, value, defaults, allColumns]);

  const allKeys = allColumns.map((c) => c.key);
  const fullOrder = [
    ...order.filter((k) => allKeys.includes(k)),
    ...allKeys.filter((k) => !order.includes(k)),
  ];

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
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setVisible(next);
  };

  const apply = () => {
    onApply(fullOrder.filter((k) => visible.has(k)));
    setOpen(false);
  };

  const resetToDefault = () => {
    const base = defaults && defaults.length ? defaults : allKeys;
    setOrder(base);
    setVisible(new Set(base));
    onReset?.();
  };

  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const filtered = query.trim()
    ? fullOrder.filter((k) => {
        const c = allColumns.find((x) => x.key === k);
        return c && normalize(c.label).includes(normalize(query));
      })
    : fullOrder;

  const visibleCount = visible.size;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar colunas</DialogTitle>
          <DialogDescription>
            Marque, desmarque e reordene as colunas exibidas nesta tela. As preferências ficam
            salvas na sua conta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar campo…"
              className="pl-9 h-9 [[data-dialog-content]_&]:pl-10"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {visibleCount} de {allColumns.length} visíveis
            </span>
            <button
              type="button"
              onClick={resetToDefault}
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" /> Restaurar padrão
            </button>
          </div>

          <div className="space-y-0.5 max-h-[55vh] overflow-y-auto rounded border bg-muted/30 p-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                Nenhum campo encontrado.
              </div>
            ) : (
              filtered.map((key) => {
                const col = allColumns.find((c) => c.key === key);
                if (!col) return null;
                return (
                  <div
                    key={key}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-background"
                  >
                    <Checkbox checked={visible.has(key)} onCheckedChange={() => toggle(key)} />
                    <span className="flex-1 text-sm truncate">
                      {col.label}
                      {col.group ? (
                        <span className="ml-2 text-[10px] text-muted-foreground">{col.group}</span>
                      ) : null}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => move(key, -1)}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => move(key, 1)}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={apply}>Aplicar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
