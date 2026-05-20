import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, Users as UsersIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { enrichBatch } from "@/lib/integrations/enrichment.functions";

type Mode = "fill_empty" | "overwrite";

export function BulkEnrichDialog({
  open, onOpenChange, ids, entity, onDone,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  ids: string[];
  entity: "lead" | "contact";
  onDone?: () => void;
}) {
  const enrich = useServerFn(enrichBatch);
  const [useApollo, setUseApollo] = useState(true);
  const [useLusha, setUseLusha] = useState(true);
  const [mode, setMode] = useState<Mode>("fill_empty");
  const [dryRun, setDryRun] = useState(false);
  const [preview, setPreview] = useState<
    { entity_id: string; provider: string | null; update: Record<string, unknown> }[] | null
  >(null);

  const providers = [
    ...(useApollo ? (["apollo"] as const) : []),
    ...(useLusha ? (["lusha"] as const) : []),
  ];

  const mut = useMutation({
    mutationFn: async () => enrich({
      data: { entity, ids, providers: [...providers], mode, dryRun },
    }),
    onSuccess: (r) => {
      if (r.dryRun) {
        setPreview(r.preview ?? []);
        toast.message(`Simulação: ${r.succeeded} alterações em ${ids.length} registros`);
      } else {
        toast.success(
          `${r.succeeded} atualizados · ${r.unchanged} sem mudanças · ${r.failed} falhas · ${r.creditsUsed} crédito(s)`,
        );
        onDone?.();
        onOpenChange(false);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setPreview(null); onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enriquecer {ids.length} {entity === "lead" ? "lead(s)" : "contato(s)"}</DialogTitle>
          <DialogDescription>
            Cascade: o primeiro provedor selecionado tenta primeiro; o seguinte
            preenche o que ficou faltando.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">Provedores (na ordem)</Label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={useApollo} onCheckedChange={(v) => setUseApollo(!!v)} />
                <Sparkles className="h-3.5 w-3.5" /> Apollo
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={useLusha} onCheckedChange={(v) => setUseLusha(!!v)} />
                <UsersIcon className="h-3.5 w-3.5" /> Lusha
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Modo</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fill_empty">Preencher apenas vazios</SelectItem>
                  <SelectItem value="overwrite">Sobrescrever existentes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Execução</Label>
              <Select value={dryRun ? "dry" : "real"} onValueChange={(v) => setDryRun(v === "dry")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="real">Aplicar mudanças</SelectItem>
                  <SelectItem value="dry">Simular (sem consumir crédito)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {preview && (
            <div className="border rounded-md max-h-64 overflow-y-auto">
              <div className="px-3 py-2 text-xs font-medium border-b bg-muted/50">Prévia das alterações</div>
              {preview.length === 0 && (
                <div className="p-3 text-sm text-muted-foreground">Nenhuma alteração proposta.</div>
              )}
              {preview.map((p) => (
                <div key={p.entity_id} className="px-3 py-2 text-xs border-b last:border-0">
                  <div className="flex items-center gap-2 mb-1">
                    <code className="text-muted-foreground">{p.entity_id.slice(0, 8)}</code>
                    {p.provider && <Badge variant="secondary">{p.provider}</Badge>}
                    {Object.keys(p.update).length === 0 && (
                      <span className="text-muted-foreground">sem mudanças</span>
                    )}
                  </div>
                  {Object.keys(p.update).length > 0 && (
                    <div className="space-y-0.5">
                      {Object.entries(p.update).map(([k, v]) => (
                        <div key={k}><span className="text-muted-foreground">{k}:</span> {String(v)}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={providers.length === 0 || mut.isPending}
          >
            {mut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {dryRun ? "Simular" : "Enriquecer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
