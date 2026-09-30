import { useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, Check, ChevronDown, Star, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { useSavedViews, type SavedView } from "@/lib/saved-views";
import { useCurrentUserId } from "@/hooks/use-current-user-id";
import { sanitizeState } from "@/lib/grid-filters";
import type { GridFiltersController } from "@/hooks/use-grid-filters";
import type { SortState } from "@/lib/grid-client-sort";

type Payload = { grid?: unknown; q?: string };

export function GridSavedViewsMenu<T, K extends string>({
  ctl,
  sort,
  setSort,
  query,
  setQuery,
}: {
  ctl: GridFiltersController<T>;
  sort: SortState<K>;
  setSort: (s: SortState<K>) => void;
  query: string;
  setQuery: (q: string) => void;
}) {
  const me = useCurrentUserId();
  const views = useSavedViews(ctl.entity);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");
  const [shared, setShared] = useState(false);
  const appliedDefault = useRef(false);

  const visible = useMemo(
    () => (views.data ?? []).filter((v) => v.owner_id === me || v.is_shared),
    [views.data, me],
  );
  const mine = visible.filter((v) => v.owner_id === me);
  const others = visible.filter((v) => v.owner_id !== me);
  const active = visible.find((v) => v.id === activeId) ?? null;

  const apply = (v: SavedView) => {
    const p = (v.filters ?? {}) as unknown as Payload;
    ctl.setState(sanitizeState(p.grid, ctl.fields));
    setQuery(typeof p.q === "string" ? p.q : "");
    setSort(v.sort_by ? ({ key: v.sort_by as K, dir: v.sort_dir ?? "asc" } as SortState<K>) : null);
    setActiveId(v.id);
  };

  // Aplica a visão padrão do usuário uma única vez, ao carregar.
  useEffect(() => {
    if (appliedDefault.current || !me || !views.data) return;
    appliedDefault.current = true;
    const def = mine.find((v) => v.is_default);
    if (def) apply(def);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, views.data]);

  const payload = () => ({
    filters: { grid: ctl.state, q: query } as never,
    sort_by: sort?.key ?? null,
    sort_dir: sort?.dir ?? null,
  });

  const saveNew = async () => {
    if (!name.trim()) return toast.error("Informe um nome para a visão.");
    try {
      const created = await views.create.mutateAsync({
        name: name.trim(),
        is_shared: shared,
        ...payload(),
      });
      setActiveId(created.id);
      setSaveOpen(false);
      setName("");
      setShared(false);
      toast.success("Visão salva");
    } catch (e) {
      toast.error((e as Error)?.message ?? "Não foi possível salvar a visão.");
    }
  };

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error((e as Error)?.message ?? "Não foi possível concluir.");
    }
  };

  const makeDefault = (v: SavedView) =>
    run(
      async () => {
        for (const o of mine.filter((x) => x.is_default && x.id !== v.id))
          await views.update.mutateAsync({ id: o.id, patch: { is_default: false } });
        await views.update.mutateAsync({ id: v.id, patch: { is_default: !v.is_default } });
      },
      v.is_default ? "Visão deixou de ser a padrão" : "Visão definida como padrão",
    );

  const isMine = active && active.owner_id === me;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="max-w-64">
            <Bookmark className="mr-1.5 h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{active ? `Visão: ${active.name}` : "Visões"}</span>
            <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {views.isLoading && (
            <DropdownMenuLabel className="text-xs font-normal">Carregando…</DropdownMenuLabel>
          )}
          {views.isError && (
            <DropdownMenuLabel className="text-xs font-normal text-destructive">
              Não foi possível carregar as visões.
            </DropdownMenuLabel>
          )}
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Minhas visões
          </DropdownMenuLabel>
          {mine.length === 0 && !views.isLoading && (
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Nenhuma visão salva ainda.
            </DropdownMenuLabel>
          )}
          {mine.map((v) => (
            <DropdownMenuItem key={v.id} onSelect={() => apply(v)} className="justify-between">
              <span className="flex items-center gap-2 truncate">
                {v.id === activeId ? (
                  <Check className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <span className="w-3.5" />
                )}
                {v.name}
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                {v.is_shared && <Users className="h-3.5 w-3.5" aria-label="Compartilhada" />}
                {v.is_default && <Star className="h-3.5 w-3.5 fill-current" aria-label="Padrão" />}
              </span>
            </DropdownMenuItem>
          ))}
          {others.length > 0 && (
            <>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Do workspace
              </DropdownMenuLabel>
              {others.map((v) => (
                <DropdownMenuItem key={v.id} onSelect={() => apply(v)}>
                  {v.id === activeId ? (
                    <Check className="mr-2 h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <span className="mr-2 w-3.5" />
                  )}
                  {v.name}
                </DropdownMenuItem>
              ))}
            </>
          )}
          <DropdownMenuSeparator />
          {isMine && (
            <DropdownMenuItem
              onSelect={() =>
                void run(
                  () => views.update.mutateAsync({ id: active.id, patch: payload() }),
                  "Visão atualizada",
                )
              }
            >
              Salvar alterações nesta visão
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setSaveOpen(true)}>
            Salvar como nova visão…
          </DropdownMenuItem>
          {isMine && (
            <>
              <DropdownMenuItem onSelect={() => void makeDefault(active)}>
                {active.is_default ? "Deixar de ser padrão" : "Tornar padrão"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  void run(
                    () =>
                      views.update.mutateAsync({
                        id: active.id,
                        patch: { is_shared: !active.is_shared },
                      }),
                    active.is_shared
                      ? "Visão deixou de ser compartilhada"
                      : "Visão compartilhada com o workspace",
                  )
                }
              >
                {active.is_shared ? "Parar de compartilhar" : "Compartilhar com o workspace"}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={async () => {
                  const ok = await confirmDialog({
                    title: "Excluir visão?",
                    description: `A visão "${active.name}" será excluída. Os registros não são afetados.`,
                    confirmLabel: "Excluir",
                    variant: "destructive",
                  });
                  if (!ok) return;
                  await run(() => views.remove.mutateAsync(active.id), "Visão excluída");
                  setActiveId(null);
                }}
              >
                Excluir visão
              </DropdownMenuItem>
            </>
          )}
          {active && (
            <DropdownMenuItem
              onSelect={() => {
                setActiveId(null);
                ctl.clear();
                setQuery("");
                setSort(null);
              }}
            >
              Voltar à lista completa
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Salvar visão</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="gv-name">Nome</Label>
              <Input
                id="gv-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Urgentes da semana"
                maxLength={80}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="gv-shared"
                checked={shared}
                onCheckedChange={(c) => setShared(Boolean(c))}
              />
              <Label htmlFor="gv-shared" className="font-normal">
                Compartilhar com o workspace
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Guarda os filtros, a busca e a ordenação atuais.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void saveNew()} disabled={views.create.isPending}>
              {views.create.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
