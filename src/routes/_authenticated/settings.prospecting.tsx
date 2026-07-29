import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Plus,
  Play,
  Trash2,
  UserPlus,
  Loader2,
  Database,
  Building2,
  MapPin,
  Mail,
  Phone,
  Linkedin,
  ExternalLink,
  Pencil,
  ListPlus,
} from "lucide-react";
import { toast } from "sonner";
import {
  listProspectSearches,
  upsertProspectSearch,
  deleteProspectSearch,
  runProspectSearch,
  listProspectResults,
  importProspectAsLead,
} from "@/lib/prospecting.functions";
import {
  ProspectSearchFormDialog,
  type ProspectSearchFormValue,
} from "@/components/prospecting/prospect-search-form-dialog";
import { AddToProspectingDialog } from "@/components/prospecting/add-to-prospecting-dialog";
import { countActiveFilters, ProspectFilters } from "@/lib/prospecting-options";

export const Route = createFileRoute("/_authenticated/settings/prospecting")({
  beforeLoad: () => {
    throw redirect({ to: "/prospecting", search: { tab: "prospecting" as const } });
  },
  component: ProspectingPage,
});

type Row = Awaited<ReturnType<typeof listProspectSearches>>[number];
type Result = Awaited<ReturnType<typeof listProspectResults>>[number];

function rowToForm(r: Row | null): ProspectSearchFormValue {
  if (!r) return { name: "", filters: {}, instructions: "", max_results: 10 };
  const filters =
    r.filters && typeof r.filters === "object" && !Array.isArray(r.filters)
      ? (r.filters as ProspectFilters)
      : {};
  return {
    id: r.id,
    name: r.name ?? "",
    filters,
    instructions: r.instructions ?? "",
    max_results: r.max_results ?? 10,
  };
}

