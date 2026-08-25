// Dialogs de edição, soft-delete, restauração e purge de workspace (super-admin).
import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";
import {
  updateWorkspaceAdmin,
  softDeleteWorkspaceAdmin,
  restoreWorkspaceAdmin,
  purgeWorkspaceAdmin,
} from "@/lib/platform-admin.functions";

type WorkspaceLite = {
  id: string;
  name: string;
  slug: string;
  status: string;
  custom_domain: string | null;
  primary_color: string | null;
};

function invalidate(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: ["admin-workspaces"] });
  qc.invalidateQueries({ queryKey: ["admin-workspace-members", id] });
}

export function EditWorkspaceDialog({
  workspace,
  open,
  onOpenChange,
}: {
  workspace: WorkspaceLite;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateWorkspaceAdmin);
  const [form, setForm] = useState({
    name: workspace.name,
    slug: workspace.slug,
    custom_domain: workspace.custom_domain ?? "",
    primary_color: workspace.primary_color ?? "",
    status: (workspace.status === "suspended" ? "suspended" : "active") as "active" | "suspended",
  });

  const mut = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          workspace_id: workspace.id,
          name: form.name.trim(),
          slug: form.slug.trim(),
          custom_domain: form.custom_domain.trim() || null,
          primary_color: form.primary_color.trim() || null,
          status: form.status,
        },
      }),
    onSuccess: () => {
      toast.success("Workspace atualizado.");
      invalidate(qc, workspace.id);
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao atualizar"),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.slug) return;
    mut.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar workspace</DialogTitle>
          <DialogDescription>
            Altere os dados básicos do workspace. Estas mudanças afetam todos os membros.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ew-name">Nome</Label>
            <Input
              id="ew-name"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ew-slug">Slug</Label>
            <Input
              id="ew-slug"
              required
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase() }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ew-domain">Domínio custom (opcional)</Label>
            <Input
              id="ew-domain"
              value={form.custom_domain}
              placeholder="app.exemplo.com"
              onChange={(e) => setForm((f) => ({ ...f, custom_domain: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ew-color">Cor primária (opcional)</Label>
            <Input
              id="ew-color"
              value={form.primary_color}
              placeholder="#3B82F6"
              onChange={(e) => setForm((f) => ({ ...f, primary_color: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => setForm((f) => ({ ...f, status: v as "active" | "suspended" }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="suspended">Suspenso</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mut.isPending}>
              {mut.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SoftDeleteWorkspaceDialog({
  workspace,
  open,
  onOpenChange,
}: {
  workspace: WorkspaceLite;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const fn = useServerFn(softDeleteWorkspaceAdmin);
  const mut = useMutation({
    mutationFn: () => fn({ data: { workspace_id: workspace.id } }),
    onSuccess: () => {
      toast.success("Workspace movido para a lixeira.");
      invalidate(qc, workspace.id);
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao excluir"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Excluir workspace
          </DialogTitle>
          <DialogDescription>
            O workspace <strong>{workspace.name}</strong> será marcado como excluído. Membros perdem
            o acesso imediatamente, mas os dados são preservados e podem ser restaurados.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? "Excluindo…" : "Excluir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RestoreWorkspaceDialog({
  workspace,
  open,
  onOpenChange,
}: {
  workspace: WorkspaceLite;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const fn = useServerFn(restoreWorkspaceAdmin);
  const mut = useMutation({
    mutationFn: () => fn({ data: { workspace_id: workspace.id } }),
    onSuccess: () => {
      toast.success("Workspace restaurado.");
      invalidate(qc, workspace.id);
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao restaurar"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restaurar workspace</DialogTitle>
          <DialogDescription>
            O workspace <strong>{workspace.name}</strong> voltará a ficar ativo e os membros
            recuperarão o acesso.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? "Restaurando…" : "Restaurar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PurgeWorkspaceDialog({
  workspace,
  open,
  onOpenChange,
}: {
  workspace: WorkspaceLite;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const fn = useServerFn(purgeWorkspaceAdmin);
  const [confirm, setConfirm] = useState("");
  const mut = useMutation({
    mutationFn: () => fn({ data: { workspace_id: workspace.id, confirm_name: confirm.trim() } }),
    onSuccess: () => {
      toast.success("Workspace excluído definitivamente.");
      qc.invalidateQueries({ queryKey: ["admin-workspaces"] });
      setConfirm("");
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao excluir"),
  });

  const canSubmit = confirm.trim() === workspace.name && !mut.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setConfirm("");
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Excluir definitivamente
          </DialogTitle>
          <DialogDescription>
            Esta ação é <strong>irreversível</strong>. Todos os dados de{" "}
            <strong>{workspace.name}</strong> (contatos, negócios, contratos, arquivos, etc.) serão
            apagados em cascata. Para confirmar, digite o nome do workspace abaixo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="pw-confirm">
            Digite <span className="font-mono">{workspace.name}</span>
          </Label>
          <Input
            id="pw-confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={workspace.name}
            autoComplete="off"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={() => mut.mutate()} disabled={!canSubmit}>
            {mut.isPending ? "Excluindo…" : "Excluir definitivamente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
