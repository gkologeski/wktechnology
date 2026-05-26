// Página /settings/teams — gerenciar usuários do workspace (papéis, convites, remoção).
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  Trash2, UserPlus, Search, ShieldCheck, ShieldAlert, User as UserIcon,
  Check, Mail, Crown, Pencil,
} from "lucide-react";
import {
  listTeamMembers, inviteTeamMember, updateTeamMemberRole, updateTeamMember, removeTeamMember,
  TEAM_ROLE_LABELS, type TeamRole,
} from "@/lib/teams.functions";

export const Route = createFileRoute("/_authenticated/settings/teams")({
  component: UsersPage,
});

const ROLE_DESCRIPTIONS: Record<TeamRole, string> = {
  admin: "Acesso total: configurações, integrações, billing e gerenciamento de usuários.",
  manager: "Gestor de equipe: visualiza dados de todos os membros e gerencia pipelines.",
  member: "Acesso aos próprios registros (leads, contatos, negócios, atividades).",
};

const ROLE_ICONS: Record<TeamRole, typeof ShieldCheck> = {
  admin: ShieldCheck,
  manager: ShieldAlert,
  member: UserIcon,
};

const ROLE_PERMISSIONS: Array<{ feature: string; admin: boolean; manager: boolean; member: boolean }> = [
  { feature: "Visualizar próprios registros",            admin: true,  manager: true,  member: true  },
  { feature: "Visualizar registros de toda a equipe",     admin: true,  manager: true,  member: false },
  { feature: "Criar/editar pipelines e propriedades",     admin: true,  manager: true,  member: false },
  { feature: "Convidar e remover usuários",               admin: true,  manager: false, member: false },
  { feature: "Gerenciar integrações e API keys",          admin: true,  manager: false, member: false },
  { feature: "Acessar logs de auditoria",                 admin: true,  manager: false, member: false },
];

