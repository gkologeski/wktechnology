import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichHtmlEditor, htmlToPlain } from "@/components/rich-html-editor";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { TokenPills } from "@/components/ui/token-pills";
import { MACRO_TOKENS } from "@/lib/message-tokens-catalog";


export const Route = createFileRoute("/_authenticated/settings/macros")({
  component: MacrosPage,
});

type Macro = {
  id: string;
  owner_id: string;
  name: string;
  shortcut: string | null;
  category: string | null;
  body: string;
  enabled: boolean;
};

type Draft = Partial<Macro>;

function MacrosPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Macro | null>(null);
  const [draft, setDraft] = useState<Draft>({});

  const { data: macros = [], isLoading } = useQuery({
    queryKey: ["macros"],
    queryFn: async () => {
      const { data, error } = await supabase.from("macros").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Macro[];
    },
  });

  function openNew() {
    setEditing(null);
    setDraft({ enabled: true });
    setOpen(true);
  }
  function openEdit(m: Macro) {
    setEditing(m);
    setDraft({ ...m });
    setOpen(true);
  }
  async function save() {
    if (!user) return;
    if (!draft.name?.trim() || !htmlToPlain(draft.body ?? "").trim()) {
      toast.error("Informe nome e corpo.");
      return;
    }
    const payload = {
      name: draft.name!.trim(),
      shortcut: draft.shortcut?.trim() || null,
      category: draft.category?.trim() || null,
      body: draft.body!,
      enabled: draft.enabled ?? true,
    };
    const { error } = editing
      ? await supabase.from("macros").update(payload).eq("id", editing.id)
      : await supabase.from("macros").insert({ ...payload, owner_id: user.id });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? "Macro atualizada." : "Macro criada.");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["macros"] });
  }
  async function remove(id: string) {
    if (!confirm("Excluir esta macro?")) return;
    const { error } = await supabase.from("macros").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["macros"] });
  }
  async function toggle(m: Macro, enabled: boolean) {
    const { error } = await supabase.from("macros").update({ enabled }).eq("id", m.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["macros"] });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Macros / respostas prontas</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Modelos reutilizáveis em tickets. Tokens disponíveis:{" "}
            <code className="text-xs">{"{{contact_first_name}}"}</code>,{" "}
            <code className="text-xs">{"{{contact_name}}"}</code>,{" "}
            <code className="text-xs">{"{{company_name}}"}</code>,{" "}
            <code className="text-xs">{"{{ticket_subject}}"}</code>,{" "}
            <code className="text-xs">{"{{agent_name}}"}</code>.
          </p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Nova macro
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : macros.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma macro cadastrada.</p>
        ) : (
          <div className="space-y-2">
            {macros.map((m) => (
              <div
                key={m.id}
                className="flex items-start justify-between gap-3 rounded-md border p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{m.name}</span>
                    {m.shortcut && (
                      <Badge variant="outline" className="font-mono text-xs">
                        /{m.shortcut}
                      </Badge>
                    )}
                    {m.category && (
                      <Badge variant="secondary" className="text-xs">
                        {m.category}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3 mt-1">
                    {htmlToPlain(m.body)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Switch checked={m.enabled} onCheckedChange={(v) => toggle(m, v)} />
                  <Button variant="ghost" size="icon" onClick={() => openEdit(m)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(m.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar macro" : "Nova macro"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input
                  value={draft.name ?? ""}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Atalho</Label>
                <Input
                  placeholder="ola-cliente"
                  value={draft.shortcut ?? ""}
                  onChange={(e) => setDraft({ ...draft, shortcut: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Input
                placeholder="Suporte, Vendas…"
                value={draft.category ?? ""}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Corpo *</Label>
              <RichHtmlEditor
                value={draft.body ?? ""}
                onChange={(html) => setDraft({ ...draft, body: html })}
                minHeight={200}
                placeholder="Olá {{contact_first_name}}, recebemos seu chamado…"
              />
              <TokenPills
                tokens={MACRO_TOKENS}
                onInsert={(t) => {
                  const active = typeof document !== "undefined" ? document.activeElement : null;
                  if (active && (active as HTMLElement).isContentEditable) {
                    try {
                      document.execCommand("insertText", false, t);
                      return;
                    } catch {
                      /* fallback */
                    }
                  }
                  setDraft((prev) => ({ ...prev, body: (prev.body ?? "") + t }));
                }}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={draft.enabled ?? true}
                onCheckedChange={(v) => setDraft({ ...draft, enabled: v })}
              />
              <Label className="cursor-pointer">Ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save}>{editing ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