export function ProspectingPage() {
  const listFn = useServerFn(listProspectSearches);
  const saveFn = useServerFn(upsertProspectSearch);
  const delFn = useServerFn(deleteProspectSearch);
  const runFn = useServerFn(runProspectSearch);
  const resFn = useServerFn(listProspectResults);
  const impFn = useServerFn(importProspectAsLead);

  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProspectSearchFormValue | null>(null);
  const [saving, setSaving] = useState(false);
  const [openSearch, setOpenSearch] = useState<Row | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [queueIds, setQueueIds] = useState<string[]>([]);
  const [queueOpen, setQueueOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState<null | "import" | "queue">(null);
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(
    null,
  );

  // Importa (idempotente) os prospects informados e devolve os ids dos leads.
  const importMany = async (list: Result[]) => {
    const ids: string[] = [];
    let created = 0;
    let existing = 0;
    let failed = 0;
    let firstError = "";
    setProgress({ done: 0, total: list.length, label: "" });
    for (let i = 0; i < list.length; i += 1) {
      const r = list[i];
      setProgress({
        done: i,
        total: list.length,
        label: (r.contact_name as string) || (r.company_name as string) || "",
      });
      try {
        const out = (await impFn({ data: { result_id: r.id } })) as {
          id: string;
          already?: boolean;
        };
        ids.push(out.id);
        if (out.already) existing += 1;
        else created += 1;
      } catch (e) {
        failed += 1;
        if (!firstError) firstError = (e as Error)?.message ?? "";
      }
      setProgress({ done: i + 1, total: list.length, label: "" });
    }
    setProgress(null);
    return { ids, created, existing, failed, firstError };
  };

  const importAll = async () => {
    if (results.length === 0) return;
    setBulkBusy("import");
    try {
      const { created, existing, failed, firstError } = await importMany(results);
      if (created > 0) {
        toast.success(
          `${created} lead(s) importado(s)` +
            (existing ? ` · ${existing} já existia(m)` : "") +
            (failed ? ` · ${failed} falha(s)` : ""),
        );
      } else if (failed > 0) {
        toast.error(`Nenhum lead importado · ${failed} falha(s)`, {
          description: firstError || undefined,
        });
      } else {
        toast.info("Todos os prospects já haviam sido importados.");
      }
      if (openSearch) await openResults(openSearch);
    } finally {
      setBulkBusy(null);
    }
  };

  const addToQueueFlow = async (list: Result[], kind: "import" | "queue") => {
    if (list.length === 0) return;
    setBulkBusy(kind);
    try {
      const { ids, failed, firstError } = await importMany(list);
      if (ids.length === 0) {
        toast.error("Nenhum prospect foi importado, então a fila não foi aberta.", {
          description: firstError || undefined,
        });
        return;
      }
      if (failed) toast.warning(`${failed} prospect(s) não puderam ser importados.`);
      if (openSearch) await openResults(openSearch);
      setQueueIds(ids);
      setQueueOpen(true);
    } finally {
      setBulkBusy(null);
    }
  };


  const refresh = async () => setRows((await listFn()) as Row[]);
  useEffect(() => {
    refresh(); /* eslint-disable-next-line */
  }, []);

  const openResults = async (r: Row) => {
    setOpenSearch(r);
    setResults((await resFn({ data: { search_id: r.id } })) as Result[]);
  };

  const save = async (value: ProspectSearchFormValue) => {
    setSaving(true);
    try {
      await saveFn({
        data: {
          id: value.id ?? null,
          name: value.name,
          filters: value.filters,
          instructions: value.instructions ?? "",
          max_results: value.max_results ?? 10,
        },
      });
      toast.success("Busca salva");
      setOpen(false);
      setEditing(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar busca");
    } finally {
      setSaving(false);
    }
  };

  const runIt = async (r: Row) => {
    setRunning(r.id);
    try {
      const out = await runFn({ data: { id: r.id } });
      if (out.count === 0) {
        toast.warning(out.notice ?? "Nenhum prospect encontrado com estes filtros", {
          duration: 8000,
        });
      } else {
        toast.success(`${out.count} prospects gerados`);
      }

      await refresh();
      if (openSearch?.id === r.id) await openResults(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-lg font-semibold">Prospecting Agent</h2>
          <p className="text-sm text-muted-foreground">
            Defina seu ICP e busque prospects reais via Apollo.io para revisar e importar como
            leads.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(rowToForm(null));
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova busca
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma busca ainda.</p>
          )}
          <div className="text-sm divide-y">
            {rows.map((r) => {
              const activeFilters = countActiveFilters(
                (r.filters as ProspectFilters | null) ?? undefined,
              );
              return (
                <div key={r.id} className="py-3 flex items-center justify-between gap-3">
                  <button
                    className="text-left flex-1 min-w-0"
                    onClick={() => openResults(r)}
                  >
                    <div className="font-medium truncate flex items-center gap-2">
                      <Database className="h-3.5 w-3.5 text-primary" />
                      {String(r.name)}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[r.industry, r.role_title, r.location].filter(Boolean).join(" · ") ||
                        (activeFilters > 0
                          ? `${activeFilters} filtro${activeFilters === 1 ? "" : "s"} configurado${activeFilters === 1 ? "" : "s"}`
                          : "—")}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      Fonte: {r.source === "apollo" ? "Apollo.io" : "IA"}
                    </div>
                    {r.error && Number(r.result_count ?? 0) === 0 && (
                      <p className="text-xs text-amber-600 dark:text-amber-500 mt-1 whitespace-normal">
                        {String(r.error)}
                      </p>
                    )}

                  </button>
                  <Badge
                    variant={
                      r.status === "completed"
                        ? "default"
                        : r.status === "failed"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {String(r.status)}
                  </Badge>
                  <span className="text-xs text-muted-foreground w-16 text-right">
                    {String(r.result_count ?? 0)} prospects
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditing(rowToForm(r));
                      setOpen(true);
                    }}
                    title="Editar filtros"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => runIt(r)}
                    disabled={running === r.id}
                    title="Executar busca"
                  >
                    {running === r.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      if (confirm("Remover?")) {
                        await delFn({ data: { id: r.id } });
                        refresh();
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <ProspectSearchFormDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setEditing(null);
        }}
        initial={editing}
        onSubmit={save}
        submitting={saving}
      />

      <Sheet open={!!openSearch} onOpenChange={(v) => !v && setOpenSearch(null)}>
        <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{openSearch?.name as string}</SheetTitle>
          </SheetHeader>
          {results.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={bulkBusy !== null}
                onClick={importAll}
              >
                {bulkBusy === "import" ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <UserPlus className="h-3.5 w-3.5 mr-1" />
                )}
                Importar todos os leads
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={bulkBusy !== null}
                onClick={() => addToQueueFlow(results, "queue")}
              >
                {bulkBusy === "queue" ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <ListPlus className="h-3.5 w-3.5 mr-1" />
                )}
                Incluir todos em uma fila
              </Button>
            </div>
          )}
          {progress && progress.total > 0 && (
            <div className="mt-3 space-y-1" aria-live="polite">
              <Progress value={(progress.done / progress.total) * 100} />
              <p className="text-xs text-muted-foreground">
                Processando {progress.done} de {progress.total}
                {progress.label ? ` · ${progress.label}` : ""}
              </p>
            </div>
          )}

          <div className="mt-4 space-y-2">
            {results.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhum prospect ainda. Use ▶ para executar.
              </p>
            )}
            {results.map((r) => (
              <Card key={r.id}>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">
                        {String(r.contact_name || "—")}
                        {r.role_title ? (
                          <span className="text-muted-foreground text-xs ml-1">
                            · {String(r.role_title)}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Building2 className="h-3 w-3" />
                        {String(r.company_name || "—")}
                      </div>
                    </div>
                    <Badge variant="outline">{r.source === "apollo" ? "Apollo.io" : "IA"}</Badge>
                  </div>

                  <div className="text-xs space-y-1">
                    {r.industry ? (
                      <div className="text-muted-foreground">Segmento: {String(r.industry)}</div>
                    ) : null}
                    {r.company_size ? (
                      <div className="text-muted-foreground">
                        Funcionários: {String(r.company_size)}
                      </div>
                    ) : null}
                    {r.location ? (
                      <div className="text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {String(r.location)}
                      </div>
                    ) : null}
                    {r.email ? (
                      <div className="flex items-center gap-1 text-foreground">
                        <Mail className="h-3 w-3" />
                        {String(r.email)}
                      </div>
                    ) : r.email_hint ? (
                      <div className="text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {String(r.email_hint)}
                      </div>
                    ) : null}
                    {r.phone ? (
                      <div className="flex items-center gap-1 text-foreground">
                        <Phone className="h-3 w-3" />
                        {String(r.phone)}
                      </div>
                    ) : null}
                    {r.linkedin_url ? (
                      <a
                        href={String(r.linkedin_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        <Linkedin className="h-3 w-3" />
                        LinkedIn
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                  </div>

                  {r.reason ? (
                    <p className="text-xs text-muted-foreground italic">{String(r.reason)}</p>
                  ) : null}

                  <div className="pt-1 flex flex-wrap items-center gap-2">
                    {r.imported_lead_id ? (
                      <Badge variant="secondary">Importado</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            await impFn({ data: { result_id: r.id } });
                            toast.success("Lead criado");
                            if (openSearch) await openResults(openSearch);
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Erro");
                          }
                        }}
                      >
                        <UserPlus className="h-3.5 w-3.5 mr-1" />
                        Importar como Lead
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={bulkBusy !== null}
                      onClick={() => addToQueueFlow([r], "queue")}
                    >
                      <ListPlus className="h-3.5 w-3.5 mr-1" />
                      Incluir na fila
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <AddToProspectingDialog
        open={queueOpen}
        onOpenChange={(v) => {
          setQueueOpen(v);
          if (!v) setQueueIds([]);
        }}
        ids={queueIds}
      />
    </div>
  );
}
