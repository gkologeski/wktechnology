// Seção "Importação contínua" dos conectores Clockify, Jibble e ClickUp.
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { HrScreenAccess } from "@/components/hr-access";
import { CalendarClock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getImportSchedule,
  saveImportSchedule,
} from "@/lib/integrations/import-schedule/schedule.functions";
import {
  FREQUENCY_LABELS,
  WEEKDAY_LABELS,
  type ImportFrequency,
  type ImportProvider,
} from "@/lib/integrations/import-schedule/schedule";

const STATUS: Record<string, string> = {
  preview_started: "Prévia iniciada",
  import_started: "Importação iniciada",
  failed: "Falhou",
};
const fmt = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";

export function ImportScheduleCard(props: { provider: ImportProvider; name: string }) {
  return (
    <HrScreenAccess resources={[`techprojects.${props.provider}_import`]}>
      <ScheduleSection {...props} />
    </HrScreenAccess>
  );
}

function ScheduleSection({ provider, name }: { provider: ImportProvider; name: string }) {
  const qc = useQueryClient();
  const get = useServerFn(getImportSchedule);
  const save = useServerFn(saveImportSchedule);
  const q = useQuery({
    queryKey: ["import-schedule", provider],
    queryFn: () => get({ data: { provider } }),
  });
  const s = q.data?.schedule;
  const [enabled, setEnabled] = useState(false);
  const [frequency, setFrequency] = useState<ImportFrequency>("daily");
  const [runHour, setRunHour] = useState(2);
  const [runWeekday, setRunWeekday] = useState(1);
  const [mode, setMode] = useState<"preview" | "auto_import">("preview");
  useEffect(() => {
    if (!s) return;
    setEnabled(s.enabled);
    setFrequency(s.frequency as ImportFrequency);
    setRunHour(s.run_hour);
    setRunWeekday(s.run_weekday);
    setMode(s.mode as "preview" | "auto_import");
  }, [s]);
  const m = useMutation({
    mutationFn: () => save({ data: { provider, enabled, frequency, runHour, runWeekday, mode } }),
    onSuccess: (r) => {
      toast.success(
        r.nextRunAt
          ? `Agenda salva. Próxima execução: ${fmt(r.nextRunAt)}.`
          : "Importação contínua desligada.",
      );
      void qc.invalidateQueries({ queryKey: ["import-schedule", provider] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const daily = frequency === "daily" || frequency === "weekly";
  return (
    <section
      aria-labelledby={`sched-${provider}`}
      className="rounded-lg border border-border bg-card p-5 space-y-4"
    >
      <div className="flex items-start gap-3">
        <CalendarClock className="h-5 w-5 text-muted-foreground mt-0.5" aria-hidden />
        <div className="flex-1">
          <h2 id={`sched-${provider}`} className="font-semibold">
            Importação contínua
          </h2>
          <p className="text-sm text-muted-foreground">
            Busca dados novos do {name} na frequência escolhida. Nada já editado no sistema é
            sobrescrito e nada é duplicado.
          </p>
        </div>
        {s?.enabled ? <Badge>Ligada</Badge> : <Badge variant="outline">Desligada</Badge>}
      </div>

      {q.isLoading && <Skeleton className="h-32 w-full" />}
      {q.isError && (
        <Alert variant="destructive">
          <AlertTitle>Não foi possível carregar a agenda</AlertTitle>
          <AlertDescription>
            {(q.error as Error).message}{" "}
            <Button variant="link" className="px-1 h-auto" onClick={() => q.refetch()}>
              Tentar de novo
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {q.data && !q.data.autoAvailable && (
        <Alert>
          <AlertTitle>Ainda não disponível para o {name}</AlertTitle>
          <AlertDescription>
            A importação do {name} depende de revisão a cada etapa. Por enquanto, continue usando a
            importação manual abaixo.
          </AlertDescription>
        </Alert>
      )}
      {q.data?.autoAvailable && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch id={`en-${provider}`} checked={enabled} onCheckedChange={setEnabled} />
            <Label htmlFor={`en-${provider}`}>Ligar importação contínua</Label>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor={`fq-${provider}`}>Frequência</Label>
              <Select
                value={frequency}
                onValueChange={(v) => setFrequency(v as ImportFrequency)}
                disabled={!enabled}
              >
                <SelectTrigger id={`fq-${provider}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FREQUENCY_LABELS).map(([k, l]) => (
                    <SelectItem key={k} value={k}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {frequency === "weekly" && (
              <div className="space-y-1.5">
                <Label htmlFor={`wd-${provider}`}>Dia da semana</Label>
                <Select
                  value={String(runWeekday)}
                  onValueChange={(v) => setRunWeekday(Number(v))}
                  disabled={!enabled}
                >
                  <SelectTrigger id={`wd-${provider}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEKDAY_LABELS.map((l, i) => (
                      <SelectItem key={l} value={String(i)}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {daily && (
              <div className="space-y-1.5">
                <Label htmlFor={`hr-${provider}`}>Horário (Brasília)</Label>
                <Select
                  value={String(runHour)}
                  onValueChange={(v) => setRunHour(Number(v))}
                  disabled={!enabled}
                >
                  <SelectTrigger id={`hr-${provider}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, h) => (
                      <SelectItem key={h} value={String(h)}>
                        {String(h).padStart(2, "0")}:00
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <fieldset className="space-y-2" disabled={!enabled}>
            <legend className="text-sm font-medium">O que fazer a cada execução</legend>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as "preview" | "auto_import")}>
              <div className="flex items-start gap-2">
                <RadioGroupItem id={`mp-${provider}`} value="preview" />
                <Label htmlFor={`mp-${provider}`} className="font-normal">
                  Só gerar a prévia — um administrador confere e confirma a importação.
                </Label>
              </div>
              <div className="flex items-start gap-2">
                <RadioGroupItem id={`ma-${provider}`} value="auto_import" />
                <Label htmlFor={`ma-${provider}`} className="font-normal">
                  Importar automaticamente — a prévia é confirmada em seu nome. Itens com conflito
                  continuam esperando revisão.
                </Label>
              </div>
            </RadioGroup>
          </fieldset>
          <dl className="grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Próxima execução</dt>
              <dd>{s?.enabled ? fmt(s.next_run_at) : "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Última execução</dt>
              <dd>{fmt(s?.last_run_at)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Resultado</dt>
              <dd>{s?.last_status ? (STATUS[s.last_status] ?? s.last_status) : "—"}</dd>
            </div>
          </dl>
          {s?.last_error && (
            <Alert variant="destructive" aria-live="polite">
              <AlertTitle>Última execução com erro</AlertTitle>
              <AlertDescription>{s.last_error}</AlertDescription>
            </Alert>
          )}
          <Button onClick={() => m.mutate()} disabled={m.isPending}>
            {m.isPending ? "Salvando…" : "Salvar agenda"}
          </Button>
        </div>
      )}
    </section>
  );
}
