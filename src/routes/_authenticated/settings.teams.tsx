import { formatDateTime } from "@/lib/crm";
// Página /settings/teams — gerenciar usuários do workspace (papéis, convites, remoção).
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmailInput } from "@/components/ui/email-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Trash2,
  UserPlus,
  Search,
  ShieldCheck,
  ShieldAlert,
  User as UserIcon,
  Check,
  Mail,
  Crown,
  Pencil,
  Clock,
  Send,
} from "lucide-react";
import {
  listTeamMembers,
  inviteTeamMember,
  updateTeamMemberRole,
  updateTeamMember,
  removeTeamMember,
  resendTeamInvite,
  TEAM_ROLE_LABELS,
  type TeamRole,
} from "@/lib/teams.functions";
import { useEntitlements } from "@/lib/use-entitlements";
import { ENT, PLAN_LABELS } from "@/lib/entitlements";

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

const ROLE_PERMISSIONS: Array<{
  feature: string;
  admin: boolean;
  manager: boolean;
  member: boolean;
}> = [
  { feature: "Visualizar próprios registros", admin: true, manager: true, member: true },
  { feature: "Visualizar registros de toda a equipe", admin: true, manager: true, member: false },
  { feature: "Criar/editar pipelines e propriedades", admin: true, manager: true, member: false },
  { feature: "Convidar e remover usuários", admin: true, manager: false, member: false },
  { feature: "Gerenciar integrações e API keys", admin: true, manager: false, member: false },
  { feature: "Acessar logs de auditoria", admin: true, manager: false, member: false },
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
  const updateMemberFn = useServerFn(updateTeamMember);
  const removeFn = useServerFn(removeTeamMember);
  const resendFn = useServerFn(resendTeamInvite);

  type Row = Awaited<ReturnType<typeof listTeamMembers>>[number];
  const {
    data: rows = [],
    isLoading: loading,
    refetch,
  } = useQuery<Row[]>({
    queryKey: ["settings-teams"],
    queryFn: () => listFn(),
  });
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

  // edit dialog
  const [editing, setEditing] = useState<Row | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRole, setEditRole] = useState<TeamRole>("member");
  const [savingEdit, setSavingEdit] = useState(false);

  const openEdit = (r: Row) => {
    setEditing(r);
    setEditName(r.full_name || "");
    setEditPhone(r.phone || "");
    setEditRole(r.role);
  };

  const canSaveEdit = editName.trim().length >= 2 && editPhone.trim().length >= 8;

  const handleSaveEdit = async () => {
    if (!editing || !canSaveEdit) return;
    setSavingEdit(true);
    try {
      await updateMemberFn({
        data: {
          member_user_id: editing.user_id,
          full_name: editName.trim(),
          phone: editPhone.trim(),
          role: editRole,
        },
      });
      toast.success("Usuário atualizado");
      setEditing(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSavingEdit(false);
    }
  };

  const refresh = async () => {
    await refetch();
  };

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
      return (
        (r.full_name || "").toLowerCase().includes(q) || (r.email || "").toLowerCase().includes(q)
      );
    });
  }, [rows, query, roleFilter]);

  // Limite de usuários do plano (owner + membros). null = ilimitado.
  const ents = useEntitlements();
  const usersInfo = ents.info(ENT.USERS_MAX);
  const usersLimit: number | null = usersInfo.limit;
  const usersUsed = rows.length;
  const atLimit = usersLimit !== null && usersUsed >= usersLimit;

  const canInvite =
    !atLimit && email.trim().length > 0 && fullName.trim().length >= 2 && phone.trim().length >= 8;

  const handleInvite = async () => {
    if (!canInvite) return;
    setInviting(true);
    try {
      await inviteFn({
        data: {
          email: email.trim(),
          full_name: fullName.trim(),
          phone: phone.trim(),
          role,
          redirect_origin: typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });
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
    } finally {
      setInviting(false);
    }
  };

  const handleResend = async (user_id: string) => {
    try {
      await resendFn({
        data: {
          member_user_id: user_id,
          redirect_origin: typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });
      toast.success("Convite reenviado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao reenviar");
    }
  };

  const handleRole = async (user_id: string, r: TeamRole) => {
    try {
      await updateFn({ data: { member_user_id: user_id, role: r } });
      await refresh();
      toast.success("Papel atualizado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const handleRemove = async () => {
    if (!toRemove) return;
    try {
      await removeFn({ data: { member_user_id: toRemove.user_id } });
      await refresh();
      toast.success("Usuário removido");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setToRemove(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Usuários (admin)</h2>
          <p className="text-sm text-muted-foreground">
            Convide pessoas, defina permissões e gerencie acessos ao workspace.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button
                disabled={atLimit}
                title={atLimit ? "Limite de usuários do plano atingido" : undefined}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Convidar usuário
              </Button>
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
                  <Label htmlFor="invite-name">
                    Nome completo <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="invite-name"
                    placeholder="Maria da Silva"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invite-email">
                    E-mail <span className="text-destructive">*</span>
                  </Label>
                  <EmailInput
                    id="invite-email"
                    placeholder="pessoa@empresa.com"
                    required
                    value={email}
                    onChange={setEmail}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invite-phone">
                    Telefone celular <span className="text-destructive">*</span>
                  </Label>
                  <PhoneInput id="invite-phone" required value={phone} onChange={setPhone} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invite-role">Papel</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as TeamRole)}>
                    <SelectTrigger id="invite-role">
                      <SelectValue />
                    </SelectTrigger>
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
                <Button variant="ghost" onClick={() => setInviteOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleInvite} disabled={inviting || !canInvite}>
                  <Mail className="h-4 w-4 mr-2" />
                  {inviting ? "Enviando…" : "Enviar convite"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {usersLimit !== null && (
            <p className={`text-xs ${atLimit ? "text-destructive" : "text-muted-foreground"}`}>
              {usersUsed} de {usersLimit} usuários ({PLAN_LABELS[ents.plan]}).{" "}
              {atLimit && (
                <Link to="/settings/billing" className="underline underline-offset-2">
                  Fazer upgrade
                </Link>
              )}
            </p>
          )}
        </div>
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
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os papéis</SelectItem>
                {(Object.keys(TEAM_ROLE_LABELS) as TeamRole[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {TEAM_ROLE_LABELS[k]}
                  </SelectItem>
                ))}
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
                              <Crown className="h-3 w-3" />
                              owner
                            </Badge>
                          )}
                          {r.pending && !r.is_owner && (
                            <Badge
                              variant="outline"
                              className="gap-1 text-amber-600 border-amber-300"
                            >
                              <Clock className="h-3 w-3" />
                              Pendente
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{r.email || "—"}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {r.is_owner ? (
                      <Badge className="gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        Admin (fixo)
                      </Badge>
                    ) : (
                      <Select
                        value={r.role}
                        onValueChange={(v) => handleRole(r.user_id, v as TeamRole)}
                      >
                        <SelectTrigger className="w-[160px]">
                          <SelectValue />
                        </SelectTrigger>
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
                    {r.created_at ? formatDateTime(r.created_at) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(r)}
                        aria-label="Editar usuário"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {r.pending && !r.is_owner && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleResend(r.user_id)}
                          aria-label="Reenviar convite"
                          title="Reenviar convite"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      )}
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
                    </div>
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
                    {p.admin ? (
                      <Check className="h-4 w-4 mx-auto text-primary" />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {p.manager ? (
                      <Check className="h-4 w-4 mx-auto text-primary" />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {p.member ? (
                      <Check className="h-4 w-4 mx-auto text-primary" />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
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
              {toRemove?.full_name || toRemove?.email} perderá o acesso imediatamente. Os registros
              criados por ele continuarão existindo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
            <DialogDescription>
              Atualize nome, telefone {editing?.is_owner ? "" : "e papel "}do usuário.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">
                Nome completo <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-email">E-mail</Label>
              <Input id="edit-email" value={editing?.email || ""} disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-phone">
                Telefone celular <span className="text-destructive">*</span>
              </Label>
              <PhoneInput id="edit-phone" required value={editPhone} onChange={setEditPhone} />
            </div>
            {!editing?.is_owner && (
              <div className="space-y-1.5">
                <Label htmlFor="edit-role">Papel</Label>
                <Select value={editRole} onValueChange={(v) => setEditRole(v as TeamRole)}>
                  <SelectTrigger id="edit-role">
                    <SelectValue />
                  </SelectTrigger>
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
                <p className="text-xs text-muted-foreground pt-1">{ROLE_DESCRIPTIONS[editRole]}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit || !canSaveEdit}>
              {savingEdit ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
