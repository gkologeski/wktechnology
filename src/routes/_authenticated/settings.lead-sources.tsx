import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth";
import {
  countLeadsBySource,
  deleteLeadSource,
  ensureLeadSource,
  leadSourcesKey,
  listLeadSources,
  sourceDisplayLabel,
  updateLeadSource,
  type LeadSource,
} from "@/lib/lead-sources";

export const Route = createFileRoute("/_authenticated/settings/lead-sources")({
  component: LeadSourcesPage,
});

function LeadSourcesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState<LeadSource | null>(null);

  const sources = useQuery({
    queryKey: leadSourcesKey(false),
    queryFn: () => listLeadSources(false),
  });

  const names = useMemo(() => (sources.data ?? []).map((s) => s.name), [sources.data]);
  const counts = useQuery({
    queryKey: ["lead-source-counts", names.join("|")],
    queryFn: () => countLeadsBySource(names),
    enabled: names.length > 0,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["lead-sources"] });
    void queryClient.invalidateQueries({ queryKey: ["lead-source-counts"] });
  };

  const onError = (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro inesperado");

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessão expirada.");
      await ensureLeadSource(user.id, name, label);
    },
    onSuccess: () => {
      setName("");
      setLabel("");
      toast.success("Fonte adicionada");
      refresh();
    },
    onError,
  });

  const patch = useMutation({
    mutationFn: (args: { id: string; patch: Parameters<typeof updateLeadSource>[1] }) =>
      updateLeadSource(args.id, args.patch),
    onSuccess: refresh,
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteLeadSource(id),
    onSuccess: () => {
      setConfirm(null);
      toast.success("Fonte removida");
      refresh();
    },
    onError: (e) => {
      setConfirm(null);
      onError(e);
    },
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = sources.data ?? [];
    if (!term) return list;
    return list.filter(
      (s) =>
        s.name.toLowerCase().includes(term) || sourceDisplayLabel(s).toLowerCase().includes(term),
    );
  }, [sources.data, search]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Fontes de lead"
        description="Catálogo de origens usadas ao criar leads. O rótulo é o texto exibido na interface; o nome é o valor gravado no lead (inclusive o vindo de integrações)."
      />

      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="source-name">Nome (valor)</Label>
            <Input
              id="source-name"
              placeholder="Ex.: REFERRALS, site, indicacao"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && name.trim() && create.mutate()}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="source-label">Rótulo em português (opcional)</Label>
            <Input
              id="source-label"
              placeholder="Ex.: Indicações"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && name.trim() && create.mutate()}
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={() => create.mutate()}
              disabled={create.isPending || !name.trim()}
              className="w-full sm:w-auto"
            >
              <Plus className="h-4 w-4 mr-1" aria-hidden="true" /> Adicionar
            </Button>
          </div>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search
          className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          aria-label="Buscar fonte"
          placeholder="Buscar fonte…"
          className="pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="rounded-lg border bg-card divide-y">
        {sources.isLoading ? (
          <div className="p-3 space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : sources.error ? (
          <div className="p-6 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Não foi possível carregar as fontes: {(sources.error as Error).message}
            </p>
            <Button variant="outline" size="sm" onClick={() => void sources.refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground text-center">
            {search.trim()
              ? "Nenhuma fonte encontrada para esta busca."
              : "Nenhuma fonte cadastrada. Adicione a primeira acima."}
          </p>
        ) : (
          rows.map((r) => {
            const total = counts.data?.[r.name] ?? 0;
            return (
              <div
                key={r.id}
                className="p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"
              >
                <Input
                  aria-label={`Nome da fonte ${r.name}`}
                  defaultValue={r.name}
                  className="h-8 sm:flex-1"
                  onBlur={(e) =>
                    e.target.value.trim() !== r.name &&
                    patch.mutate({ id: r.id, patch: { name: e.target.value } })
                  }
                />
                <Input
                  aria-label={`Rótulo da fonte ${r.name}`}
                  defaultValue={r.label ?? ""}
                  placeholder={sourceDisplayLabel(r)}
                  className="h-8 sm:flex-1"
                  onBlur={(e) =>
                    (e.target.value.trim() || null) !== (r.label ?? null) &&
                    patch.mutate({ id: r.id, patch: { label: e.target.value } })
                  }
                />
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="shrink-0">
                    {counts.isLoading ? "…" : `${total} lead${total === 1 ? "" : "s"}`}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {r.active ? "Ativa" : "Inativa"}
                    </span>
                    <Switch
                      checked={r.active}
                      aria-label={`Ativar fonte ${sourceDisplayLabel(r)}`}
                      onCheckedChange={(v) => patch.mutate({ id: r.id, patch: { active: v } })}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remover fonte ${sourceDisplayLabel(r)}`}
                    onClick={() => setConfirm(r)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <AlertDialog open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remover “{confirm ? sourceDisplayLabel(confirm) : ""}”?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm && (counts.data?.[confirm.name] ?? 0) > 0
                ? `${counts.data?.[confirm.name]} lead(s) mantêm o texto original. Esta ação apenas remove a opção do catálogo.`
                : "Leads existentes mantêm o texto original. Esta ação apenas remove a opção do catálogo."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirm && remove.mutate(confirm.id)}
              disabled={remove.isPending}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
