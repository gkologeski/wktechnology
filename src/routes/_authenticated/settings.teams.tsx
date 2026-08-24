import { getPublicAppUrl } from "@/lib/app-url";
import { formatDateTime } from "@/lib/crm";
// Página /settings/teams — gestão unificada de usuários do workspace.
// Convite por link (token, tabela workspace_invites) + membros + reassign-on-remove.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Can } from "@/lib/access-control/use-permissions";
import { MEMBERS_MANAGE } from "@/lib/access-control/admin-permission-keys";
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
  Copy,
  Link as LinkIcon,
} from "lucide-react";
import {
  listTeamMembers,
  listPendingTeamInvites,
  countAssignedToTeamMember,
  updateTeamMemberRole,
  updateTeamMember,
  removeTeamMember,
  listWorkspaceJobRoles,
  listWorkspacePermissionSets,
  setMemberJobRoles,
  TEAM_ROLE_LABELS,
  type TeamRole,
} from "@/lib/teams.functions";
import {
  createWorkspaceInvite,
  resendWorkspaceInvite,
  revokeWorkspaceInvite,
  bulkRevokeInvalidWorkspaceInvites,
} from "@/lib/workspace-invites.functions";
import { Checkbox } from "@/components/ui/checkbox";
import { useEntitlements } from "@/lib/use-entitlements";
import { ENT, PLAN_LABELS } from "@/lib/entitlements";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { UnlinkedAccountsCard } from "@/components/teams/unlinked-accounts-card";

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
  const listInvitesFn = useServerFn(listPendingTeamInvites);
  const inviteFn = useServerFn(createWorkspaceInvite);
  const resendFn = useServerFn(resendWorkspaceInvite);
  const revokeFn = useServerFn(revokeWorkspaceInvite);
  const bulkRevokeInvalidFn = useServerFn(bulkRevokeInvalidWorkspaceInvites);
  const countAssignedFn = useServerFn(countAssignedToTeamMember);
  const updateFn = useServerFn(updateTeamMemberRole);
  const updateMemberFn = useServerFn(updateTeamMember);
  const removeFn = useServerFn(removeTeamMember);
  const listRolesFn = useServerFn(listWorkspaceJobRoles);
  const listSetsFn = useServerFn(listWorkspacePermissionSets);
  const setMemberRolesFn = useServerFn(setMemberJobRoles);

  type Row = Awaited<ReturnType<typeof listTeamMembers>>[number];
  type RoleOption = Awaited<ReturnType<typeof listWorkspaceJobRoles>>[number];
  type SetOption = Awaited<ReturnType<typeof listWorkspacePermissionSets>>[number];
  type InviteRow = Awaited<ReturnType<typeof listPendingTeamInvites>>[number];

  const {
    data: rows = [],
    isLoading: loading,
    refetch,
  } = useQuery<Row[]>({
    queryKey: ["settings-teams"],
    queryFn: () => listFn(),
  });

  const { data: invites = [], refetch: refetchInvites } = useQuery<InviteRow[]>({
    queryKey: ["settings-teams", "pending-invites"],
    queryFn: () => listInvitesFn(),
  });

  const { data: jobRoles = [] } = useQuery<RoleOption[]>({
    queryKey: ["settings-teams", "job-roles"],
    queryFn: () => listRolesFn(),
  });

  const { data: permissionSets = [] } = useQuery<SetOption[]>({
    queryKey: ["settings-teams", "permission-sets"],
    queryFn: () => listSetsFn(),
  });

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | TeamRole>("all");

  // invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("member");
  const [invitePermissionSetId, setInvitePermissionSetId] = useState<string>("");
  const [inviting, setInviting] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  // remove dialog (with reassign)
  const [toRemove, setToRemove] = useState<Row | null>(null);
  const [reassignTo, setReassignTo] = useState<string>("__none__");
  const [assignedInfo, setAssignedInfo] = useState<{
    counts: Record<string, number>;
    total: number;
  } | null>(null);
  const [assignedLoading, setAssignedLoading] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (!toRemove) {
      setAssignedInfo(null);
      setReassignTo("__none__");
      return;
    }
    let alive = true;
    setAssignedLoading(true);
    countAssignedFn({ data: { member_user_id: toRemove.user_id } })
      .then((r) => {
        if (alive) setAssignedInfo(r);
      })
      .catch(() => {
        if (alive) setAssignedInfo({ counts: {}, total: 0 });
      })
      .finally(() => {
        if (alive) setAssignedLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [toRemove, countAssignedFn]);

  // edit dialog
  const [editing, setEditing] = useState<Row | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRole, setEditRole] = useState<TeamRole>("member");
  const [savingEdit, setSavingEdit] = useState(false);

  // roles dialog
  const [rolesDialog, setRolesDialog] = useState<Row | null>(null);
  const [primaryRoleId, setPrimaryRoleId] = useState<string | null>(null);
  const [extraRoleIds, setExtraRoleIds] = useState<string[]>([]);
  const [extraSetIds, setExtraSetIds] = useState<string[]>([]);
  const [savingRoles, setSavingRoles] = useState(false);

  const openRolesDialog = (r: Row) => {
    setRolesDialog(r);
    setPrimaryRoleId(r.primary_role_id ?? null);
    setExtraRoleIds(r.role_ids ?? []);
    setExtraSetIds(r.extra_set_ids ?? []);
  };

  const closeRolesDialog = () => {
    setRolesDialog(null);
    setPrimaryRoleId(null);
    setExtraRoleIds([]);
    setExtraSetIds([]);
  };

  const handleSaveRoles = async () => {
    if (!rolesDialog) return;
    setSavingRoles(true);
    try {
      await setMemberRolesFn({
        data: {
          member_user_id: rolesDialog.user_id,
          primary_role_id: primaryRoleId,
          extra_role_ids: extraRoleIds,
          extra_set_ids: extraSetIds,
        },
      });
      toast.success("Cargos atualizados");
      closeRolesDialog();
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar cargos");
    } finally {
      setSavingRoles(false);
    }
  };

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
    await Promise.all([refetch(), refetchInvites()]);
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

  // Limite de usuários do plano.
  const ents = useEntitlements();
  const usersInfo = ents.info(ENT.USERS_MAX);
  const usersLimit: number | null = usersInfo.limit;
  const usersUsed = rows.length;
  const atLimit = usersLimit !== null && usersUsed >= usersLimit;

  const canInvite = !atLimit && email.trim().length > 0 && invitePermissionSetId.length > 0;

  const handleInvite = async () => {
    if (!canInvite) return;
    setInviting(true);
    try {
      const res = await inviteFn({
        data: {
          email: email.trim(),
          role,
          permission_set_id: invitePermissionSetId,
          redirect_origin: getPublicAppUrl(),
        },
      });
      setInviteUrl(res.url);
      toast.success("Convite criado", {
        description: `${email.trim()} receberá um e-mail com o link de acesso.`,
      });
      setEmail("");
      setRole("member");
      setInvitePermissionSetId("");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao convidar");
    } finally {
      setInviting(false);
    }
  };

  const closeInviteDialog = () => {
    setInviteOpen(false);
    setInviteUrl(null);
  };

  const handleCopyInviteUrl = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const handleResendInvite = async (inviteId: string) => {
    try {
      await resendFn({
        data: {
          invite_id: inviteId,
          redirect_origin: getPublicAppUrl(),
        },
      });
      toast.success("Convite reenviado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao reenviar");
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    try {
      await revokeFn({ data: { invite_id: inviteId } });
      await refetchInvites();
      toast.success("Convite revogado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao revogar");
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
    setRemoving(true);
    try {
      const reassign = reassignTo === "__none__" ? null : reassignTo;
      const res = await removeFn({
        data: { member_user_id: toRemove.user_id, reassign_to: reassign },
      });
      await refresh();
      if (res.reassigned > 0) {
        toast.success(
          reassign
            ? `Usuário removido. ${res.reassigned} registro(s) reatribuído(s).`
            : `Usuário removido. ${res.reassigned} registro(s) ficaram sem proprietário.`,
        );
      } else {
        toast.success("Usuário removido");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setRemoving(false);
      setToRemove(null);
    }
  };

  const reassignCandidates = useMemo(
    () => rows.filter((r) => r.user_id !== toRemove?.user_id),
    [rows, toRemove],
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Usuários (admin)</h2>
          <p className="text-sm text-muted-foreground">
            Convide pessoas por link, defina permissões e gerencie acessos ao workspace.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Dialog
            open={inviteOpen}
            onOpenChange={(o) => {
              if (!o) closeInviteDialog();
              else setInviteOpen(true);
            }}
          >
            <Can any={MEMBERS_MANAGE}>
              <DialogTrigger asChild>
                <Button
                  disabled={atLimit}
                  title={atLimit ? "Limite de usuários do plano atingido" : undefined}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Convidar usuário
                </Button>
              </DialogTrigger>
            </Can>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Convidar usuário</DialogTitle>
                <DialogDescription>
                  Um e-mail com link seguro (válido por 14 dias) será enviado. O usuário completa
                  nome, telefone e senha ao aceitar.
                </DialogDescription>
              </DialogHeader>
              {!inviteUrl ? (
                <>
                  <div className="space-y-3 py-2">
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
                      <p className="text-xs text-muted-foreground pt-1">
                        {ROLE_DESCRIPTIONS[role]}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="invite-permission-set">
                        Conjunto de permissões <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={invitePermissionSetId}
                        onValueChange={setInvitePermissionSetId}
                      >
                        <SelectTrigger id="invite-permission-set">
                          <SelectValue placeholder="Selecione um conjunto" />
                        </SelectTrigger>
                        <SelectContent>
                          {permissionSets
                            .filter((s) => s.module !== "__bundle__")
                            .map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                <div className="flex flex-col">
                                  <span>{s.name}</span>
                                  <span className="text-[11px] text-muted-foreground">
                                    {s.module}
                                    {s.is_system ? " • padrão" : ""}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground pt-1">
                        Define o que o usuário poderá ver e fazer ao aceitar o convite.
                      </p>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="ghost" onClick={closeInviteDialog}>
                      Cancelar
                    </Button>
                    <Button onClick={handleInvite} disabled={inviting || !canInvite}>
                      <Mail className="h-4 w-4 mr-2" />
                      {inviting ? "Enviando…" : "Enviar convite"}
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <div className="space-y-3 py-2">
                    <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        <LinkIcon className="h-3.5 w-3.5" />
                        Link do convite (válido 14 dias)
                      </div>
                      <div className="flex items-center gap-2">
                        <Input value={inviteUrl} readOnly className="text-xs" />
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          onClick={handleCopyInviteUrl}
                          aria-label="Copiar link"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        O e-mail já foi enviado. Você também pode compartilhar este link por outro
                        canal.
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={closeInviteDialog}>Concluir</Button>
                  </DialogFooter>
                </>
              )}
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

      {/* Pending invites */}
      {invites.length > 0 && (
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600" />
                Convites pendentes ({invites.length})
              </CardTitle>
              <CardDescription>
                Convites por link que ainda não foram aceitos. Expiram em 14 dias após o envio.
              </CardDescription>
            </div>
            {invites.some((i) => !i.permission_set_id) && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (
                    !(await confirmDialog(
                      "Revogar todos os convites pendentes sem conjunto de permissões?",
                    ))
                  )
                    return;
                  try {
                    const res = await bulkRevokeInvalidFn();
                    await refetchInvites();
                    toast.success(`${res.revoked} convite(s) revogado(s)`);
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Erro ao revogar");
                  }
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Revogar pendentes sem permissão
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Permissões</TableHead>
                  <TableHead>Enviado em</TableHead>
                  <TableHead>Expira em</TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((i) => {
                  const hasSet = !!i.permission_set_id;
                  return (
                    <TableRow key={i.id}>
                      <TableCell className="text-sm">{i.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{TEAM_ROLE_LABELS[i.role]}</Badge>
                      </TableCell>
                      <TableCell>
                        {hasSet ? (
                          <Badge variant="secondary">{i.permission_set_name ?? "Conjunto"}</Badge>
                        ) : (
                          <Badge variant="destructive">Sem permissão — recrie</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(i.created_at)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(i.expires_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleResendInvite(i.id)}
                            aria-label="Reenviar convite"
                            title={
                              hasSet
                                ? "Reenviar convite"
                                : "Convite sem permissão — revogue e crie um novo"
                            }
                            disabled={!hasSet}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRevokeInvite(i.id)}
                            aria-label="Revogar convite"
                            title="Revogar convite"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

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
                <TableHead>Papel workspace</TableHead>
                <TableHead>Cargos funcionais</TableHead>
                <TableHead>Membro desde</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                    Carregando…
                  </TableCell>
                </TableRow>
              )}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
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
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => openRolesDialog(r)}
                      className="text-left text-sm text-primary hover:underline underline-offset-2"
                    >
                      {r.primary_role_id
                        ? (jobRoles.find((j) => j.id === r.primary_role_id)?.name ??
                          "Cargo atribuído")
                        : r.role_ids.length > 0
                          ? `${r.role_ids.length} cargo(s)`
                          : "Nenhum cargo"}
                    </button>
                    {r.extra_set_ids.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        +{r.extra_set_ids.length} pacote(s)
                      </p>
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
                        onClick={() => openRolesDialog(r)}
                        aria-label="Editar cargos"
                        title="Editar cargos"
                      >
                        <ShieldCheck className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(r)}
                        aria-label="Editar usuário"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
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

      {/* Remove confirm with impact + reassign */}
      <AlertDialog open={!!toRemove} onOpenChange={(o) => !o && !removing && setToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover usuário do workspace?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  <strong className="text-foreground">
                    {toRemove?.full_name || toRemove?.email}
                  </strong>{" "}
                  perderá o acesso imediatamente.
                </p>
                {assignedLoading && <p className="text-muted-foreground">Analisando impacto…</p>}
                {!assignedLoading && assignedInfo && assignedInfo.total > 0 && (
                  <div className="rounded-md border bg-amber-50 dark:bg-amber-950/20 p-3 space-y-2">
                    <p className="text-amber-900 dark:text-amber-100 font-medium">
                      Este usuário é proprietário de {assignedInfo.total} registro(s):
                    </p>
                    <ul className="text-xs text-amber-900 dark:text-amber-100 space-y-0.5">
                      {Object.entries(assignedInfo.counts)
                        .filter(([, v]) => v > 0)
                        .map(([k, v]) => (
                          <li key={k}>
                            • {v} {k}
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
                {!assignedLoading && assignedInfo && assignedInfo.total > 0 && (
                  <div className="space-y-1.5">
                    <Label htmlFor="reassign-to">Reatribuir para</Label>
                    <Select value={reassignTo} onValueChange={setReassignTo}>
                      <SelectTrigger id="reassign-to">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Deixar sem proprietário</SelectItem>
                        {reassignCandidates.map((c) => (
                          <SelectItem key={c.user_id} value={c.user_id}>
                            {c.full_name || c.email || c.user_id.slice(0, 8)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {!assignedLoading && assignedInfo && assignedInfo.total === 0 && (
                  <p className="text-muted-foreground">
                    Este usuário não é proprietário de nenhum registro.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={removing || assignedLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removing ? "Removendo…" : "Remover"}
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

      {/* Roles dialog */}
      <Dialog open={!!rolesDialog} onOpenChange={(o) => !o && closeRolesDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar cargos do usuário</DialogTitle>
            <DialogDescription>
              Escolha o cargo principal, cargos extras e pacotes de permissões para{" "}
              <span className="font-medium text-foreground">
                {rolesDialog?.full_name || rolesDialog?.email}
              </span>
              .
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Cargo principal</Label>
              <Select
                value={primaryRoleId ?? "__none__"}
                onValueChange={(v) => setPrimaryRoleId(v === "__none__" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cargo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum cargo principal</SelectItem>
                  {jobRoles.map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: j.color ?? "currentColor" }}
                        />
                        <span>{j.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Define o papel padrão do usuário nos módulos (ex: Vendedor, Recrutador).
              </p>
            </div>

            <div className="space-y-2">
              <Label>Cargos extras</Label>
              <div className="rounded-md border divide-y">
                {jobRoles.map((j) => {
                  const checked = extraRoleIds.includes(j.id);
                  const isPrimary = primaryRoleId === j.id;
                  return (
                    <label
                      key={j.id}
                      className="flex items-center justify-between gap-3 p-3 cursor-pointer hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: j.color ?? "currentColor" }}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{j.name}</p>
                          {j.description && (
                            <p className="text-xs text-muted-foreground truncate">
                              {j.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <Checkbox
                        checked={checked || isPrimary}
                        disabled={isPrimary}
                        onCheckedChange={(c) => {
                          setExtraRoleIds((prev) =>
                            c ? [...prev, j.id] : prev.filter((id) => id !== j.id),
                          );
                        }}
                        aria-label={`Selecionar ${j.name}`}
                      />
                    </label>
                  );
                })}
                {jobRoles.length === 0 && (
                  <p className="p-3 text-sm text-muted-foreground">Nenhum cargo disponível.</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Pacotes de permissões extras</Label>
              <div className="rounded-md border divide-y">
                {permissionSets
                  .filter((s) => s.module !== "__bundle__")
                  .map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center justify-between gap-3 p-3 cursor-pointer hover:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{s.name}</p>
                        {s.description && (
                          <p className="text-xs text-muted-foreground truncate">{s.description}</p>
                        )}
                        {s.permission_keys.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {s.permission_keys.length} permissão(ões)
                          </p>
                        )}
                      </div>
                      <Checkbox
                        checked={extraSetIds.includes(s.id)}
                        onCheckedChange={(c) => {
                          setExtraSetIds((prev) =>
                            c ? [...prev, s.id] : prev.filter((id) => id !== s.id),
                          );
                        }}
                        aria-label={`Selecionar ${s.name}`}
                      />
                    </label>
                  ))}
                {permissionSets.filter((s) => s.module !== "__bundle__").length === 0 && (
                  <p className="p-3 text-sm text-muted-foreground">Nenhum pacote disponível.</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeRolesDialog} disabled={savingRoles}>
              Cancelar
            </Button>
            <Button onClick={handleSaveRoles} disabled={savingRoles}>
              {savingRoles ? "Salvando…" : "Salvar cargos"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UnlinkedAccountsCard
        onLinked={() => {
          refetch();
          refetchInvites();
        }}
      />
    </div>
  );
}
