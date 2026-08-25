import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ShieldCheck, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getMyPermissionsDetailed,
  type MyPermissionDetail,
} from "@/lib/access-control/permissions.functions";

export const Route = createFileRoute("/_authenticated/settings/my-permissions")({
  component: MyPermissionsPage,
});

function MyPermissionsPage() {
  const fetchPerms = useServerFn(getMyPermissionsDetailed);
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["my-permissions-detailed"],
    queryFn: () => fetchPerms(),
    staleTime: 5 * 60_000,
  });

  const grouped = useMemo(() => {
    const items = (data?.items ?? []) as MyPermissionDetail[];
    const filtered = q.trim()
      ? items.filter((it) => {
          const needle = q.toLowerCase();
          return (
            it.key.toLowerCase().includes(needle) ||
            (it.label_pt ?? "").toLowerCase().includes(needle) ||
            (it.description ?? "").toLowerCase().includes(needle)
          );
        })
      : items;
    const map = new Map<string, MyPermissionDetail[]>();
    for (const it of filtered) {
      const k = it.module ?? "outros";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(it);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [data, q]);

  const total = data?.items.length ?? 0;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" /> Minhas permissões
        </h1>
        <p className="text-sm text-muted-foreground">
          Lista de tudo o que seu perfil de acesso permite fazer neste workspace. Se algo aqui
          estiver faltando, peça ao administrador para revisar seu cargo.
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por permissão, módulo ou descrição"
          className="pl-9"
        />
      </div>

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {!isLoading && total === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Nenhuma permissão atribuída</CardTitle>
            <CardDescription>
              Seu usuário ainda não possui um cargo com permissões neste workspace. Peça ao
              administrador para atribuir um perfil de acesso.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {!isLoading && total > 0 && grouped.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhuma permissão corresponde ao filtro.</p>
      )}

      {grouped.map(([module, items]) => (
        <Card key={module}>
          <CardHeader>
            <CardTitle className="capitalize">{module}</CardTitle>
            <CardDescription>{items.length} permissão(ões)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {items.map((it) => (
              <div
                key={it.key}
                className="border rounded-md p-3 flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-medium">{it.label_pt ?? it.key}</div>
                  {it.description && (
                    <div className="text-sm text-muted-foreground">{it.description}</div>
                  )}
                  <code className="text-xs text-muted-foreground break-all">{it.key}</code>
                </div>
                {it.scope && (
                  <Badge variant="secondary" className="shrink-0">
                    {it.scope}
                  </Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
