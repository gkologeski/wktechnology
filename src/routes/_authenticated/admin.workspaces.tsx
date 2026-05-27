// Super-admin: lista e cria workspaces da plataforma.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";
import { useIsPlatformAdmin } from "@/lib/use-platform-admin";
import {
  listAllWorkspaces,
  createWorkspaceWithAdmin,
} from "@/lib/platform-admin.functions";
import { Plus, Building2, ShieldAlert, Users, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/workspaces")({
  component: WorkspacesAdminPage,
});

function WorkspacesAdminPage() {
  const { isPlatformAdmin, loading } = useIsPlatformAdmin();
  const listFn = useServerFn(listAllWorkspaces);
  const createFn = useServerFn(createWorkspaceWithAdmin);
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["admin-workspaces"],
    enabled: isPlatformAdmin,
    queryFn: () => listFn(),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", admin_email: "", admin_name: "", admin_phone: "" });

  const create = useMutation({
    mutationFn: async () => createFn({
      data: {
        name: form.name.trim(),
        slug: form.slug.trim(),
        admin_email: form.admin_email.trim(),
        admin_name: form.admin_name.trim(),
        admin_phone: form.admin_phone.trim() || undefined,
        redirect_origin: window.location.origin,
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

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;

  if (!isPlatformAdmin) {
    return (
      <div className="p-8 max-w-md mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5" />Acesso restrito</CardTitle>
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

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Workspaces da plataforma"
        description="Crie novos workspaces (empresas) e gerencie seus administradores."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Novo workspace</Button>
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
                  <Input id="ws-name" required value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ws-slug">Slug (identificador)</Label>
                  <Input id="ws-slug" required value={form.slug} placeholder="ex: acme-corp"
                    onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase() }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ws-admin-name">Nome do admin</Label>
                  <Input id="ws-admin-name" required value={form.admin_name}
                    onChange={(e) => setForm((f) => ({ ...f, admin_name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ws-admin-email">Email do admin</Label>
                  <EmailInput id="ws-admin-email" required value={form.admin_email}
                    onChange={(v) => setForm((f) => ({ ...f, admin_email: v }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ws-admin-phone">Telefone (opcional)</Label>
                  <PhoneInput id="ws-admin-phone" value={form.admin_phone}
                    onChange={(v) => setForm((f) => ({ ...f, admin_phone: v }))} />
                </div>
                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={create.isPending}>
                    {create.isPending ? "Criando…" : "Criar workspace"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {list.isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando workspaces…</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {(list.data ?? []).map((w) => (
            <Link
              key={w.id}
              to="/admin/workspaces/$id"
              params={{ id: w.id as string }}
              className="block"
            >
              <Card className="hover:border-primary transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      {w.name}
                    </CardTitle>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <CardDescription className="text-xs">/{w.slug}</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Badge variant={w.status === "active" ? "default" : "secondary"}>{w.status}</Badge>
                  <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{w.member_count}</span>
                  {w.custom_domain && <span className="truncate text-xs">{w.custom_domain}</span>}
                </CardContent>
              </Card>
            </Link>
          ))}
          {(list.data ?? []).length === 0 && (
            <div className="text-sm text-muted-foreground">Nenhum workspace ainda.</div>
          )}
        </div>
      )}
    </div>
  );
}
