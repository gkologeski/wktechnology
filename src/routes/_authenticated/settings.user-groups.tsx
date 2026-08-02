// Página /settings/user-groups — equipes (grupos nomeados de usuários) do workspace.
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichHtmlEditor, HtmlContent, htmlToPlain } from "@/components/rich-html-editor";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import {
  listUserGroups,
  createUserGroup,
  updateUserGroup,
  deleteUserGroup,
  setGroupMembers,
} from "@/lib/user-groups.functions";
import { listTeamMembers } from "@/lib/teams.functions";
import { confirmDialog } from "@/components/ui/confirm-dialog";

export const Route = createFileRoute("/_authenticated/settings/user-groups")({
  component: UserGroupsPage,
});

const COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#6b7280",
];

type Group = {
  id: string;
  name: string;
  color: string | null;
  description: string | null;
  member_ids: string[];
};

function UserGroupsPage() {
  const listFn = useServerFn(listUserGroups);
  const createFn = useServerFn(createUserGroup);
  const updateFn = useServerFn(updateUserGroup);
  const deleteFn = useServerFn(deleteUserGroup);
  const membersFn = useServerFn(setGroupMembers);
  const teamFn = useServerFn(listTeamMembers);
  const qc = useQueryClient();

  const groupsQ = useQuery({ queryKey: ["user-groups"], queryFn: () => listFn() });
  const teamQ = useQuery({ queryKey: ["user-groups-team"], queryFn: () => teamFn() });

  const groups = (groupsQ.data?.groups ?? []) as Group[];
  const team = teamQ.data ?? [];

  const [editing, setEditing] = useState<Group | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<{ name: string; color: string; description: string }>({
    name: "",
    color: COLORS[0],
    description: "",
  });
  const [memberDraft, setMemberDraft] = useState<string[]>([]);

  const openCreate = () => {
    setDraft({ name: "", color: COLORS[0], description: "" });
    setMemberDraft([]);
    setCreating(true);
  };
  const openEdit = (g: Group) => {
    setEditing(g);
    setDraft({ name: g.name, color: g.color ?? COLORS[0], description: g.description ?? "" });
    setMemberDraft(g.member_ids);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        await updateFn({
          data: {
            id: editing.id,
            name: draft.name,
            color: draft.color,
            description: htmlToPlain(draft.description).trim() ? draft.description : null,
          },
        });
        await membersFn({ data: { group_id: editing.id, user_ids: memberDraft } });
      } else {
        const res = await createFn({
          data: { name: draft.name, color: draft.color, description: htmlToPlain(draft.description).trim() ? draft.description : null },
        });
        if (memberDraft.length)
          await membersFn({ data: { group_id: res.id, user_ids: memberDraft } });
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Equipe atualizada" : "Equipe criada");
      setEditing(null);
      setCreating(false);
      qc.invalidateQueries({ queryKey: ["user-groups"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Equipe removida");
      qc.invalidateQueries({ queryKey: ["user-groups"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const toggleMember = (uid: string) =>
    setMemberDraft((cur) => (cur.includes(uid) ? cur.filter((x) => x !== uid) : [...cur, uid]));

  const dialogOpen = creating || !!editing;
  const closeDialog = () => {
    setCreating(false);
    setEditing(null);
  };

  const nameById = useMemo(
    () => new Map(team.map((m) => [m.user_id, m.full_name || m.email || m.user_id])),
    [team],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Equipes"
        description="Agrupe usuários em equipes nomeadas (vendas, suporte, etc.) para relatórios e regras."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nova equipe
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Equipes do workspace</CardTitle>
        </CardHeader>
        <CardContent>
          {groupsQ.isLoading ? (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          ) : groups.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              Nenhuma equipe criada. Clique em <strong>Nova equipe</strong> para começar.
            </div>
          ) : (
            <div className="divide-y">
              {groups.map((g) => (
                <div key={g.id} className="flex items-start justify-between py-3 gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className="h-9 w-9 rounded-md flex items-center justify-center text-white shrink-0"
                      style={{ background: g.color ?? "#6b7280" }}
                    >
                      <Users className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium">{g.name}</div>
                      {g.description && htmlToPlain(g.description) && (
                        <HtmlContent
                          html={g.description}
                          className="text-xs text-muted-foreground line-clamp-2"
                        />
                      )}
                      <div className="mt-1 flex flex-wrap gap-1">
                        {g.member_ids.length === 0 ? (
                          <Badge variant="outline" className="text-xs">
                            sem membros
                          </Badge>
                        ) : (
                          g.member_ids.slice(0, 6).map((uid) => (
                            <Badge key={uid} variant="secondary" className="text-xs">
                              {nameById.get(uid) ?? uid.slice(0, 6)}
                            </Badge>
                          ))
                        )}
                        {g.member_ids.length > 6 && (
                          <Badge variant="outline" className="text-xs">
                            +{g.member_ids.length - 6}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(g)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={async () => {
                        if ((await confirmDialog(`Remover equipe "${g.name}"?`))) removeMutation.mutate(g.id);
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

      <Dialog open={dialogOpen} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar equipe" : "Nova equipe"}</DialogTitle>
            <DialogDescription>Defina nome, cor e selecione os membros.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="g-name">Nome</Label>
              <Input
                id="g-name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Ex: Vendas Inbound"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`h-7 w-7 rounded-full border-2 ${draft.color === c ? "border-foreground" : "border-transparent"}`}
                    style={{ background: c }}
                    onClick={() => setDraft({ ...draft, color: c })}
                    aria-label={`Cor ${c}`}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-desc">Descrição (opcional)</Label>
              <RichHtmlEditor
                value={draft.description}
                onChange={(html) => setDraft({ ...draft, description: html })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Membros ({memberDraft.length})</Label>
              <div className="border rounded-md max-h-64 overflow-auto divide-y">
                {team.length === 0 && (
                  <div className="p-3 text-sm text-muted-foreground">
                    Nenhum usuário no workspace.
                  </div>
                )}
                {team.map((m) => (
                  <label
                    key={m.user_id}
                    className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={memberDraft.includes(m.user_id)}
                      onCheckedChange={() => toggleMember(m.user_id)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm truncate">{m.full_name || "(sem nome)"}</div>
                      <div className="text-xs text-muted-foreground truncate">{m.email}</div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {m.role}
                    </Badge>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!draft.name.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
