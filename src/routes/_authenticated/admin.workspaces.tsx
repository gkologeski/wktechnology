import { getPublicAppUrl } from "@/lib/app-url";
// Super-admin: lista e cria workspaces da plataforma.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmailInput } from "@/components/ui/email-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsPlatformAdmin } from "@/lib/use-platform-admin";
import {
  listAllWorkspaces,
  createWorkspaceWithAdmin,
  inviteUserToWorkspace,
} from "@/lib/platform-admin.functions";
import {
  Plus,
  Building2,
  ShieldAlert,
  Users,
  ChevronRight,
  UserPlus,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  EditWorkspaceDialog,
  SoftDeleteWorkspaceDialog,
  RestoreWorkspaceDialog,
  PurgeWorkspaceDialog,
} from "@/components/admin/workspace-lifecycle-dialogs";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/admin/workspaces")({
  component: WorkspacesAdminPage,
});

function WorkspacesAdminPage() {
  const { isPlatformAdmin, loading } = useIsPlatformAdmin();
  const listFn = useServerFn(listAllWorkspaces);
  const createFn = useServerFn(createWorkspaceWithAdmin);
  const inviteFn = useServerFn(inviteUserToWorkspace);
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["admin-workspaces"],
    enabled: isPlatformAdmin,
    queryFn: () => listFn(),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    admin_email: "",
    admin_name: "",
    admin_phone: "",
  });

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    workspace_id: "",
    email: "",
    full_name: "",
    phone: "",
    role: "member" as "admin" | "member",
  });

  const [filter, setFilter] = useState<"active" | "suspended" | "deleted" | "all">("active");
  type WsRow = NonNullable<typeof list.data>[number];
  const [editTarget, setEditTarget] = useState<WsRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WsRow | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<WsRow | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<WsRow | null>(null);

  const create = useMutation({
    mutationFn: async () =>
      createFn({
        data: {
          name: form.name.trim(),
          slug: form.slug.trim(),
          admin_email: form.admin_email.trim(),
          admin_name: form.admin_name.trim(),
          admin_phone: form.admin_phone.trim() || undefined,
          redirect_origin: getPublicAppUrl(),
        },
      }),
    onSuccess: () => {
      toast.success("Workspace criado! Convite enviado por email.");
      setOpen(false);
      setForm({ name: "", slug: "", admin_email: "", admin_name: "", admin_phone: "" });
      qc.invalidateQueries({ queryKey: ["admin-workspaces"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao criar workspace"),
  });

  const invite = useMutation({
    mutationFn: async () =>
      inviteFn({
        data: {
          workspace_id: inviteForm.workspace_id,
          email: inviteForm.email.trim(),
          full_name: inviteForm.full_name.trim(),
          phone: inviteForm.phone.trim() || undefined,
          role: inviteForm.role,
          redirect_origin: getPublicAppUrl(),
        },
      }),
    onSuccess: () => {
      toast.success("Convite enviado!");
      setInviteOpen(false);
      setInviteForm({ workspace_id: "", email: "", full_name: "", phone: "", role: "member" });
      qc.invalidateQueries({ queryKey: ["admin-workspaces"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao convidar usuário"),
  });

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;

  if (!isPlatformAdmin) {
    return (
      <div className="p-8 max-w-md mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              Acesso restrito
            </CardTitle>
            <CardDescription>Esta área é exclusiva do super-admin da plataforma.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.slug || !form.admin_email || !form.admin_name) return;
    create.mutate();
  };

  const submitInvite = (e: FormEvent) => {
    e.preventDefault();
    if (!inviteForm.workspace_id || !inviteForm.email || !inviteForm.full_name) {
      toast.error("Selecione um workspace e preencha nome e email.");
      return;
    }
    invite.mutate();
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Workspaces da plataforma"
        description="Crie novos workspaces (empresas) e gerencie seus administradores."
        actions={
          <div className="flex gap-2">
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Convidar usuário
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Convidar usuário</DialogTitle>
                  <DialogDescription>
                    Escolha o workspace ao qual o usuário será adicionado. Ele receberá um email
                    para definir senha.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={submitInvite} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Workspace</Label>
                    <Select
                      value={inviteForm.workspace_id}
                      onValueChange={(v) => setInviteForm((f) => ({ ...f, workspace_id: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um workspace" />
                      </SelectTrigger>
                      <SelectContent>
                        {(list.data ?? []).map((w) => (
                          <SelectItem key={w.id} value={w.id}>
                            {w.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="iu-name">Nome completo</Label>
                    <Input
                      id="iu-name"
                      required
                      value={inviteForm.full_name}
                      onChange={(e) => setInviteForm((f) => ({ ...f, full_name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="iu-email">Email</Label>
                    <EmailInput
                      id="iu-email"
                      required
                      value={inviteForm.email}
                      onChange={(v) => setInviteForm((f) => ({ ...f, email: v }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="iu-phone">Telefone (opcional)</Label>
                    <PhoneInput
                      id="iu-phone"
                      value={inviteForm.phone}
                      onChange={(v) => setInviteForm((f) => ({ ...f, phone: v }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Papel</Label>
                    <Select
                      value={inviteForm.role}
                      onValueChange={(v) =>
                        setInviteForm((f) => ({ ...f, role: v as "admin" | "member" }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin do workspace</SelectItem>
                        <SelectItem value="member">Membro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => setInviteOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={invite.isPending}>
                      {invite.isPending ? "Enviando…" : "Enviar convite"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo workspace
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar workspace</DialogTitle>
                  <DialogDescription>
                    Um email de convite será enviado ao administrador para definir senha.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={submit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="ws-name">Nome da empresa</Label>
                    <Input
                      id="ws-name"
                      required
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ws-slug">Slug (identificador)</Label>
                    <Input
                      id="ws-slug"
                      required
                      value={form.slug}
                      placeholder="ex: acme-corp"
                      onChange={(e) =>
                        setForm((f) => ({ ...f, slug: e.target.value.toLowerCase() }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ws-admin-name">Nome do admin</Label>
                    <Input
                      id="ws-admin-name"
                      required
                      value={form.admin_name}
                      onChange={(e) => setForm((f) => ({ ...f, admin_name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ws-admin-email">Email do admin</Label>
                    <EmailInput
                      id="ws-admin-email"
                      required
                      value={form.admin_email}
                      onChange={(v) => setForm((f) => ({ ...f, admin_email: v }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ws-admin-phone">Telefone (opcional)</Label>
                    <PhoneInput
                      id="ws-admin-phone"
                      value={form.admin_phone}
                      onChange={(v) => setForm((f) => ({ ...f, admin_phone: v }))}
                    />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={create.isPending}>
                      {create.isPending ? "Criando…" : "Criar workspace"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList>
          <TabsTrigger value="active">Ativos</TabsTrigger>
          <TabsTrigger value="suspended">Suspensos</TabsTrigger>
          <TabsTrigger value="deleted">Lixeira</TabsTrigger>
          <TabsTrigger value="all">Todos</TabsTrigger>
        </TabsList>
      </Tabs>

      {list.isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando workspaces…</div>
      ) : (
        (() => {
          const rows = (list.data ?? []).filter((w) =>
            filter === "all" ? true : w.status === filter,
          );
          if (rows.length === 0) {
            return (
              <div className="text-sm text-muted-foreground">
                Nenhum workspace nesta visualização.
              </div>
            );
          }
          return (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {rows.map((w) => {
                const isDeleted = w.status === "deleted";
                return (
                  <Card
                    key={w.id}
                    className={isDeleted ? "opacity-70" : "hover:border-primary transition-colors"}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base flex items-center gap-2 min-w-0">
                          <Building2 className="h-4 w-4 shrink-0" />
                          <span className="truncate">{w.name}</span>
                        </CardTitle>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {!isDeleted && (
                              <>
                                <DropdownMenuItem asChild>
                                  <Link to="/admin/workspaces/$id" params={{ id: w.id as string }}>
                                    Abrir
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setEditTarget(w)}>
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onSelect={() => setDeleteTarget(w)}
                                >
                                  Excluir
                                </DropdownMenuItem>
                              </>
                            )}
                            {isDeleted && (
                              <>
                                <DropdownMenuItem onSelect={() => setRestoreTarget(w)}>
                                  Restaurar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onSelect={() => setPurgeTarget(w)}
                                >
                                  Excluir definitivamente
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <CardDescription className="text-xs">/{w.slug}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Badge
                        variant={
                          w.status === "active"
                            ? "default"
                            : w.status === "deleted"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {w.status}
                      </Badge>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {w.member_count}
                      </span>
                      {w.custom_domain && (
                        <span className="truncate text-xs">{w.custom_domain}</span>
                      )}
                      {!isDeleted && (
                        <Link
                          to="/admin/workspaces/$id"
                          params={{ id: w.id as string }}
                          className="ml-auto text-muted-foreground hover:text-foreground"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          );
        })()
      )}

      {editTarget && (
        <EditWorkspaceDialog
          workspace={editTarget}
          open={!!editTarget}
          onOpenChange={(v) => !v && setEditTarget(null)}
        />
      )}
      {deleteTarget && (
        <SoftDeleteWorkspaceDialog
          workspace={deleteTarget}
          open={!!deleteTarget}
          onOpenChange={(v) => !v && setDeleteTarget(null)}
        />
      )}
      {restoreTarget && (
        <RestoreWorkspaceDialog
          workspace={restoreTarget}
          open={!!restoreTarget}
          onOpenChange={(v) => !v && setRestoreTarget(null)}
        />
      )}
      {purgeTarget && (
        <PurgeWorkspaceDialog
          workspace={purgeTarget}
          open={!!purgeTarget}
          onOpenChange={(v) => !v && setPurgeTarget(null)}
        />
      )}
    </div>
  );
}
