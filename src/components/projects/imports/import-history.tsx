import { useImportAccess } from "./use-import-access";
import type { ImportQueryScope } from "./import-format";
import { useState } from "react";
import { ArrowRight, History, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { JourneyRun } from "@/lib/projects/imports/import-journey";
import { count, PROVIDER_LABEL, timestamp } from "./import-format";
import { JourneyNotice, RunBadge } from "./import-journey-ui";

export function ImportHistory({
  runs,
  scope,
  busy,
  readOnly,
  onResume,
  onImport,
}: {
  runs: JourneyRun[];
  scope: ImportQueryScope;
  busy: boolean;
  readOnly: boolean;
  onResume: (run: JourneyRun) => void;
  onImport: () => void;
}) {
  const access = useImportAccess(scope);
  const visibleRuns = runs.filter((run) => access.canRead(run.provider));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = visibleRuns.find((run) => run.id === selectedId);
  return (
    <section className="py-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold tracking-tight">Histórico de importações</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Acompanhe a cobertura e as interrupções de cada origem.
        </p>
      </div>
      {visibleRuns.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Origem</TableHead>
              <TableHead>Iniciada em</TableHead>
              <TableHead>Recebidos</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="text-right">Detalhes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRuns.map((run) => (
              <TableRow key={`${run.provider}:${run.id}`}>
                <TableCell>
                  <strong className="block text-sm font-medium">
                    {PROVIDER_LABEL[run.provider]}
                  </strong>
                  <small className="text-xs text-muted-foreground">{run.sourceName}</small>
                </TableCell>
                <TableCell className="text-xs">{timestamp(run.createdAt)}</TableCell>
                <TableCell className="tabular-nums">{count(run.received)}</TableCell>
                <TableCell>
                  <RunBadge run={run} />
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="link" size="sm" onClick={() => setSelectedId(run.id)}>
                    Ver execução <ArrowRight aria-hidden />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="py-14 text-center">
          <History className="mx-auto mb-3 size-8 text-muted-foreground" aria-hidden />
          <h3 className="font-medium">Nenhuma execução registrada</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            A primeira importação mostrará aqui as origens e o resultado.
          </p>
          <Button className="mt-5" onClick={onImport}>
            Começar importação <ArrowRight aria-hidden />
          </Button>
        </div>
      )}
      <Sheet
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader className="pr-6 text-left">
            <SheetTitle>
              Execução de {selected ? PROVIDER_LABEL[selected.provider] : "importação"}
            </SheetTitle>
            <SheetDescription>
              Leitura preservada por origem. Coleta completa e conferência operacional são etapas
              diferentes.
            </SheetDescription>
          </SheetHeader>
          {selected && (
            <div className="mt-6 space-y-5">
              <RunBadge run={selected} />
              <dl className="space-y-3 text-sm">
                <RunField label="Organização" value={selected.sourceName} />
                <RunField label="Iniciada em" value={timestamp(selected.createdAt)} />
                <RunField label="Finalizada em" value={timestamp(selected.finishedAt)} />
                <RunField label="Etapa" value={selected.phase} />
                <RunField label="Registros recebidos" value={count(selected.received)} />
                <RunField label="Prontos para uso" value={count(selected.ready)} />
                <RunField label="Com pendência" value={count(selected.pending)} />
              </dl>
              {selected.error && <JourneyNotice warning>{selected.error}</JourneyNotice>}
              {selected.resumable && !readOnly && access.canManage(selected.provider) && (
                <Button
                  disabled={busy}
                  onClick={() => {
                    setSelectedId(null);
                    if (access.canManage(selected.provider) && !readOnly) onResume(selected);
                  }}
                >
                  <RefreshCw aria-hidden />
                  Retomar importação
                </Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}
function RunField({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-3 border-b border-border-subtle pb-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}
