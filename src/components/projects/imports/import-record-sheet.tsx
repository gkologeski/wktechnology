import { useImportRecordEvidence } from "./use-import-record-evidence";
import { useImportAccess } from "./use-import-access";
import { assertImportUiAccess } from "./import-access";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getImportJourneyRecord } from "@/lib/projects/imports/import-journey.functions";
import {
  useImportRecordReview,
  ImportRecordReviewFields,
  ImportRecordReviewActions,
} from "./import-record-review";
import {
  count,
  PROVIDER_LABEL,
  timestamp,
  importEntityLabel,
  importIssueLabel,
  type ImportQueryScope,
} from "./import-format";
import { ImportSourceFiles } from "./import-source-files";
import { JourneyNotice, RecordBadge } from "./import-journey-ui";
export function ImportRecordSheet({
  id,
  scope,
  readOnly,
  onClose,
}: {
  id: string | null;
  scope: ImportQueryScope;
  readOnly: boolean;
  onClose: () => void;
}) {
  const access = useImportAccess(scope);
  const load = useServerFn(getImportJourneyRecord);
  const [version, setVersion] = useState("current");
  const detail = useQuery({
    queryKey: ["project-import-journey", ...scope, "record", id, version],
    queryFn: () => {
      assertImportUiAccess(access);
      return load({ data: { id: id!, versionId: version === "current" ? undefined : version } });
    },
    enabled: !!id && access.canRead(),
    retry: false,
  });
  const record = access.canRead() ? detail.data : undefined;
  const review = useImportRecordReview(record, scope, readOnly, version);
  const evidence = useImportRecordEvidence(record, scope);
  return (
    <Sheet
      open={!!id}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        className="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
        onEscapeKeyDown={(event) => {
          if (
            event.target instanceof Element &&
            event.target.closest('[role="combobox"][aria-expanded="true"]')
          )
            event.preventDefault();
        }}
      >
        <SheetHeader className="shrink-0 border-b border-border-subtle p-6 pr-12 text-left">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {record
              ? `${PROVIDER_LABEL[record.provider]} · ${importEntityLabel(record.entity)}`
              : "Registro de origem"}
          </p>
          <SheetTitle>{record?.label ?? "Conferir registro"}</SheetTitle>
          <SheetDescription>
            O original continua preservado. A conferência não aprova horas nem libera valores.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {!access.canRead() ? (
            <p role="alert">Sem permissão para consultar este registro no contexto atual.</p>
          ) : detail.isPending ? (
            <p role="status" className="flex gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Carregando original…
            </p>
          ) : detail.isError || !record ? (
            <div role="alert" className="space-y-3">
              <p>Registro indisponível ou sem permissão de consulta.</p>
              <Button variant="outline" onClick={() => void detail.refetch()}>
                Tentar novamente
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <RecordBadge record={record} />
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={detail.isFetching}
                  onClick={() => void detail.refetch()}
                >
                  <RefreshCw className={detail.isFetching ? "animate-spin" : ""} aria-hidden />
                  Atualizar evidência
                </Button>
                <span className="text-xs text-muted-foreground">
                  {count(record.versionCount)} versão(ões) preservada(s)
                </span>
              </div>
              {record.issues.length > 0 && (
                <JourneyNotice warning>
                  <ul className="space-y-1">
                    {record.issues.map((issue, i) => (
                      <li key={`${issue}:${i}`}>{importIssueLabel(issue)}</li>
                    ))}
                  </ul>
                </JourneyNotice>
              )}
              <dl className="divide-y divide-border-subtle text-xs">
                <Field
                  label="Origem"
                  value={`${PROVIDER_LABEL[record.provider]} · ${record.sourceName}`}
                />
                <Field label="Identificador" value={record.externalId} />
                <Field label="Recebido em" value={timestamp(record.receivedAt)} />
              </dl>
              <section className="space-y-3">
                <h3 className="text-sm font-medium">Registro original · preservado</h3>
                {evidence.versions.length > 0 && (
                  <Select value={version} onValueChange={setVersion}>
                    <SelectTrigger aria-label="Versão do registro original">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="current">Versão atual preservada</SelectItem>
                      {evidence.versions
                        .filter((v) => v.id !== record.currentVersionId)
                        .map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {timestamp(v.at)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
                {evidence.nextVersions && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={evidence.loading}
                    onClick={() => evidence.loadMore("versions")}
                  >
                    {evidence.loading && <Loader2 className="animate-spin" aria-hidden />}Carregar
                    versões anteriores
                  </Button>
                )}
                <pre
                  className="max-h-80 overflow-auto rounded-md bg-muted/40 p-3 text-xs leading-relaxed text-text-secondary"
                  tabIndex={0}
                  aria-label="Dados originais recebidos"
                >
                  {JSON.stringify(record.original, null, 2) ??
                    "Original não disponível nesta consulta."}
                </pre>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  A exibição exclui credenciais e dados de acesso. As correções no TechERP não
                  substituem esta evidência de origem.
                </p>
              </section>
              <ImportSourceFiles record={record} scope={scope} />
              <ImportRecordReviewFields review={review} />
              {version !== "current" && (
                <JourneyNotice>
                  Você está consultando uma versão anterior. Volte à versão atual para registrar uma
                  conferência.
                </JourneyNotice>
              )}
              <section className="space-y-3">
                <h3 className="text-sm font-medium">Trilha de conferência</h3>
                {evidence.history.length ? (
                  <ol className="space-y-4">
                    {evidence.history.map((event, i) => (
                      <li
                        key={`${event.at}:${i}`}
                        className="border-l-2 border-primary/20 pl-3 text-xs leading-relaxed"
                      >
                        <strong className="font-medium">{event.actor}</strong>
                        <span className="ml-2 text-muted-foreground">{timestamp(event.at)}</span>
                        <p className="mt-1 whitespace-pre-wrap text-text-secondary">{event.note}</p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Nenhuma decisão registrada. O recebimento e as versões de origem continuam
                    preservados.
                  </p>
                )}
                {evidence.nextHistory && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={evidence.loading}
                    onClick={() => evidence.loadMore("history")}
                  >
                    {evidence.loading && <Loader2 className="animate-spin" aria-hidden />}Carregar
                    mais decisões
                  </Button>
                )}
              </section>
            </>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border-subtle bg-background p-4">
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
          <ImportRecordReviewActions review={review} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-3 py-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}
