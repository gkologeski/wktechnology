// /settings/hubspot-users — diretório de owners importados do HubSpot.
// Mostra status (ativo/arquivado) espelhado do HubSpot, vínculo com usuário real e
// permite vincular manualmente a um membro do workspace. Sem envio de convites.
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { RefreshCw } from "lucide-react";
import {
  listHubspotOwners,
  syncHubspotOwners,
  setHubspotOwnerMapping,
} from "@/lib/integrations/hubspot-owners.functions";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";

export const Route = createFileRoute("/_authenticated/settings/hubspot-users")({
  component: HubspotUsersPage,
});

function HubspotUsersPage() {
  const listFn = useServerFn(listHubspotOwners);
  const syncFn = useServerFn(syncHubspotOwners);
  const mapFn = useServerFn(setHubspotOwnerMapping);
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["hubspot-owners-admin"], queryFn: () => listFn() });
  const members = useWorkspaceMembers();

  const sync = useMutation({
    mutationFn: () => syncFn(),
    onSuccess: (r) => {
      toast.success(`Sincronizado: ${r.upserted}/${r.total} owners.`);
      qc.invalidateQueries({ queryKey: ["hubspot-owners-admin"] });
      qc.invalidateQueries({ queryKey: ["hubspot-owners"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao sincronizar"),
  });

  const bind = useMutation({
    mutationFn: (p: { hubspot_owner_id: string; mapped_user_id: string | null }) =>
      mapFn({ data: p }),
    onSuccess: () => {
      toast.success("Vínculo atualizado.");
      qc.invalidateQueries({ queryKey: ["hubspot-owners-admin"] });
      qc.invalidateQueries({ queryKey: ["hubspot-owners"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao vincular"),
  });

  const owners = q.data?.owners ?? [];
  const counts = q.data?.counts ?? {};

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuários do HubSpot"
        description="Owners importados do HubSpot. Vincule cada um a um usuário do workspace para que os registros importados apareçam atribuídos a ele. Nenhum convite por email é enviado."
        actions={
          <Button onClick={() => sync.mutate()} disabled={sync.isPending} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${sync.isPending ? "animate-spin" : ""}`} />
            {sync.isPending ? "Sincronizando…" : "Sincronizar do HubSpot"}
          </Button>
        }
      />

      <Card>
        <CardHeader><CardTitle className="text-base">Owners ({owners.length})</CardTitle></CardHeader>
        <CardContent>
          {q.isLoading ? (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          ) : owners.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Nenhum owner importado ainda. Clique em "Sincronizar do HubSpot".
            </div>
          ) : (
            <div className="divide-y">
              <div className="grid grid-cols-12 gap-3 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <div className="col-span-4">Nome / Email</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2 text-right">Registros</div>
                <div className="col-span-4">Vinculado a usuário</div>
              </div>
              {owners.map((o) => {
                const name = `${o.first_name ?? ""} ${o.last_name ?? ""}`.trim() || o.email || o.id;
                const count = counts[o.id] ?? 0;
                return (
                  <div key={o.id} className="grid grid-cols-12 items-center gap-3 py-3">
                    <div className="col-span-4 min-w-0">
                      <div className="font-medium truncate">{name}</div>
                      <div className="text-xs text-muted-foreground truncate">{o.email ?? "—"}</div>
                    </div>
                    <div className="col-span-2">
                      <Badge variant={o.status === "archived" ? "secondary" : "default"}>
                        {o.status === "archived" ? "Arquivado" : "Ativo"}
                      </Badge>
                    </div>
                    <div className="col-span-2 text-right tabular-nums text-sm">
                      {count.toLocaleString("pt-BR")}
                    </div>
                    <div className="col-span-4">
                      <Select
                        value={o.mapped_user_id ?? "__none"}
                        onValueChange={(v) =>
                          bind.mutate({
                            hubspot_owner_id: o.id,
                            mapped_user_id: v === "__none" ? null : v,
                          })
                        }
                      >
                        <SelectTrigger className="h-9"><SelectValue placeholder="— sem vínculo —" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">— sem vínculo —</SelectItem>
                          {(members.data ?? []).map((m) => (
                            <SelectItem key={m.user_id} value={m.user_id}>
                              {m.full_name || m.user_id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
