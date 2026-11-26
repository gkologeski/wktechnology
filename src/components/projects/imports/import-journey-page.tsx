import { useImportAccess } from "./use-import-access";
import { assertImportUiAccess } from "./import-access";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { HelpCircle, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList } from "@/components/ui/tabs";
import { ProductCanvas } from "@/components/techhire/ui";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { useAuth } from "@/lib/auth";
import { readViewAs } from "@/lib/view-as-client";
import {
  IMPORT_PROVIDERS,
  type ImportProvider,
  type JourneyRun,
  type JourneyStatus,
} from "@/lib/projects/imports/import-journey";
import {
  advanceImportJourney,
  getImportJourneyStatus,
  startImportJourney,
} from "@/lib/projects/imports/import-journey.functions";
import { ImportFlow } from "./import-flow";
import { ImportSourceSheet } from "./import-source-sheet";
import { ImportRecords } from "./import-records";
import { ImportRecordSheet } from "./import-record-sheet";
import { ImportHistory } from "./import-history";
import type { ImportQueryScope } from "./import-format";
import { JourneyNotice, JourneyTab, TabCount } from "./import-journey-ui";

type Tab = "import" | "records" | "issues" | "history";
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Não foi possível concluir a operação. Tente novamente.";

/** One user/workspace-scoped entry point. Provider authorization remains server-side. */
export function ImportJourneyPage() {
  const p = usePermissions();
  const { user, loading: authLoading } = useAuth();
  const client = useQueryClient();
  const load = useServerFn(getImportJourneyStatus);
  const start = useServerFn(startImportJourney);
  const advance = useServerFn(advanceImportJourney);
  const [tab, setTab] = useState<Tab>("import");
  const [stepOverride, setStepOverride] = useState<1 | 2 | null>(null);
  const [selected, setSelected] = useState<ImportProvider[] | null>(null);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [connectionProvider, setConnectionProvider] = useState<ImportProvider | null>(null);
  const [advanceError, setAdvanceError] = useState("");
  const readOnly = !!readViewAs()?.readOnly;
  const permissionKey = [...p.permissions]
    .filter((k) =>
      IMPORT_PROVIDERS.some((provider) => k.startsWith(`techprojects.${provider}_import.`)),
    )
    .sort()
    .join("|");
  const scope: ImportQueryScope = [user?.id ?? "", p.workspaceId ?? "", permissionKey];
  const access = useImportAccess(scope);
  const queryKey = ["project-import-journey", ...scope, "status"];
  const allowed = !p.isLoading && !p.isError && !!p.workspaceId && !!user?.id && access.canRead();
  const status = useQuery({
    queryKey,
    queryFn: async () => {
      assertImportUiAccess(access);
      const result = await load();
      if (result.workspaceId !== scope[1])
        throw new Error("O workspace mudou durante a consulta. Atualize a página.");
      return result;
    },
    enabled: allowed,
    retry: false,
    refetchOnWindowFocus: true,
  });
  const refresh = () =>
    client.invalidateQueries({ queryKey: ["project-import-journey", ...scope] });
  const update = (data: JourneyStatus) => {
    client.setQueryData(queryKey, data);
    void client.invalidateQueries({ queryKey: ["project-import-journey", ...scope, "records"] });
  };
  const begin = useMutation({
    mutationFn: (providers: ImportProvider[]) => {
      providers.forEach((provider) => assertImportUiAccess(access, provider, true));
      return start({ data: { providers } });
    },
    onSuccess: (data) => {
      setStepOverride(null);
      setAdvanceError("");
      setTab("import");
      update(data);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const tick = useMutation({
    mutationFn: ({ run, resume }: { run: JourneyRun; resume?: boolean }) => {
      assertImportUiAccess(access, run.provider, true);
      return advance({
        data: { provider: run.provider, runId: run.id, action: resume ? "resume" : "advance" },
      });
    },
    onSuccess: (data) => {
      setAdvanceError("");
      update(data);
    },
    onError: (error) => setAdvanceError(errorMessage(error)),
  });
  const sources = status.data?.sources ?? [];
  const selectedProviders =
    selected ?? sources.filter((s) => s.canView && s.canManage && s.ready).map((s) => s.provider);
  const latest = sources.flatMap((source) => (source.latestRun ? [source.latestRun] : []));
  const running = latest.find(
    (run) =>
      run.status === "running" &&
      sources.some((source) => source.provider === run.provider && source.canManage),
  );
  const step =
    stepOverride ??
    (latest.some((run) => run.status === "running" || run.resumable)
      ? 3
      : latest.length > 0
        ? 4
        : 1);
  const rootRef = useRef<HTMLDivElement>(null);
  const previousStep = useRef(step);

  useEffect(() => {
    if (step !== previousStep.current)
      rootRef.current
        ?.querySelector<HTMLElement>("[data-journey-heading]")
        ?.focus({ preventScroll: true });
    previousStep.current = step;
  }, [step]);
  // One bounded server step at a time; an error stops automatic retry until the user acts.
  useEffect(() => {
    if (!running || readOnly || tick.isPending || begin.isPending || advanceError || !allowed)
      return;
    const timer = setTimeout(() => tick.mutate({ run: running }), 1500);
    return () => clearTimeout(timer);
  }, [running, readOnly, tick, begin.isPending, advanceError, allowed]);

  if (authLoading || p.isLoading || (allowed && status.isPending))
    return (
      <p role="status" className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Carregando importações e verificando acesso…
      </p>
    );
  if (p.isError || !allowed)
    return (
      <p role="alert" className="p-6">
        {p.isError
          ? "Não foi possível verificar seu acesso. Tente novamente."
          : "Você não tem permissão para consultar as importações."}
      </p>
    );
  if (status.isError || !status.data)
    return (
      <div role="alert" className="space-y-4 p-6">
        <p>Não foi possível carregar a central de importações.</p>
        <p className="text-sm text-muted-foreground">{errorMessage(status.error)}</p>
        <Button variant="outline" onClick={() => void status.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  const data = status.data;
  const busy = begin.isPending || tick.isPending;
  const resume = (run: JourneyRun) => {
    setStepOverride(null);
    setTab("import");
    setAdvanceError("");
    tick.mutate({ run, resume: run.status !== "running" });
  };
  return (
    <ProductCanvas className="pb-8">
      <div ref={rootRef} className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8">
        <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              TechProjects · Seus dados no mesmo lugar
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Importações</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Traga o histórico completo. Resolva as pendências sem perder a origem.
            </p>
          </div>
          <div className="flex gap-2">
            {p.canAny(["techprojects.reconciliation.view.workspace"]) && (
              <Button asChild variant="ghost" size="sm">
                <Link to="/projects/settings/imports/reconciliation">Conciliação de horas</Link>
              </Button>
            )}
            {latest.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy || readOnly}
                onClick={() => {
                  setStepOverride(1);
                  setTab("import");
                }}
              >
                Nova importação
              </Button>
            )}
            <Button asChild variant="outline" size="sm">
              <Link
                to="/ajuda/$module/$slug"
                params={{ module: "projects", slug: "operar-imports" }}
              >
                <HelpCircle aria-hidden />
                Como funciona
              </Link>
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Atualizar importações"
              disabled={status.isFetching || busy}
              onClick={() => void refresh()}
            >
              <RefreshCw className={status.isFetching ? "animate-spin" : ""} aria-hidden />
            </Button>
          </div>
        </header>
        {data.legacyPending && (
          <JourneyNotice className="mb-5">
            Histórico anterior aguardando organização. Inicie a jornada para preservar e listar os
            registros já importados; nenhum apontamento será apagado.
          </JourneyNotice>
        )}
        <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
          <TabsList
            aria-label="Áreas de importação"
            className="h-auto w-full justify-start gap-5 overflow-x-auto rounded-none border-b border-border-subtle bg-transparent p-0"
          >
            <JourneyTab value="import">Importar</JourneyTab>
            <JourneyTab value="records">
              Registros recebidos <TabCount value={data.summary.received} />
            </JourneyTab>
            <JourneyTab value="issues">
              Pendências <TabCount value={data.summary.pending} />
            </JourneyTab>
            <JourneyTab value="history">Histórico</JourneyTab>
          </TabsList>
          {advanceError && (
            <div role="alert" className="mt-5">
              <JourneyNotice warning>
                <strong className="font-medium text-foreground">
                  A leitura parou e os registros recebidos continuam preservados.
                </strong>
                <p className="mt-1">{advanceError}</p>
                {running && (
                  <Button
                    size="sm"
                    className="mt-3"
                    disabled={busy || readOnly}
                    onClick={() => resume(running)}
                  >
                    Continuar leitura
                  </Button>
                )}
              </JourneyNotice>
            </div>
          )}
          <TabsContent value="import">
            <ImportFlow
              status={data}
              step={step}
              selected={selectedProviders}
              busy={busy}
              readOnly={readOnly}
              onSelection={(provider, checked) =>
                setSelected(
                  checked
                    ? [...new Set([...selectedProviders, provider])]
                    : selectedProviders.filter((s) => s !== provider),
                )
              }
              onStep={setStepOverride}
              onStart={() => begin.mutate(selectedProviders)}
              onResume={resume}
              onReview={() => setTab("issues")}
              onRecords={() => setTab("records")}
              onConnection={(source) => setConnectionProvider(source.provider)}
            />
          </TabsContent>
          <TabsContent value="records">
            <ImportRecords
              key={`records:${scope.join(":")}`}
              issuesOnly={false}
              legacyPending={data.legacyPending}
              sources={sources}
              scope={scope}
              readOnly={readOnly}
              onImport={() => setTab("import")}
              onOpen={setRecordId}
            />
          </TabsContent>
          <TabsContent value="issues">
            <ImportRecords
              key={`issues:${scope.join(":")}`}
              issuesOnly
              legacyPending={data.legacyPending}
              sources={sources}
              scope={scope}
              readOnly={readOnly}
              onImport={() => setTab("import")}
              onOpen={setRecordId}
            />
          </TabsContent>
          <TabsContent value="history">
            <ImportHistory
              runs={data.runs}
              scope={scope}
              busy={busy}
              readOnly={readOnly}
              onResume={resume}
              onImport={() => {
                setStepOverride(1);
                setTab("import");
              }}
            />
          </TabsContent>
        </Tabs>
        {connectionProvider &&
          sources.some((s) => s.provider === connectionProvider && s.canView) && (
            <ImportSourceSheet
              key={`${scope.join(":")}:${connectionProvider}`}
              source={sources.find((s) => s.provider === connectionProvider)!}
              scope={scope}
              readOnly={readOnly}
              onClose={() => setConnectionProvider(null)}
            />
          )}
        {recordId && (
          <ImportRecordSheet
            key={`${scope.join(":")}:${recordId}`}
            id={recordId}
            scope={scope}
            readOnly={readOnly}
            onClose={() => setRecordId(null)}
          />
        )}
      </div>
    </ProductCanvas>
  );
}
