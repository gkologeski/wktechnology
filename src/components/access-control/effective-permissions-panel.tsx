// Painel "Permissão efetiva": para uma pessoa, mostra a chave efetiva e de onde vem
// (cargos, conjuntos extras, concessões, proibições e acesso de administrador).
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Loader2, Search } from "lucide-react";
import { SectionHeader, EmptyState, Skeletons } from "@/components/techhire/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listWorkspaceMembersForDiagnostics } from "@/lib/access-control/rbac-diagnostics.functions";
import { getEffectivePermissionOrigins } from "@/lib/access-control/effective-origins.functions";

type Filter = "effective" | "denied" | "all";

export function EffectivePermissionsPanel() {
  const listMembers = useServerFn(listWorkspaceMembersForDiagnostics);
  const getOrigins = useServerFn(getEffectivePermissionOrigins);
  const [userId, setUserId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("effective");

  const members = useQuery({ queryKey: ["rbac-members"], queryFn: () => listMembers() });
  const origins = useQuery({
    queryKey: ["rbac-effective-origins", userId],
    queryFn: () => getOrigins({ data: { user_id: userId } }),
    enabled: !!userId,
  });

  const rows = useMemo(() => {
    const all = origins.data?.origins ?? [];
    const q = search.trim().toLowerCase();
    return all.filter((o) => {
      if (filter === "effective" && !o.db_effective) return false;
      if (filter === "denied" && o.deniedBy.length === 0) return false;
      return !q || o.key.toLowerCase().includes(q) || o.sources.some((s) => s.toLowerCase().includes(q));
    });
  }, [origins.data, search, filter]);

  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface p-4" aria-labelledby="eff-title">
      <SectionHeader
        title="Permissão efetiva por pessoa"
        description="O que a pessoa realmente pode fazer e de onde vem: cargos, conjuntos extras, concessões, proibições e acesso de administrador."
      />
      <div className="grid gap-3 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)_auto]">
        <div className="space-y-1">
          <Label htmlFor="eff-user">Pessoa</Label>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger id="eff-user" aria-label="Escolher pessoa">
              <SelectValue placeholder={members.isLoading ? "Carregando…" : "Escolha uma pessoa"} />
            </SelectTrigger>
            <SelectContent>
              {(members.data ?? []).map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>
                  {m.full_name ?? "Sem nome"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="eff-search">Buscar chave ou origem</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-text-tertiary" aria-hidden />
            <Input id="eff-search" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="eff-filter">Mostrar</Label>
          <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <SelectTrigger id="eff-filter" className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="effective">Só efetivas</SelectItem>
              <SelectItem value="denied">Com proibição</SelectItem>
              <SelectItem value="all">Todas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {!userId ? (
        <EmptyState title="Escolha uma pessoa" description="A lista mostra a permissão efetiva calculada pelo banco." />
      ) : origins.isLoading ? (
        <Skeletons.Table rows={6} />
      ) : origins.isError ? (
        <div role="alert" className="flex items-center justify-between rounded-md border border-destructive/40 p-3 text-sm text-destructive">
          <span>{(origins.error as Error).message}</span>
          <Button size="sm" variant="outline" onClick={() => origins.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : origins.data ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">{origins.data.is_active ? "Membro ativo" : "Membro inativo"}</Badge>
            {origins.data.is_admin_bypass ? <Badge variant="outline">Acesso de administrador</Badge> : null}
            {origins.data.roles.map((r) => (
              <Badge key={r.id} variant="secondary">Cargo: {r.name}</Badge>
            ))}
            {origins.data.extra_sets.map((s) => (
              <Badge key={s.id} variant="secondary">Conjunto extra: {s.name}</Badge>
            ))}
            <Badge variant="outline">{origins.data.origins.filter((o) => o.db_effective).length} efetivas</Badge>
          </div>
          {[...origins.data.warnings, ...origins.data.dependency_gaps.map((g) => ({
            kind: "dep",
            message: `${g.key} depende de ${g.requires}, que não está efetiva.`,
          }))].map((w, i) => (
            <p key={i} role="status" className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 p-2 text-xs text-text-primary">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
              {w.message}
            </p>
          ))}
          {origins.data.mismatches > 0 ? (
            <p role="status" className="text-xs text-warning">
              {origins.data.mismatches} chave(s) com explicação diferente do banco; vale o que o banco calcula.
            </p>
          ) : null}
          {rows.length === 0 ? (
            <EmptyState title="Nada encontrado" description="Ajuste a busca ou o filtro." />
          ) : (
            <div className="max-h-[480px] overflow-auto rounded-md border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-surface-muted text-left text-text-secondary">
                  <tr>
                    <th className="p-2 font-medium">Chave</th>
                    <th className="p-2 font-medium">Efetiva</th>
                    <th className="p-2 font-medium">Origem</th>
                    <th className="p-2 font-medium">Proibida por</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 500).map((o) => (
                    <tr key={o.key} className="border-t border-border align-top">
                      <td className="p-2 font-mono break-all">{o.key}</td>
                      <td className="p-2">{o.db_effective ? "Sim" : "Não"}</td>
                      <td className="p-2 text-text-secondary">{o.sources.join(" · ") || "—"}</td>
                      <td className="p-2 text-text-secondary">{o.deniedBy.join(", ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 500 ? (
                <p className="p-2 text-xs text-text-tertiary">Mostrando 500 de {rows.length}; refine a busca.</p>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
      {origins.isFetching && !origins.isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-text-tertiary" aria-label="Atualizando" />
      ) : null}
    </section>
  );
}
