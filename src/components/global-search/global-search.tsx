import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueries, useQuery, useQueryClient, type Query } from "@tanstack/react-query";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Sparkles,
  Loader2,
  Pin,
  PinOff,
  Clock,
  Users,
  Building2,
  Handshake,
  Ticket,
  Activity,
  UserPlus,
  Briefcase,
  ArrowRight,
} from "lucide-react";
import { globalSearch, type SearchHit } from "@/lib/search/global-search.functions";
import {
  listPinned,
  listRecent,
  recordRecent,
  togglePin,
} from "@/lib/search/recent-pinned.functions";
import { askCopilot } from "@/lib/copilot.functions";
import { QUICK_COMMANDS } from "./commands";
import { Highlight } from "./highlight";
import { cn } from "@/lib/utils";

const ICONS: Record<SearchHit["entity_type"], typeof Users> = {
  contact: Users,
  company: Building2,
  deal: Handshake,
  ticket: Ticket,
  activity: Activity,
  candidate: UserPlus,
  job: Briefcase,
};

const TYPE_LABELS: Array<{ id: SearchHit["entity_type"]; label: string }> = [
  { id: "contact", label: "Contatos" },
  { id: "company", label: "Empresas" },
  { id: "deal", label: "Negócios" },
  { id: "ticket", label: "Tickets" },
  { id: "activity", label: "Atividades" },
  { id: "candidate", label: "Candidatos" },
  { id: "job", label: "Vagas" },
];

/** Mínimo de caracteres: 1 letra casa com quase tudo e não ajuda a achar. */
const MIN_QUERY = 3;
const SEARCH_TYPES: SearchHit["entity_type"][] = [
  "contact",
  "company",
  "deal",
  "ticket",
  "activity",
  "candidate",
  "job",
];

