// Agrupamento explícito dos itens do negócio em entregas. Itens no mesmo grupo viram um único
// projeto; a quantidade do item nunca multiplica projetos. "Sem entrega" deixa o item de fora.
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  GROUP_NONE,
  groupKeyFromLabel,
  type DeliveryOverview,
} from "@/lib/projects/deal-delivery-labels";

type Row = { id: string; label: string; none: boolean };
export type GroupSave = { lineItemId: string; groupKey: string | null; groupLabel: string | null };

export function DeliveryGroupsDialog({
  open,
  items,
  busy,
  onCancel,
  onSave,
}: {
  open: boolean;
  items: DeliveryOverview["items"];
  busy: boolean;
  onCancel: () => void;
  onSave: (rows: GroupSave[]) => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    if (open)
      setRows(
        items.map((i) => ({
          id: i.id,
          none: i.group_key === GROUP_NONE,
          label: i.group_key && i.group_key !== GROUP_NONE ? (i.group_label ?? i.group_key) : "",
        })),
      );
  }, [open, items]);

  const invalid = useMemo(
    () => rows.some((r) => !r.none && r.label.trim() !== "" && !groupKeyFromLabel(r.label)),
    [rows],
  );
  const groups = useMemo(
    () =>
      new Set(rows.filter((r) => !r.none && r.label.trim()).map((r) => groupKeyFromLabel(r.label))),
    [rows],
  );
  const set = (id: string, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onCancel() : undefined)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Entregas do negócio</DialogTitle>
          <DialogDescription>
            Sem grupos, o ganho gera um único projeto. Dê o mesmo nome aos itens que formam uma
            entrega: cada nome vira um projeto. Projetos já criados não mudam.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="w-24 text-right">Qtd.</TableHead>
                <TableHead>Entrega</TableHead>
                <TableHead className="w-28">Sem entrega</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((i) => {
                const r = rows.find((x) => x.id === i.id);
                if (!r) return null;
                return (
                  <TableRow key={i.id}>
                    <TableCell className="text-sm">{i.name}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {i.quantity} {i.unit ?? ""}
                    </TableCell>
                    <TableCell>
                      <Input
                        aria-label={`Entrega do item ${i.name}`}
                        placeholder="Entrega única"
                        value={r.label}
                        disabled={r.none}
                        maxLength={120}
                        onChange={(e) => set(i.id, { label: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Checkbox
                        aria-label={`Item ${i.name} sem entrega`}
                        checked={r.none}
                        onCheckedChange={(v) => set(i.id, { none: v === true })}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {groups.size <= 1 ? "Resultado: 1 projeto." : `Resultado: ${groups.size} projetos.`}
          {invalid ? " Use letras ou números no nome da entrega." : ""}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
          <Button
            disabled={busy || invalid}
            onClick={() =>
              onSave(
                rows.map((r) => ({
                  lineItemId: r.id,
                  groupKey: r.none
                    ? GROUP_NONE
                    : r.label.trim()
                      ? groupKeyFromLabel(r.label)
                      : null,
                  groupLabel: r.none || !r.label.trim() ? null : r.label.trim(),
                })),
              )
            }
          >
            {busy ? "Salvando…" : "Salvar entregas"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
