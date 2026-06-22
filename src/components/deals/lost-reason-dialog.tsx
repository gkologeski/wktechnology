import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw } from "lucide-react";
import {
  getDealLossReasons,
  syncHubspotLossReasons,
  backfillLostDealReasons,
} from "@/lib/deal-loss-reasons.functions";

export type LostReasonResult = {
  reasonValue: string;
  reasonLabel: string;
  notes?: string | null;
};

export function LostReasonDialog({
  open,
  onOpenChange,
  dealName,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  dealName?: string | null;
  onConfirm: (result: LostReasonResult) => Promise<void> | void;
}) {
  const qc = useQueryClient();
  const fetchReasons = useServerFn(getDealLossReasons);
  const syncFn = useServerFn(syncHubspotLossReasons);
  const backfillFn = useServerFn(backfillLostDealReasons);

  const { data, isLoading } = useQuery({
    queryKey: ["deal-loss-reasons"],
    queryFn: () => fetchReasons({ data: {} }),
    staleTime: 5 * 60_000,
    enabled: open,
  });

  const sync = useMutation({
    mutationFn: async () => {
      const r = await syncFn();
      const b = await backfillFn();
      return { ...r, ...b };
    },
    onSuccess: (r) => {
      toast.success(
        `Sincronizado: ${r.upserted} motivo(s), ${r.updated} negócio(s) atualizados`,
      );
      qc.invalidateQueries({ queryKey: ["deal-loss-reasons"] });
      qc.invalidateQueries({ queryKey: ["deals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [value, setValue] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setValue("");
      setNotes("");
    }
  }, [open]);

  const options = data?.options ?? [];

  const confirm = async () => {
    if (!value) return;
    const opt = options.find((o) => o.value === value);
    setSubmitting(true);
    try {
      await onConfirm({
        reasonValue: value,
        reasonLabel: opt?.label ?? value,
        notes: notes.trim() ? notes.trim() : null,
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Marcar como perdido</DialogTitle>
          <DialogDescription>
            {dealName
              ? `Selecione o motivo da perda de "${dealName}".`
              : "Selecione o motivo da perda."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="loss-reason">Motivo da perda</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => sync.mutate()}
                disabled={sync.isPending}
              >
                <RefreshCw className={`mr-1 h-3 w-3 ${sync.isPending ? "animate-spin" : ""}`} />
                Sincronizar HubSpot
              </Button>
            </div>
            <Select value={value} onValueChange={setValue} disabled={isLoading}>
              <SelectTrigger id="loss-reason">
                <SelectValue
                  placeholder={
                    isLoading
                      ? "Carregando..."
                      : options.length
                        ? "Selecione um motivo"
                        : "Nenhum motivo cadastrado"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.id} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isLoading && !options.length && (
              <p className="text-xs text-muted-foreground">
                Cadastre motivos em Configurações ou sincronize com o HubSpot.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="loss-notes">Observação (opcional)</Label>
            <Textarea
              id="loss-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalhes adicionais"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={confirm} disabled={!value || submitting}>
            {submitting ? "Salvando..." : "Confirmar perda"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
