// Página /settings/roles — gerenciar Roles & Permissions dos membros do workspace.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { listWorkspaceRoles, setUserRole, ROLE_LABELS, type AppRole } from "@/lib/roles.functions";

export const Route = createFileRoute("/_authenticated/settings/roles")({
  component: RolesPage,
});

function RolesPage() {
  const listFn = useServerFn(listWorkspaceRoles);
  const setFn = useServerFn(setUserRole);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listWorkspaceRoles>>>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try { setRows(await listFn()); } finally { setLoading(false); }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const handleChange = async (user_id: string, role: AppRole) => {
    try {
      await setFn({ data: { user_id, role } });
      toast.success("Permissão atualizada");
      setRows((rs) => rs.map((r) => r.user_id === user_id ? { ...r, role } : r));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Permissões</h2>
        <p className="text-sm text-muted-foreground">
          Defina o papel de cada membro do workspace. <strong>Admin</strong> gerencia tudo, <strong>Gestor</strong> opera o pipeline,
          <strong> Membro</strong> tem acesso operacional.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Membros do workspace</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!loading && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum membro encontrado.</p>
          )}
          {rows.map((r) => (
            <div key={r.user_id} className="grid grid-cols-[1fr_auto_220px] gap-3 items-center py-2 border-b last:border-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{r.full_name}</span>
                {r.is_owner && <Badge variant="secondary">owner</Badge>}
              </div>
              <code className="text-[11px] text-muted-foreground">{r.user_id.slice(0, 8)}</code>
              {r.is_owner ? (
                <Badge>Admin (fixo)</Badge>
              ) : (
                <Select value={r.role} onValueChange={(v) => handleChange(r.user_id, v as AppRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ROLE_LABELS) as AppRole[]).map((k) => (
                      <SelectItem key={k} value={k}>{ROLE_LABELS[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Como funciona</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>• Roles ficam em uma tabela separada (<code>user_roles</code>) — nunca no perfil.</p>
          <p>• A checagem é feita via função <code>has_role()</code> com <em>security definer</em>, evitando recursão em policies.</p>
          <p>• Para convidar novos membros use a aba <strong>Equipe</strong> (próximo passo do roteiro).</p>
        </CardContent>
      </Card>
    </div>
  );
}
