import { getPublicAppUrl } from "@/lib/app-url";
// Super-admin: gerencia membros de um workspace específico.
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useIsPlatformAdmin } from "@/lib/use-platform-admin";
import {
  listAllWorkspaces,
  listWorkspaceMembersAdmin,
  inviteUserToWorkspace,
  removeWorkspaceMember,
} from "@/lib/platform-admin.functions";
import { ArrowLeft, Plus, ShieldAlert, Trash2, Pencil, AlertTriangle } from "lucide-react";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  EditWorkspaceDialog,
  SoftDeleteWorkspaceDialog,
  RestoreWorkspaceDialog,
  PurgeWorkspaceDialog,
} from "@/components/admin/workspace-lifecycle-dialogs";

export const Route = createFileRoute("/_authenticated/admin/workspaces/$id")({
  component: WorkspaceDetailPage,
});

function WorkspaceDetailPage() {
  const { id } = Route.useParams();
  const { isPlatformAdmin, loading } = useIsPlatformAdmin();
  const listWs = useServerFn(listAllWorkspaces);
  const listMembers = useServerFn(listWorkspaceMembersAdmin);
  const invite = useServerFn(inviteUserToWorkspace);
  const remove = useServerFn(removeWorkspaceMember);
  const qc = useQueryClient();

  const wsQuery = useQuery({
    queryKey: ["admin-workspaces"],
    enabled: isPlatformAdmin,
    queryFn: () => listWs(),
  });
  const ws = (wsQuery.data ?? []).find((w) => w.id === id);

  const members = useQuery({
    queryKey: ["admin-workspace-members", id],
    enabled: isPlatformAdmin,
    queryFn: () => listMembers({ data: { workspace_id: id } }),
  });

  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [form, setForm] = useState({
    email: "",
    full_name: "",
    phone: "",
    role: "member" as "admin" | "member",
  });

  const invMut = useMutation({
    mutationFn: () =>
      invite({
        data: {
          workspace_id: id,
          email: form.email.trim(),
          full_name: form.full_name.trim(),
          phone: form.phone.trim() || undefined,
          role: form.role,
          redirect_origin: getPublicAppUrl(),
        },
      }),
    onSuccess: () => {
      toast.success("Convite enviado!");
      setOpen(false);
      setForm({ email: "", full_name: "", phone: "", role: "member" });
      qc.invalidateQueries({ queryKey: ["admin-workspace-members", id] });
      qc.invalidateQueries({ queryKey: ["admin-workspaces"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao convidar"),
  });

  const rmMut = useMutation({
    mutationFn: (user_id: string) => remove({ data: { workspace_id: id, user_id } }),
    onSuccess: () => {
      toast.success("Membro removido.");
      qc.invalidateQueries({ queryKey: ["admin-workspace-members", id] });
      qc.invalidateQueries({ queryKey: ["admin-workspaces"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao remover"),
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
    if (!form.email || !form.full_name) return;
    invMut.mutate();
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <Link
          to="/admin/workspaces"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Workspaces
        </Link>
      </div>
      <PageHeader
        title={ws?.name ?? "Workspace"}
        description={ws ? `/${ws.slug} · ${ws.status}` : "Carregando…"}
        actions={
          <div className="flex gap-2">
            {ws && (
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </Button>
            )}
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button disabled={ws?.status === "deleted"}>
                  <Plus className="h-4 w-4 mr-2" />
                  Convidar usuário
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Convidar usuário</DialogTitle>
                  <DialogDescription>
                    O usuário receberá um email para definir senha e acessar o workspace.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={submit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="m-name">Nome completo</Label>
                    <Input
                      id="m-name"
                      required
                      value={form.full_name}
                      onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="m-email">Email</Label>
                    <EmailInput
                      id="m-email"
                      required
                      value={form.email}
                      onChange={(v) => setForm((f) => ({ ...f, email: v }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="m-phone">Telefone (opcional)</Label>
                    <PhoneInput
                      id="m-phone"
                      value={form.phone}
                      onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Papel</Label>
                    <Select
                      value={form.role}
                      onValueChange={(v) =>
                        setForm((f) => ({ ...f, role: v as "admin" | "member" }))
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
                    <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={invMut.isPending}>
                      {invMut.isPending ? "Enviando…" : "Enviar convite"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Membros</CardTitle>
        </CardHeader>
        <CardContent>
          {members.isLoading ? (
            <div className="text-sm text-muted-foreground">Carregando membros…</div>
          ) : (members.data ?? []).length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhum membro ainda.</div>
          ) : (
            <div className="divide-y">
              {(members.data ?? []).map((m) => (
                <div key={m.user_id} className="flex items-center justify-between py-3 gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {m.full_name || m.email || m.user_id}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{m.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={m.role === "admin" ? "default" : "secondary"}>{m.role}</Badge>
                    {m.pending && <Badge variant="outline">pendente</Badge>}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={async () => {
                        if ((await confirmDialog(`Remover ${m.full_name || m.email}?`))) rmMut.mutate(m.user_id);
                      }}
                      disabled={rmMut.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {ws && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Zona de perigo
            </CardTitle>
            <CardDescription>
              Ações irreversíveis ou de alto impacto. Restritas a super-admins da plataforma.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {ws.status !== "deleted" ? (
              <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir workspace
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setRestoreOpen(true)}>
                  Restaurar
                </Button>
                <Button variant="destructive" onClick={() => setPurgeOpen(true)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir definitivamente
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {ws && (
        <>
          <EditWorkspaceDialog workspace={ws} open={editOpen} onOpenChange={setEditOpen} />
          <SoftDeleteWorkspaceDialog
            workspace={ws}
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
          />
          <RestoreWorkspaceDialog
            workspace={ws}
            open={restoreOpen}
            onOpenChange={setRestoreOpen}
          />
          <PurgeWorkspaceDialog workspace={ws} open={purgeOpen} onOpenChange={setPurgeOpen} />
        </>
      )}
    </div>
  );
}
