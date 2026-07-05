// /settings/roles — lista de perfis de acesso configuráveis + atribuição por usuário.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { RichHtmlEditor, HtmlContent, htmlToPlain } from "@/components/rich-html-editor";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Pencil, Copy, Trash2, Plus, Shield } from "lucide-react";
import { toast } from "sonner";
import {
  listAccessProfiles,
  createAccessProfile,
  deleteAccessProfile,
  listProfileAssignments,
  assignProfileToUser,
} from "@/lib/access-profiles.functions";

export const Route = createFileRoute("/_authenticated/settings/roles/")({
  component: RolesPage,
});

type ProfileRow = Awaited<ReturnType<typeof listAccessProfiles>>[number];
type Assignment = Awaited<ReturnType<typeof listProfileAssignments>>[number];

function RolesPage() {
  const navigate = useNavigate();
  const listFn = useServerFn(listAccessProfiles);
  const createFn = useServerFn(createAccessProfile);
  const deleteFn = useServerFn(deleteAccessProfile);
  const listAssignFn = useServerFn(listProfileAssignments);
  const assignFn = useServerFn(assignProfileToUser);

  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  // dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "manager" | "member">("member");
  const [copyFrom, setCopyFrom] = useState<string>("none");
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const [p, a] = await Promise.all([listFn(), listAssignFn()]);
      setProfiles(p);
      setAssignments(a);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  const handleCreate = async () => {
    if (newName.trim().length < 2) {
      toast.error("Nome muito curto");
      return;
    }
    setSaving(true);
    try {
      const res = await createFn({
        data: {
          name: newName.trim(),
          description: htmlToPlain(newDesc).trim() ? newDesc : undefined,
          base_role: newRole,
          copy_from: copyFrom !== "none" ? copyFrom : undefined,
        },
      });
      toast.success("Perfil criado");
      setCreateOpen(false);
      setNewName("");
      setNewDesc("");
      setCopyFrom("none");
      setNewRole("member");
      navigate({ to: "/settings/roles/$roleId", params: { roleId: res.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar");
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (p: ProfileRow) => {
    try {
      const res = await createFn({
        data: {
          name: `${p.name} (cópia)`,
          description: p.description ?? undefined,
          base_role: p.base_role,
          copy_from: p.id,
        },
      });
      toast.success("Perfil duplicado");
      navigate({ to: "/settings/roles/$roleId", params: { roleId: res.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteFn({ data: { id } });
      toast.success("Perfil excluído");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const handleAssign = async (user_id: string, profile_id: string) => {
    try {
      await assignFn({ data: { user_id, profile_id } });
      toast.success("Perfil atribuído");
      setAssignments((rs) =>
        rs.map((r) => (r.user_id === user_id ? { ...r, access_profile_id: profile_id } : r)),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
        <p className="font-medium text-amber-700 dark:text-amber-400">Tela legada</p>
        <p className="text-muted-foreground mt-1">
          Esta tela permanece disponível para compatibilidade. Novas configurações de permissão devem ser feitas em{" "}
          <Link to="/home/access" className="underline font-medium text-foreground">Controle de Acesso</Link>{" "}
          (cargos, pacotes de permissão e regras de campo). Perfis criados aqui não são migrados automaticamente.
        </p>
      </div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Perfis de acesso</h2>
          <p className="text-sm text-muted-foreground">
            Crie perfis personalizados com permissões granulares por objeto e ferramentas.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/settings/roles/matrix">
            <Button variant="outline">
              <Shield className="h-4 w-4 mr-2" />
              Ver matriz de acesso
            </Button>
          </Link>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Criar perfil
              </Button>
            </DialogTrigger>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo perfil de acesso</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium">Nome</label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="ex: Comercial Pleno"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Descrição</label>
                  <RichHtmlEditor
                    value={newDesc}
                    onChange={setNewDesc}
                    placeholder="Para que serve este perfil…"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium">Papel base</label>
                    <Select
                      value={newRole}
                      onValueChange={(v) => setNewRole(v as "admin" | "manager" | "member")}
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
                  <div>
                    <label className="text-xs font-medium">Copiar de</label>
                    <Select value={copyFrom} onValueChange={setCopyFrom}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Em branco</SelectItem>
                        {profiles.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreate} disabled={saving}>
                  {saving ? "Criando…" : "Criar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Perfis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!loading &&
            profiles.map((p) => (
              <div
                key={p.id}
                className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center py-2 border-b last:border-0"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium">{p.name}</span>
                    {p.is_system && (
                      <Badge variant="secondary" className="text-[10px]">
                        Sistema
                      </Badge>
                    )}
                  </div>
                  {p.description && htmlToPlain(p.description) && (
                    <HtmlContent html={p.description} className="text-xs text-muted-foreground truncate" />
                  )}
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {p.user_count} usuário(s)
                </Badge>
                <Link to="/settings/roles/$roleId" params={{ roleId: p.id }}>
                  <Button size="sm" variant="outline">
                    <Pencil className="h-3.5 w-3.5 mr-1.5" />
                    Editar
                  </Button>
                </Link>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDuplicate(p)}
                    title="Duplicar"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  {!p.is_system && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" title="Excluir">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir "{p.name}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. Se houver usuários atribuídos, mova-os
                            antes.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(p.id)}>
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Atribuição por usuário</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!loading &&
            assignments.map((u) => (
              <div
                key={u.user_id}
                className="grid grid-cols-[1fr_220px] gap-3 items-center py-2 border-b last:border-0"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{u.full_name}</span>
                  {u.is_owner && <Badge variant="secondary">owner</Badge>}
                </div>
                {u.is_owner ? (
                  <Badge>Admin (fixo)</Badge>
                ) : (
                  <Select
                    value={u.access_profile_id ?? ""}
                    onValueChange={(v) => handleAssign(u.user_id, v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar perfil…" />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