function useDebounced<T>(value: T, delay = 150): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export function GlobalSearch() {
  const { user } = useAuth();
  const permissions = usePermissions();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [types, setTypes] = useState<SearchHit["entity_type"][]>([]);
  const [aiMode, setAiMode] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);

  const debouncedQ = useDebounced(q, 250);
  const navigate = useNavigate();

  const queryClient = useQueryClient();
  const search = useServerFn(globalSearch);
  const recent = useServerFn(listRecent);
  const pinned = useServerFn(listPinned);
  const record = useServerFn(recordRecent);
  const pin = useServerFn(togglePin);
  const ask = useServerFn(askCopilot);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("global-search:open", onOpen as EventListener);
    window.addEventListener("copilot:open", onOpen as EventListener);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("global-search:open", onOpen as EventListener);
      window.removeEventListener("copilot:open", onOpen as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setQ("");
      setAiMode(false);
      setAiAnswer("");
      setTypes([]);
    }
  }, [open]);

  const isCommandMode = q.trim().startsWith("/");
  const contextReady =
    !!user && !!permissions.workspaceId && !permissions.isLoading && !permissions.isError;
  const permissionScope = [...(permissions.permissions ?? [])]
    .filter((key) =>
      /^(techsales\.(contacts|companies|deals|tickets|activities|notes|tasks)|techhire\.(candidates|jobs))\.view\./.test(
        key,
      ),
    )
    .sort()
    .join("|");
  const termReady = q.trim() === debouncedQ.trim();
  useEffect(() => {
    if (!open || !termReady || aiMode || !contextReady) {
      void queryClient.cancelQueries({
        queryKey: ["global-search", user?.id, permissions.workspaceId],
      });
      if (!open || !contextReady) {
        void queryClient.cancelQueries({
          queryKey: ["global-search-recent", user?.id, permissions.workspaceId],
        });
        void queryClient.cancelQueries({
          queryKey: ["global-search-pinned", user?.id, permissions.workspaceId],
        });
      }
    }
  }, [open, termReady, aiMode, contextReady, user?.id, permissions.workspaceId, queryClient]);
  const searchEnabled =
    open &&
    contextReady &&
    termReady &&
    !isCommandMode &&
    debouncedQ.trim().length >= MIN_QUERY &&
    !aiMode;

  // Uma consulta por tipo: cada grupo aparece assim que fica pronto e uma
  // falha isolada não derruba os demais.
  const activeTypes = types.length ? types : SEARCH_TYPES;
  const requests = activeTypes.flatMap<{
    type: SearchHit["entity_type"];
    part: "subject" | "content" | undefined;
  }>((type) =>
    type === "activity"
      ? [
          { type, part: "subject" as const },
          { type, part: "content" as const },
        ]
      : [{ type, part: undefined }],
  );
  const perType = useQueries({
    queries: requests.map(({ type, part }) => ({
      queryKey: [
        "global-search",
        user?.id,
        permissions.workspaceId,
        permissionScope,
        debouncedQ.trim(),
        type,
        part,
      ],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        search({ data: { q: debouncedQ.trim(), types: [type], activityPart: part }, signal }),
      enabled: searchEnabled,
      staleTime: (query: Query<Awaited<ReturnType<typeof globalSearch>>>) =>
        query.state.data?.partial ? 0 : 30_000,
      gcTime: 60_000,
      retry: false,
      refetchOnWindowFocus: false,
    })),
  });
  const contentIndex = requests.findIndex((r) => r.part === "content");
  const results = {
    isLoading: searchEnabled && perType.every((r) => r.isLoading),
    isFetchingSome: searchEnabled && perType.some((r) => r.isFetching),
    failed: searchEnabled && perType.some((r) => r.isError),
    partial: searchEnabled && perType.some((r) => r.data?.partial),
    contentPending: searchEnabled && contentIndex >= 0 && perType[contentIndex].isFetching,
    data: {
      groups: !searchEnabled
        ? []
        : SEARCH_TYPES.flatMap((type) => {
            const hits = new Map<string, SearchHit>();
            let label = "";
            requests.forEach((r, i) => {
              if (r.type !== type) return;
              for (const group of perType[i]?.data?.groups ?? []) {
                label = group.label;
                for (const item of group.items) {
                  const old = hits.get(item.entity_id);
                  // Content enriches a subject hit without rendering it twice.
                  hits.set(
                    item.entity_id,
                    old
                      ? { ...old, subtitle: r.part === "content" ? item.subtitle : old.subtitle }
                      : item,
                  );
                }
              }
            });
            return hits.size ? [{ type, label, items: [...hits.values()].slice(0, 5) }] : [];
          }),
    },
  };

  const recents = useQuery({
    queryKey: ["global-search-recent", user?.id, permissions.workspaceId, permissionScope],
    queryFn: ({ signal }) => recent({ signal }),
    enabled: open && contextReady,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  const pinneds = useQuery({
    queryKey: ["global-search-pinned", user?.id, permissions.workspaceId, permissionScope],
    queryFn: ({ signal }) => pinned({ signal }),
    enabled: open && contextReady,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  const filteredCommands = useMemo(() => {
    const query = debouncedQ.replace(/^\//, "").toLowerCase().trim();
    if (!isCommandMode) return [];
    return QUICK_COMMANDS.filter(
      (c) =>
        !query ||
        c.label.toLowerCase().includes(query) ||
        c.keywords.some((k) => k.includes(query)),
    );
  }, [debouncedQ, isCommandMode]);

  function handleSelect(hit: SearchHit) {
    setOpen(false);
    void record({
      data: {
        entity_type: hit.entity_type,
        entity_id: hit.entity_id,
        title: hit.title,
        url: hit.url,
      },
    });
    navigate({ to: hit.url });
  }

  async function handleTogglePin(hit: SearchHit, e: React.MouseEvent) {
    e.stopPropagation();
    await pin({
      data: {
        entity_type: hit.entity_type,
        entity_id: hit.entity_id,
        title: hit.title,
        url: hit.url,
      },
    }).catch((err) => console.error(err));
    void pinneds.refetch();
  }

  async function runAI() {
    if (!debouncedQ.trim()) return;
    setAiMode(true);
    setAiLoading(true);
    setAiAnswer("");
    try {
      const r = await ask({ data: { question: debouncedQ } });
      setAiAnswer(r.answer);
    } catch (e) {
      setAiAnswer(e instanceof Error ? e.message : "Erro no Copilot.");
    } finally {
      setAiLoading(false);
    }
  }

  const groups = results.data?.groups ?? [];
  const hasQuery = q.trim().length > 0;
  const hasResults = groups.some((g) => g.items.length > 0);
  const showEmpty =
    searchEnabled &&
    hasQuery &&
    debouncedQ.trim().length >= MIN_QUERY &&
    !isCommandMode &&
    !results.isFetchingSome &&
    !results.failed &&
    !results.partial &&
    !hasResults &&
    !aiMode;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Buscar em tudo… (use / para comandos)"
        value={q}
        onValueChange={setQ}
      />
      {/* Type filter chips */}
      {!isCommandMode && !aiMode && (
        <div className="flex flex-wrap items-center gap-1.5 border-b px-3 py-2">
          {TYPE_LABELS.map((t) => {
            const active = types.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() =>
                  setTypes((prev) => (active ? prev.filter((x) => x !== t.id) : [...prev, t.id]))
                }
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                {t.label}
              </button>
            );
          })}
          {types.length > 0 && (
            <button
              type="button"
              onClick={() => setTypes([])}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              limpar
            </button>
          )}
        </div>
      )}

      <CommandList className="max-h-[420px]">
        {results.contentPending && (
          <p role="status" className="px-4 py-2 text-xs text-muted-foreground">
            Buscando no conteúdo das atividades… Os demais resultados já podem ser abertos.
          </p>
        )}
        {results.partial && !aiMode && !isCommandMode && (
          <p role="status" className="px-4 py-2 text-xs text-muted-foreground">
            Resultados parciais: a busca no conteúdo das atividades não terminou. Refine o termo e
            tente novamente.
          </p>
        )}
        {/* AI mode */}
        {aiMode && (
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4" /> Copilot
            </div>
            {aiLoading ? (
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Consultando…
              </div>
            ) : (
              <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                {aiAnswer || "Sem resposta."}
              </div>
            )}
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => {
                setAiMode(false);
                setAiAnswer("");
              }}
            >
              ← voltar aos resultados
            </button>
          </div>
        )}

        {/* Commands mode */}
        {!aiMode && isCommandMode && (
          <>
            {filteredCommands.length === 0 && (
              <CommandEmpty>Nenhum comando encontrado.</CommandEmpty>
            )}
            {(["Navegar", "Criar", "Configurar"] as const).map((g) => {
              const items = filteredCommands.filter((c) => c.group === g);
              if (items.length === 0) return null;
              return (
                <CommandGroup key={g} heading={g}>
                  {items.map((c) => {
                    const Icon = c.icon;
                    return (
                      <CommandItem
                        key={c.id}
                        onSelect={() => {
                          setOpen(false);
                          navigate({ to: c.to });
                        }}
                      >
                        <Icon className="mr-2 h-4 w-4" />
                        {c.label}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              );
            })}
          </>
        )}

        {!hasQuery && (recents.isError || pinneds.isError) && (
          <p role="status" className="px-4 py-2 text-xs text-muted-foreground">
            Não foi possível carregar recentes ou fixados. A busca continua disponível.
          </p>
        )}
        {/* Default (no query): pinned + recent */}
        {!aiMode && !isCommandMode && !hasQuery && contextReady && (
          <>
            {!pinneds.isFetching && !pinneds.isError && (pinneds.data?.items?.length ?? 0) > 0 && (
              <CommandGroup heading="Fixados">
                {pinneds.data!.items.map((it) => (
                  <CommandItem
                    key={`p-${it.entity_type}-${it.entity_id}`}
                    onSelect={() => {
                      setOpen(false);
                      navigate({ to: it.url });
                    }}
                  >
                    <Pin className="mr-2 h-4 w-4 text-primary" />
                    <span className="flex-1 truncate">{it.title}</span>
                    <span className="text-xs text-muted-foreground">{it.entity_type}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {!recents.isFetching && !recents.isError && (recents.data?.items?.length ?? 0) > 0 && (
              <CommandGroup heading="Recentes">
                {recents.data!.items.map((it) => (
                  <CommandItem
                    key={`r-${it.entity_type}-${it.entity_id}`}
                    onSelect={() => {
                      setOpen(false);
                      navigate({ to: it.url });
                    }}
                  >
                    <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 truncate">{it.title}</span>
                    <span className="text-xs text-muted-foreground">{it.entity_type}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {(recents.isFetching || pinneds.isFetching) && (
              <p role="status" className="px-4 py-2 text-xs text-muted-foreground">
                Atualizando recentes e fixados…
              </p>
            )}
            {!recents.isFetching &&
              !pinneds.isFetching &&
              (pinneds.data?.items?.length ?? 0) === 0 &&
              (recents.data?.items?.length ?? 0) === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Comece a digitar para buscar em contatos, empresas, negócios, tickets, candidatos,
                  vagas… ou use <kbd className="rounded border px-1">/</kbd> para comandos.
                </div>
              )}
          </>
        )}

        {/* Search results */}
        {!aiMode && !isCommandMode && hasQuery && (
          <>
            {q.trim().length < MIN_QUERY && (
              <div className="p-4 text-sm text-muted-foreground">
                Digite pelo menos {MIN_QUERY} caracteres para buscar.
              </div>
            )}
            {q.trim().length >= MIN_QUERY && !termReady && (
              <p role="status" className="px-4 py-2 text-xs text-muted-foreground">
                Preparando busca…
              </p>
            )}
            {results.isFetchingSome && (
              <div
                className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground"
                aria-live="polite"
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando…
              </div>
            )}
            {results.failed && !results.isFetchingSome && (
              <div className="px-4 py-2 text-xs text-muted-foreground" role="status">
                Alguns grupos não puderam ser buscados agora. Tente de novo em instantes.
              </div>
            )}
            {!results.isFetchingSome && (results.failed || results.partial) && (
              <button
                type="button"
                className="mx-4 mb-2 text-xs text-primary underline"
                onClick={() => {
                  for (const result of perType)
                    if (result.isError || result.data?.partial) void result.refetch();
                }}
              >
                Tentar grupos pendentes
              </button>
            )}
            {groups.map((g) => {
              const Icon = ICONS[g.type];
              const isPinned = (hit: SearchHit) =>
                (pinneds.data?.items ?? []).some(
                  (p) => p.entity_type === hit.entity_type && p.entity_id === hit.entity_id,
                );
              return (
                <CommandGroup forceMount key={g.type} heading={g.label}>
                  {g.items.map((hit) => (
                    <CommandItem
                      forceMount
                      key={`${hit.entity_type}-${hit.entity_id}`}
                      value={`${hit.entity_type}-${hit.entity_id}-${hit.title}`}
                      onSelect={() => handleSelect(hit)}
                      className="group"
                    >
                      <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate">
                          <Highlight text={hit.title} query={debouncedQ} />
                        </div>
                        {hit.subtitle && (
                          <div className="truncate text-xs text-muted-foreground">
                            <Highlight text={hit.subtitle} query={debouncedQ} />
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleTogglePin(hit, e)}
                        className="ml-2 opacity-0 transition-opacity group-hover:opacity-100"
                        aria-label={isPinned(hit) ? "Desafixar" : "Fixar"}
                      >
                        {isPinned(hit) ? (
                          <PinOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Pin className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
            {showEmpty && (
              <div className="p-6 text-center text-sm text-muted-foreground space-y-3">
                <div>Nenhum resultado para "{debouncedQ}".</div>
                <button
                  type="button"
                  onClick={runAI}
                  className="inline-flex items-center gap-2 rounded-md border bg-primary/10 px-3 py-1.5 text-sm text-primary hover:bg-primary/20"
                >
                  <Sparkles className="h-4 w-4" />
                  Perguntar ao Copilot
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        )}
      </CommandList>

      <CommandSeparator />
      <div className="flex items-center justify-between px-3 py-2 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span>
            <kbd className="rounded border px-1">↑↓</kbd> navegar
          </span>
          <span>
            <kbd className="rounded border px-1">↵</kbd> abrir
          </span>
          <span>
            <kbd className="rounded border px-1">/</kbd> comandos
          </span>
          <span>
            <kbd className="rounded border px-1">esc</kbd> fechar
          </span>
        </div>
        {hasQuery && !aiMode && (
          <button
            type="button"
            onClick={runAI}
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <Sparkles className="h-3.5 w-3.5" /> Perguntar ao Copilot
          </button>
        )}
      </div>
    </CommandDialog>
  );
}
