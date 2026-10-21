// Painel da fila offline de apontamentos (Minhas horas). Mostra o estado real de cada item:
// só aparece "Sincronizado" depois da confirmação do servidor.
import { CloudOff, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SectionHeader, StatusBadge } from "@/components/techhire/ui";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { useOfflineTimeQueue } from "@/hooks/use-offline-time-queue";
import type { OfflineItem, OfflineState } from "@/lib/projects/offline-queue";
import { OFFLINE_TIME_QUEUE_RETENTION_HOURS } from "@/lib/limits";
import { formatMinutes } from "@/lib/projects/time-entry.shared";

const STATE: Record<
  OfflineState,
  { status: "draft" | "onhold" | "open" | "closed"; label: string }
> = {
  pending: { status: "draft", label: "Pendente no aparelho" },
  sending: { status: "onhold", label: "Enviando" },
  synced: { status: "open", label: "Sincronizado" },
  conflict: { status: "closed", label: "Em conflito" },
  error: { status: "onhold", label: "Erro — tentará de novo" },
};

function describe(i: OfflineItem) {
  const p = i.payload;
  const when =
    p.mode === "interval"
      ? `${p.start_time?.slice(0, 5)}–${p.end_time?.slice(0, 5)}`
      : formatMinutes((p.duration_seconds ?? 0) / 60);
  return `${p.entry_date.split("-").reverse().join("/")} · ${when}`;
}

export function OfflineTimeQueuePanel() {
  const q = useOfflineTimeQueue();
  if (!q.supported || !q.ready) return null;
  const open = q.items.filter((i) => i.state !== "synced");
  return (
    <section
      aria-label="Apontamentos guardados neste aparelho"
      className="space-y-3 rounded-lg border border-border bg-card p-4"
    >
      <SectionHeader
        title="Sem conexão"
        description={`Opcional: quando ligado, um apontamento NOVO que não puder ser enviado fica guardado só neste aparelho por até ${OFFLINE_TIME_QUEUE_RETENTION_HOURS} h e é enviado quando a conexão voltar. Ao sair da conta, o que não foi enviado é apagado. O servidor confere tudo de novo no envio.`}
      />
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Switch id="offline-opt-in" checked={q.optIn} onCheckedChange={q.setOptIn} />
          <Label htmlFor="offline-opt-in">Guardar neste aparelho se a conexão cair</Label>
        </div>
        <span className="text-sm text-muted-foreground" aria-live="polite">
          {q.online ? "Conectado" : "Sem conexão agora"}
        </span>
        {open.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            disabled={!q.online || q.syncing}
            onClick={() => void q.syncNow()}
          >
            <RefreshCw
              className={`mr-1 h-3.5 w-3.5 ${q.syncing ? "animate-spin" : ""}`}
              aria-hidden
            />
            Enviar agora
          </Button>
        )}
      </div>
      {q.lostUnsent > 0 && (
        <p role="alert" className="text-sm text-destructive">
          {q.lostUnsent} apontamento(s) guardado(s) passaram do prazo de{" "}
          {OFFLINE_TIME_QUEUE_RETENTION_HOURS} h sem envio e foram descartados deste aparelho.
        </p>
      )}
      {q.items.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border" aria-live="polite">
          {q.items.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <CloudOff className="h-4 w-4 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{i.label}</p>
                <p className="text-muted-foreground">{describe(i)}</p>
                {i.lastError && (
                  <p
                    className={
                      i.state === "conflict" ? "text-destructive" : "text-muted-foreground"
                    }
                  >
                    {i.lastError}
                  </p>
                )}
              </div>
              <StatusBadge status={STATE[i.state].status} label={STATE[i.state].label} />
              {(i.state === "conflict" || i.state === "error") && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!q.online}
                  onClick={() => void q.retry(i.id)}
                >
                  Tentar de novo
                </Button>
              )}
              {i.state !== "sending" && (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={
                    i.state === "synced" ? "Remover da lista" : "Descartar apontamento guardado"
                  }
                  onClick={async () => {
                    if (
                      i.state !== "synced" &&
                      !(await confirmDialog({
                        title: "Descartar apontamento guardado?",
                        description: "Ele ainda não foi enviado e será apagado deste aparelho.",
                        confirmLabel: "Descartar",
                        variant: "destructive",
                      }))
                    )
                      return;
                    await q.discard(i.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
