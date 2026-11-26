import { canConfigureImportSource, canManageImportSource } from "./import-access";
import { ArrowRight, Check, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type {
  ImportProvider,
  JourneyRun,
  JourneySource,
  JourneyStatus,
} from "@/lib/projects/imports/import-journey";
import { count, PROVIDER_LABEL } from "./import-format";
import { FlowHeading, FlowFooter, CoverageSource, Metric } from "./import-flow-sections";
import {
  ImportSafetyNote,
  JourneyNotice,
  JourneySteps,
  ProviderIcon,
  RunBadge,
} from "./import-journey-ui";

export function ImportFlow({
  status,
  step,
  selected,
  busy,
  readOnly,
  onSelection,
  onStep,
  onStart,
  onResume,
  onReview,
  onRecords,
  onConnection,
}: {
  status: JourneyStatus;
  step: number;
  selected: ImportProvider[];
  busy: boolean;
  readOnly: boolean;
  onSelection: (provider: ImportProvider, selected: boolean) => void;
  onStep: (step: 1 | 2) => void;
  onStart: () => void;
  onResume: (run: JourneyRun) => void;
  onReview: () => void;
  onRecords: () => void;
  onConnection: (source: JourneySource) => void;
}) {
  const sources = status.sources.filter((s) => s.canView);
  const included = sources.filter((s) => selected.includes(s.provider));
  const eligible = included.length > 0 && included.every((s) => canManageImportSource(s, readOnly));
  const latest = sources.flatMap((s) => (s.latestRun ? [s.latestRun] : []));
  const interrupted = latest.find((r) => r.resumable && r.status !== "running");
  const interruptedSource = sources.find((source) => source.provider === interrupted?.provider);
  return (
    <section className="mx-auto w-full max-w-5xl py-6" aria-label="Jornada de importação">
      <JourneySteps step={step} />
      {step === 1 && (
        <>
          <FlowHeading title="Comece pelas suas origens">
            Confirme as conexões. O histórico completo das organizações autorizadas será recebido,
            incluindo registros ativos, arquivados e lançamentos com erro.
          </FlowHeading>
          <div className="divide-y divide-border-subtle border-y border-border-subtle">
            {sources.map((source) => (
              <div
                key={source.provider}
                className="flex flex-wrap items-center gap-3 py-5 sm:gap-4"
              >
                <ProviderIcon provider={source.provider} />
                <div className="min-w-0 flex-1 basis-2/3 sm:basis-0">
                  <label
                    className="flex items-center gap-2.5 font-medium"
                    htmlFor={`source-${source.provider}`}
                  >
                    <Checkbox
                      id={`source-${source.provider}`}
                      checked={selected.includes(source.provider)}
                      disabled={!source.ready || !source.canManage || readOnly || busy}
                      onCheckedChange={(checked) => {
                        if (canManageImportSource(source, readOnly) && !busy)
                          onSelection(source.provider, checked === true);
                      }}
                    />
                    {PROVIDER_LABEL[source.provider]}
                  </label>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {source.sourceName ?? "Selecione a organização autorizada na conexão."}
                  </p>
                  {source.error && <p className="mt-1 text-xs text-destructive">{source.error}</p>}
                </div>
                <div className="ml-14 flex w-full items-center justify-between gap-3 sm:ml-0 sm:w-auto sm:justify-end">
                  <Badge variant={source.ready ? "secondary" : "outline"}>
                    {source.ready
                      ? "Conectado"
                      : source.configured
                        ? "Conferir origem"
                        : "Não conectado"}
                  </Badge>
                  {canConfigureImportSource(source, readOnly) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (canConfigureImportSource(source, readOnly)) onConnection(source);
                      }}
                    >
                      {source.ready ? "Ver conexão" : "Configurar conexão"}
                      <ArrowRight className="size-3.5" aria-hidden />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="flex max-w-3xl items-start gap-2.5 py-5 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
            Sem escolher períodos ou descartar registros inválidos. As pendências serão tratadas
            depois, mantendo o registro original e suas versões.
          </p>
          {readOnly && (
            <JourneyNotice>
              O modo somente leitura permite conferir os dados, mas não iniciar ou retomar
              importações.
            </JourneyNotice>
          )}
          <FlowFooter note="Somente origens autorizadas para o workspace ativo. Conectar uma fonte não concede acesso a pessoas importadas.">
            <Button disabled={!eligible || readOnly || busy} onClick={() => onStep(2)}>
              Conferir cobertura <ArrowRight aria-hidden />
            </Button>
          </FlowFooter>
        </>
      )}
      {step === 2 && (
        <>
          <FlowHeading title="Todo o histórico, sem descartar erros">
            Confira os tipos de registro. Limitações da API ou falta de acesso serão informadas; uma
            coleta parcial nunca será apresentada como cobertura completa.
          </FlowHeading>
          <JourneyNotice>
            <strong className="font-medium text-foreground">
              Importar todos os registros disponíveis
            </strong>
            <p>
              Todo o período acessível das origens selecionadas, incluindo arquivados e dados
              incompletos.
            </p>
          </JourneyNotice>
          <div className="my-6 divide-y divide-border-subtle">
            {included.map((source) => (
              <CoverageSource key={source.provider} source={source} />
            ))}
          </div>
          <p className="mb-5 text-xs leading-relaxed text-muted-foreground">
            As contagens mostram o que já foi recebido. O total da nova execução só será conhecido
            após a leitura; um tipo sem acesso não equivale a zero registros.
          </p>
          <ImportSafetyNote />
          <FlowFooter note="Se uma origem falhar, os registros recebidos permanecem consultáveis e a execução pode ser retomada.">
            <Button variant="ghost" onClick={() => onStep(1)} disabled={busy}>
              Voltar
            </Button>
            <Button
              disabled={!eligible || readOnly || busy}
              onClick={() => {
                if (eligible && !busy && !readOnly) onStart();
              }}
            >
              {busy && <Loader2 className="animate-spin" aria-hidden />}
              Importar todos os registros <ArrowRight aria-hidden />
            </Button>
          </FlowFooter>
        </>
      )}
      {step === 3 && (
        <>
          <FlowHeading
            title={interrupted ? "A importação ainda não terminou" : "Recebendo seu histórico"}
          >
            {interrupted
              ? "Os registros já recebidos estão preservados. Confira a origem interrompida e retome sem importar o mesmo registro duas vezes."
              : "Você não precisa resolver vínculos agora. Os registros recebidos ficam guardados, inclusive os que vierem com erro."}
          </FlowHeading>
          <div className="divide-y divide-border-subtle border-y border-border-subtle">
            {latest.map((run) => (
              <div key={run.id} className="flex flex-wrap items-start gap-3 py-5">
                <ProviderIcon provider={run.provider} />
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium">{PROVIDER_LABEL[run.provider]}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{run.phase}</p>
                  {run.error && (
                    <p role="alert" className="mt-2 text-xs text-destructive">
                      {run.error}
                    </p>
                  )}
                </div>
                <div className="ml-13 flex items-center gap-3 sm:ml-0">
                  <span className="text-sm tabular-nums text-text-secondary">
                    {count(run.received)} recebidos
                  </span>
                  {run.status === "running" && (
                    <Loader2
                      className="size-3.5 animate-spin text-primary"
                      aria-label="Em andamento"
                    />
                  )}
                  <RunBadge run={run} />
                </div>
              </div>
            ))}
          </div>
          {interrupted && (
            <JourneyNotice warning className="mt-5">
              <strong className="font-medium text-foreground">
                Parcial não significa concluído.
              </strong>
              <p>
                Nenhum registro recebido será excluído. Falhas e limitações de cobertura ficam no
                histórico.
              </p>
            </JourneyNotice>
          )}
          <FlowFooter note="A leitura avança em etapas enquanto esta tela está aberta, respeitando o ritmo de cada origem.">
            <Button variant="ghost" onClick={onRecords}>
              Ver registros recebidos
            </Button>
            {interrupted && (
              <Button
                disabled={
                  busy || !interruptedSource || !canManageImportSource(interruptedSource, readOnly)
                }
                onClick={() => {
                  if (
                    interruptedSource &&
                    canManageImportSource(interruptedSource, readOnly) &&
                    !busy
                  )
                    onResume(interrupted);
                }}
              >
                {busy ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <RefreshCw aria-hidden />
                )}
                Retomar importação
              </Button>
            )}
          </FlowFooter>
        </>
      )}
      {step === 4 && (
        <>
          <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Check className="size-4 text-primary" aria-hidden /> Registros de origem preservados
          </div>
          <FlowHeading title="Seu histórico está no TechProjects">
            Os registros recebidos estão disponíveis para consulta. Os que precisam de conferência
            continuam guardados com seus valores originais.
          </FlowHeading>
          {latest.some((run) => !run.coverageComplete) && (
            <JourneyNotice warning>
              <strong className="font-medium text-foreground">
                O histórico recebido está preservado, mas a cobertura tem limitações.
              </strong>
              <ul className="mt-2 space-y-1">
                {latest
                  .filter((run) => !run.coverageComplete)
                  .map((run) => (
                    <li key={run.id}>
                      <span className="font-medium">{PROVIDER_LABEL[run.provider]}:</span>{" "}
                      {run.error ??
                        (run.sourceLimited
                          ? "A origem não disponibiliza todos os tipos previstos pela API. Repetir a leitura não recupera conteúdo que ela não oferece."
                          : "Ainda há registros ou capacidades que precisam ser conferidos.")}
                    </li>
                  ))}
              </ul>
            </JourneyNotice>
          )}
          <dl className="my-7 grid grid-cols-3 divide-x divide-border-subtle">
            <Metric
              label="Registros recebidos"
              value={status.summary.received}
              hint="Preservados na origem importada"
            />
            <Metric
              label="Prontos para uso"
              value={status.summary.ready}
              hint="Conforme o tipo e as permissões"
            />
            <Metric
              label="Precisam de conferência"
              value={status.summary.pending}
              hint="Continuam visíveis e preservados"
            />
          </dl>
          {status.summary.unclassified > 0 && (
            <p className="mb-6 text-xs text-muted-foreground">
              {count(status.summary.unclassified)} registros recebidos ainda estão em classificação.
              Não foram descartados.
            </p>
          )}
          <div className="mb-6 divide-y divide-border-subtle">
            {latest.map((run) => (
              <div
                key={run.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs"
              >
                <span className="font-medium">{PROVIDER_LABEL[run.provider]}</span>
                <span className="text-muted-foreground">
                  {count(run.received)} recebidos · {count(run.pending)} com pendência
                </span>
                <RunBadge run={run} />
              </div>
            ))}
          </div>
          <JourneyNotice>
            <strong className="font-medium text-foreground">
              O erro veio junto com o registro.
            </strong>
            <p>
              Vínculos ausentes, períodos inválidos e sobreposições continuam em Pendências. A
              conferência mantém o original e registra quem decidiu e por quê.
            </p>
          </JourneyNotice>
          <div className="mt-5">
            <ImportSafetyNote />
          </div>
          <FlowFooter note="Registros já existentes não são somados novamente. Originais de sistemas diferentes podem representar o mesmo trabalho.">
            <Button variant="ghost" onClick={onRecords}>
              Ver todos os registros
            </Button>
            <Button onClick={onReview}>
              Revisar pendências <ArrowRight aria-hidden />
            </Button>
          </FlowFooter>
        </>
      )}
    </section>
  );
}
