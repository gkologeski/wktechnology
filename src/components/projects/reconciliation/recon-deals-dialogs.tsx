// Diálogos da aba "Negócios" da conciliação: prévia de impacto do lote e busca manual de projeto.
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/techhire/ui";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { searchProjectsForDeal } from "@/lib/projects/deal-delivery.functions";
import { BLOCKED_LABEL, WARNING_LABEL, formatHms } from "@/lib/projects/deal-delivery-labels";
import type { PairPreview } from "@/lib/projects/deal-delivery-history.server";

export function PreviewDialog({
  open,
  rows,
  loading,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  rows: PairPreview[] | null;
  loading: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  useEffect(() => {
    if (open) setNote("");
  }, [open]);
  const blocked = (rows ?? []).filter((r) => r.blocked);
  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onCancel() : undefined)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Prévia do vínculo em lote</DialogTitle>
          <DialogDescription>
            Confira cada par. Nada muda em horas, datas, status, contratos ou origem; se algum dado
            mudar antes da confirmação, o lote inteiro é recusado e a prévia precisa ser refeita.
          </DialogDescription>
        </DialogHeader>
        {loading || !rows ? (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <ul className="max-h-[45vh] divide-y overflow-y-auto rounded-md border">
            {rows.map((r) => (
              <li key={`${r.deal_id}-${r.project_id}`} className="space-y-1 px-3 py-2 text-sm">
                <p>
                  <span className="font-medium">{r.deal_name}</span> → {r.project_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.mode === "primary"
                    ? "Vira a origem principal do projeto"
                    : "Entra como negócio consolidado"}{" "}
                  · horas no projeto {formatHms(r.logged_seconds)}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {r.blocked && (
                    <StatusBadge status="closed" label={BLOCKED_LABEL[r.blocked] ?? r.blocked} />
                  )}
                  {r.warnings.map((w) => (
                    <StatusBadge key={w} status="onhold" label={WARNING_LABEL[w] ?? w} />
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="pv-note">Justificativa do lote (obrigatória)</Label>
          <Textarea
            id="pv-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
          <Button
            disabled={
              busy ||
              loading ||
              !rows ||
              rows.length === 0 ||
              blocked.length > 0 ||
              note.trim().length < 5
            }
            onClick={() => onConfirm(note.trim())}
          >
            {busy
              ? "Vinculando…"
              : blocked.length > 0
                ? "Remova os pares bloqueados"
                : `Confirmar ${rows?.length ?? 0} vínculo(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PickProjectDialog({
  dealId,
  dealName,
  onCancel,
  onPick,
}: {
  dealId: string | null;
  dealName: string | null;
  onCancel: () => void;
  onPick: (project: { id: string; name: string }) => void;
}) {
  const search = useServerFn(searchProjectsForDeal);
  const [q, setQ] = useState("");
  const dq = useDebouncedValue(q, 300);
  useEffect(() => setQ(""), [dealId]);
  const list = useQuery({
    queryKey: ["recon-deals-pick", dealId, dq],
    queryFn: () => search({ data: { dealId: dealId!, q: dq } }),
    enabled: !!dealId,
  });
  return (
    <Dialog open={!!dealId} onOpenChange={(o) => (!o ? onCancel() : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Buscar projeto</DialogTitle>
          <DialogDescription>
            Escolha o projeto para o negócio “{dealName}”. Ele entra na prévia do lote.
          </DialogDescription>
        </DialogHeader>
        <Input
          aria-label="Buscar projeto pelo nome"
          placeholder="Nome do projeto"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="max-h-64 overflow-y-auto rounded-md border">
          {list.isLoading ? (
            <Skeleton className="m-3 h-8" />
          ) : (list.data ?? []).length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">Nenhum projeto encontrado.</p>
          ) : (
            (list.data ?? []).map((p) => (
              <button
                key={p.id}
                type="button"
                className="block w-full border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => onPick({ id: p.id, name: p.name })}
              >
                <span className="font-medium">{p.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {p.companyName ?? "Sem empresa"}
                  {p.hasOtherDeal ? " · atende outro negócio" : ""}
                </span>
              </button>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
