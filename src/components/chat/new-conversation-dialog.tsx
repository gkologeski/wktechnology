// Dialog para iniciar nova conversa (DM ou grupo).
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import { useAuth } from "@/lib/auth";
import { getOrCreateDM, createGroup } from "@/lib/chat.functions";

export function NewConversationDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (conversationId: string) => void;
}) {
  const { user } = useAuth();
  const { data: members = [] } = useWorkspaceMembers();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groupTitle, setGroupTitle] = useState("");

  const dmFn = useServerFn(getOrCreateDM);
  const groupFn = useServerFn(createGroup);

  const others = useMemo(
    () => members.filter((m) => m.user_id !== user?.id),
    [members, user?.id],
  );
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return others;
    return others.filter((m) => (m.full_name || "").toLowerCase().includes(q));
  }, [others, search]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const reset = () => {
    setSearch("");
    setSelected(new Set());
    setGroupTitle("");
  };

  const create = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected);
      if (ids.length === 0) throw new Error("Selecione ao menos um membro.");
      if (ids.length === 1) {
        const res = await dmFn({ data: { other_user_id: ids[0] } });
        return res.conversation_id;
      }
      const title = groupTitle.trim() || ids.map((id) => members.find((m) => m.user_id === id)?.full_name || "").filter(Boolean).slice(0, 3).join(", ");
      const res = await groupFn({ data: { title, member_user_ids: ids } });
      return res.conversation_id;
    },
    onSuccess: (cid) => {
      reset();
      onCreated(cid);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova conversa</DialogTitle>
          <DialogDescription>
            Selecione 1 membro para iniciar uma conversa direta, ou 2+ para criar um grupo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Buscar membro…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <ScrollArea className="h-64 border rounded">
            <ul className="divide-y">
              {filtered.length === 0 && (
                <li className="p-3 text-sm text-muted-foreground text-center">Nenhum membro encontrado.</li>
              )}
              {filtered.map((m) => (
                <li key={m.user_id}>
                  <label className="flex items-center gap-3 p-2.5 hover:bg-muted/50 cursor-pointer">
                    <Checkbox checked={selected.has(m.user_id)} onCheckedChange={() => toggle(m.user_id)} />
                    <span className="text-sm flex-1 truncate">{m.full_name || m.user_id.slice(0, 8)}</span>
                  </label>
                </li>
              ))}
            </ul>
          </ScrollArea>
          {selected.size >= 2 && (
            <div className="space-y-1">
              <Label htmlFor="g-title">Nome do grupo (opcional)</Label>
              <Input id="g-title" value={groupTitle} onChange={(e) => setGroupTitle(e.target.value)} placeholder="Ex: Squad Vendas" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending || selected.size === 0}>
            {create.isPending ? "Criando…" : selected.size >= 2 ? "Criar grupo" : "Iniciar conversa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
