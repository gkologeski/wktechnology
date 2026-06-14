// Página /settings/workspace-team — admin do workspace gerencia membros e convites por token.
import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmailInput } from "@/components/ui/email-input";
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
import { Plus, Trash2, Copy, Link as LinkIcon } from "lucide-react";
import {
  listWorkspaceTeam,
  createWorkspaceInvite,
  revokeWorkspaceInvite,
  removeWorkspaceMemberFn,
  updateWorkspaceMemberRole,
  countAssignedToMember,
} from "@/lib/workspace-invites.functions";

export const Route = createFileRoute("/_authenticated/settings/workspace-team")({
  component: WorkspaceTeamPage,
});

type Role = "admin" | "manager" | "member";

function WorkspaceTeamPage() {
  const listFn = useServerFn(listWorkspaceTeam);
  const inviteFn = useServerFn(createWorkspaceInvite);
  const revokeFn = useServerFn(revokeWorkspaceInvite);
  const removeFn = useServerFn(removeWorkspaceMemberFn);
  const roleFn = useServerFn(updateWorkspaceMemberRole);
  const countFn = useServerFn(countAssignedToMember);
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["workspace-team"], queryFn: () => listFn() });

  type RemoveTarget = {
    user_id: string;
    label: string;
    counts: Record<string, number>;
    total: number;
  };
  const [removeTarget, setRemoveTarget] = useState<RemoveTarget | null>(null);
  const [reassignTo, setReassignTo] = useState<string>("__none__");

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ email: string; role: Role }>({ email: "", role: "member" });
  const [lastUrl, setLastUrl] = useState<string | null>(null);

  const invite = useMutation({
    mutationFn: () =>
      inviteFn({
        data: {
          email: form.email.trim(),
          role: form.role,
          redirect_origin: window.location.origin,
        },
      }),
    onSuccess: (res) => {
      toast.success("Convite criado.");
      setLastUrl(res.url);
      setForm({ email: "", role: "member" });
      qc.invalidateQueries({ queryKey: ["workspace-team"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao criar convite"),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => revokeFn({ data: { invite_id: id } }),
    onSuccess: () => {
      toast.success("Convite revogado.");
      qc.invalidateQueries({ queryKey: ["workspace-team"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const remove = useMutation({
    mutationFn: (uid: string) => removeFn({ data: { user_id: uid } }),
    onSuccess: () => {
      toast.success("Membro removido.");
      qc.invalidateQueries({ queryKey: ["workspace-team"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const changeRole = useMutation({
    mutationFn: (p: { uid: string; role: Role }) =>
      roleFn({ data: { user_id: p.uid, role: p.role } }),
    onSuccess: () => {
      toast.success("Papel atualizado.");
      qc.invalidateQueries({ queryKey: ["workspace-team"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.email) return;
    invite.mutate();
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Equipe do workspace"
        description="Gerencie membros e gere convites por link para o workspace ativo."
        actions={
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) setLastUrl(null);
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo convite
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Convidar membro</DialogTitle>
                <DialogDescription>
                  Será gerado um link único de aceite. Envie ao convidado por qualquer canal.
                </DialogDescription>
              </DialogHeader>
              {lastUrl ? (
                <div className="space-y-3">
                  <Label>Link de aceite (válido por 14 dias)</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={lastUrl} />
                    <Button type="button" variant="secondary" onClick={() => copy(lastUrl)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => {
                        setLastUrl(null);
                        setOpen(false);
                      }}
                    >
                      Concluir
                    </Button>
                  </DialogFooter>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="wi-email">Email do convidado</Label>
                    <EmailInput
                      id="wi-email"
                      required
                      value={form.email}
                      onChange={(v) => setForm((f) => ({ ...f, email: v }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Papel</Label>
                    <Select
                      value={form.role}
                      onValueChange={(v) => setForm((f) => ({ ...f, role: v as Role }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="manager">Gestor</SelectItem>
                        <SelectItem value="member">Membro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={invite.isPending}>
                      {invite.isPending ? "Gerando…" : "Gerar link"}
                    </Button>
                  </DialogFooter>
                </form>
              )}
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Membros</CardTitle>
        </CardHeader>
        <CardContent>
          {q.isLoading ? (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          ) : (q.data?.members ?? []).length === 0 ? (
            <div className="text-sm text-muted-foreground">Sem membros.</div>
          ) : (
            <div className="divide-y">
              {q.data!.members.map((m) => (
                <div key={m.user_id} className="flex items-center justify-between py-3 gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {m.full_name || m.email || m.user_id}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{m.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={m.role}
                      onValueChange={(v) => changeRole.mutate({ uid: m.user_id, role: v as Role })}
                    >
                      <SelectTrigger className="h-8 w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="manager">Gestor</SelectItem>
                        <SelectItem value="member">Membro</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Remover ${m.full_name || m.email}?`)) remove.mutate(m.user_id);
                      }}
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Convites pendentes</CardTitle>
        </CardHeader>
        <CardContent>
          {(q.data?.invites ?? []).length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhum convite pendente.</div>
          ) : (
            <div className="divide-y">
              {q.data!.invites.map((i) => (
                <div key={i.id} className="flex items-center justify-between py-3 gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{i.email}</div>
                    <div className="text-xs text-muted-foreground">
                      expira em {new Date(i.expires_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{i.role}</Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const url = `${window.location.origin}/accept-invite/${""}`; // placeholder, real URL is shown at creation
                        void url;
                        toast.info(
                          "Reabra o link no momento da criação ou revogue e gere um novo.",
                        );
                      }}
                    >
                      <LinkIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Revogar convite de ${i.email}?`)) revoke.mutate(i.id);
                      }}
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
    </div>
  );
}
