// Página /settings/teams — gerenciar membros do workspace.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, UserPlus } from "lucide-react";
import {
  listTeamMembers, inviteTeamMember, updateTeamMemberRole, removeTeamMember,
  TEAM_ROLE_LABELS, type TeamRole,
} from "@/lib/teams.functions";

export const Route = createFileRoute("/_authenticated/settings/teams")({
  component: TeamsPage,
});

function TeamsPage() {
  const listFn = useServerFn(listTeamMembers);
  const inviteFn = useServerFn(inviteTeamMember);
  const updateFn = useServerFn(updateTeamMemberRole);
  const removeFn = useServerFn(removeTeamMember);

  type Row = Awaited<ReturnType<typeof listTeamMembers>>[number];
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("member");
  const [inviting, setInviting] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try { setRows(await listFn()); } finally { setLoading(false); }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const handleInvite = async () => {
    if (!email.trim()) return;
    setInviting(true);
    try {
      await inviteFn({ data: { email: email.trim(), role } });
      toast.success("Membro adicionado");
      setEmail("");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally { setInviting(false); }
  };

  const handleRole = async (user_id: string, r: TeamRole) => {
    try {
      await updateFn({ data: { member_user_id: user_id, role: r } });
      setRows((rs) => rs.map((x) => x.user_id === user_id ? { ...x, role: r } : x));
      toast.success("Papel atualizado");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  };

  const handleRemove = async (user_id: string) => {
    if (!confirm("Remover este membro do workspace?")) return;
    try {
      await removeFn({ data: { member_user_id: user_id } });
      setRows((rs) => rs.filter((x) => x.user_id !== user_id));
      toast.success("Membro removido");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Equipe</h2>
        <p className="text-sm text-muted-foreground">
          Adicione pessoas ao seu workspace e defina o papel de cada uma. Elas precisam ter conta cadastrada no sistema.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Convidar membro</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-[1fr_180px_auto] gap-2 items-end">
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" placeholder="pessoa@empresa.com" value={email}
                onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Papel</Label>
              <Select value={role} onValueChange={(v) => setRole(v as TeamRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TEAM_ROLE_LABELS) as TeamRole[]).map((k) =>
                    <SelectItem key={k} value={k}>{TEAM_ROLE_LABELS[k]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleInvite} disabled={inviting || !email.trim()}>
              <UserPlus className="h-4 w-4 mr-2" />Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Membros</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!loading && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum membro.</p>
          )}
          {rows.map((r) => (
            <div key={r.user_id}
              className="grid grid-cols-[1fr_1fr_180px_auto] gap-3 items-center py-2 border-b last:border-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium truncate">{r.full_name || "(sem nome)"}</span>
                {r.is_owner && <Badge variant="secondary">owner</Badge>}
              </div>
              <span className="text-sm text-muted-foreground truncate">{r.email || "—"}</span>
              {r.is_owner ? (
                <Badge>Admin (fixo)</Badge>
              ) : (
                <Select value={r.role} onValueChange={(v) => handleRole(r.user_id, v as TeamRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TEAM_ROLE_LABELS) as TeamRole[]).map((k) =>
                      <SelectItem key={k} value={k}>{TEAM_ROLE_LABELS[k]}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {r.is_owner ? <span /> : (
                <Button variant="ghost" size="icon" onClick={() => handleRemove(r.user_id)}
                  aria-label="Remover">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