function initials(name: string, email: string) {
  const base = (name || email || "?").trim();
  const parts = base.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function UsersPage() {
  const listFn = useServerFn(listTeamMembers);
  const inviteFn = useServerFn(inviteTeamMember);
  const updateFn = useServerFn(updateTeamMemberRole);
  const removeFn = useServerFn(removeTeamMember);

  type Row = Awaited<ReturnType<typeof listTeamMembers>>[number];
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | TeamRole>("all");

  // invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<TeamRole>("member");
  const [inviting, setInviting] = useState(false);

  // remove dialog
  const [toRemove, setToRemove] = useState<Row | null>(null);

  const refresh = async () => {
    setLoading(true);
    try { setRows(await listFn()); } finally { setLoading(false); }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const stats = useMemo(() => {
    const s = { total: rows.length, admin: 0, manager: 0, member: 0 };
    for (const r of rows) s[r.role] += 1;
    return s;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (roleFilter !== "all" && r.role !== roleFilter) return false;
      if (!q) return true;
      return (r.full_name || "").toLowerCase().includes(q) || (r.email || "").toLowerCase().includes(q);
    });
  }, [rows, query, roleFilter]);

  const canInvite = email.trim().length > 0 && fullName.trim().length >= 2 && phone.trim().length >= 8;

  const handleInvite = async () => {
    if (!canInvite) return;
    setInviting(true);
    try {
      await inviteFn({ data: {
        email: email.trim(),
        full_name: fullName.trim(),
        phone: phone.trim(),
        role,
      } });
      toast.success("Convite enviado", {
        description: `${email.trim()} receberá um e-mail para acessar o workspace.`,
      });
      setEmail("");
      setFullName("");
      setPhone("");
      setRole("member");
      setInviteOpen(false);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao convidar");
    } finally { setInviting(false); }
  };


  const handleRole = async (user_id: string, r: TeamRole) => {
    try {
      await updateFn({ data: { member_user_id: user_id, role: r } });
      setRows((rs) => rs.map((x) => x.user_id === user_id ? { ...x, role: r } : x));
      toast.success("Papel atualizado");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  };

  const handleRemove = async () => {
    if (!toRemove) return;
    try {
      await removeFn({ data: { member_user_id: toRemove.user_id } });
      setRows((rs) => rs.filter((x) => x.user_id !== toRemove.user_id));
      toast.success("Usuário removido");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally { setToRemove(null); }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Usuários</h2>
          <p className="text-sm text-muted-foreground">
            Convide pessoas, defina permissões e gerencie acessos ao workspace.
          </p>
        </div>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button><UserPlus className="h-4 w-4 mr-2" />Convidar usuário</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Convidar usuário</DialogTitle>
              <DialogDescription>
                O usuário receberá um e-mail com link para criar a conta e acessar o workspace.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">

              <div className="space-y-1.5">
                <Label htmlFor="invite-name">Nome completo <span className="text-destructive">*</span></Label>
                <Input
                  id="invite-name"
                  placeholder="Maria da Silva"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-email">E-mail <span className="text-destructive">*</span></Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="pessoa@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-phone">Telefone celular <span className="text-destructive">*</span></Label>
                <Input
                  id="invite-phone"
                  type="tel"
                  placeholder="(11) 98765-4321"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-role">Papel</Label>
                <Select value={role} onValueChange={(v) => setRole(v as TeamRole)}>
                  <SelectTrigger id="invite-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TEAM_ROLE_LABELS) as TeamRole[]).map((k) => {
                      const Icon = ROLE_ICONS[k];
                      return (
                        <SelectItem key={k} value={k}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <span>{TEAM_ROLE_LABELS[k]}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground pt-1">{ROLE_DESCRIPTIONS[role]}</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setInviteOpen(false)}>Cancelar</Button>
              <Button onClick={handleInvite} disabled={inviting || !canInvite}>

                <Mail className="h-4 w-4 mr-2" />
                {inviting ? "Enviando…" : "Enviar convite"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, icon: UserIcon },
          { label: "Admins", value: stats.admin, icon: ShieldCheck },
          { label: "Gestores", value: stats.manager, icon: ShieldAlert },
          { label: "Membros", value: stats.member, icon: UserIcon },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-semibold">{s.value}</p>
              </div>
              <s.icon className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 space-y-0">
          <CardTitle className="text-base">Membros do workspace</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou e-mail…"
                className="pl-8 w-[240px]"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as "all" | TeamRole)}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os papéis</SelectItem>
                {(Object.keys(TEAM_ROLE_LABELS) as TeamRole[]).map((k) =>
                  <SelectItem key={k} value={k}>{TEAM_ROLE_LABELS[k]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Membro desde</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                    Carregando…
                  </TableCell>
                </TableRow>
              )}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                    Nenhum usuário encontrado.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((r) => (
                <TableRow key={r.user_id}>
                  <TableCell>
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {initials(r.full_name, r.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">
                            {r.full_name || "(sem nome)"}
                          </span>
                          {r.is_owner && (
                            <Badge variant="secondary" className="gap-1">
                              <Crown className="h-3 w-3" />owner
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{r.email || "—"}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {r.is_owner ? (
                      <Badge className="gap-1"><ShieldCheck className="h-3 w-3" />Admin (fixo)</Badge>
                    ) : (
                      <Select value={r.role} onValueChange={(v) => handleRole(r.user_id, v as TeamRole)}>
                        <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(TEAM_ROLE_LABELS) as TeamRole[]).map((k) => {
                            const Icon = ROLE_ICONS[k];
                            return (
                              <SelectItem key={k} value={k}>
                                <div className="flex items-center gap-2">
                                  <Icon className="h-4 w-4 text-muted-foreground" />
                                  <span>{TEAM_ROLE_LABELS[k]}</span>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.created_at
                      ? new Date(r.created_at).toLocaleDateString("pt-BR")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {!r.is_owner && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setToRemove(r)}
                        aria-label="Remover usuário"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Permission matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Matriz de permissões</CardTitle>
          <CardDescription>O que cada papel pode fazer no workspace.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recurso</TableHead>
                <TableHead className="text-center w-[120px]">Admin</TableHead>
                <TableHead className="text-center w-[120px]">Gestor</TableHead>
                <TableHead className="text-center w-[120px]">Membro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ROLE_PERMISSIONS.map((p) => (
                <TableRow key={p.feature}>
                  <TableCell className="text-sm">{p.feature}</TableCell>
                  <TableCell className="text-center">
                    {p.admin ? <Check className="h-4 w-4 mx-auto text-primary" /> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {p.manager ? <Check className="h-4 w-4 mx-auto text-primary" /> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {p.member ? <Check className="h-4 w-4 mx-auto text-primary" /> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Remove confirm */}
      <AlertDialog open={!!toRemove} onOpenChange={(o) => !o && setToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover usuário do workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              {toRemove?.full_name || toRemove?.email} perderá o acesso imediatamente.
              Os registros criados por ele continuarão existindo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
