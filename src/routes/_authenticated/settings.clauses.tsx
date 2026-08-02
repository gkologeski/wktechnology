import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listClauses, createClause, updateClause, deleteClause } from "@/lib/proposals.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { WordEditor } from "@/components/word-editor-lazy";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/ui/confirm-dialog";

export const Route = createFileRoute("/_authenticated/settings/clauses")({
  component: ClausesPage,
});

function ClausesPage() {
  const qc = useQueryClient();
  const list = useServerFn(listClauses);
  const create = useServerFn(createClause);
  const upd = useServerFn(updateClause);
  const del = useServerFn(deleteClause);

  const { data } = useQuery({ queryKey: ["clauses"], queryFn: () => list() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ slug: "", title: "", category: "", body: "" });

  const createM = useMutation({
    mutationFn: () =>
      create({
        data: {
          slug: form.slug,
          title: form.title,
          category: form.category || undefined,
          body: form.body,
        },
      }),
    onSuccess: () => {
      toast.success("Cláusula criada");
      setOpen(false);
      setForm({ slug: "", title: "", category: "", body: "" });
      qc.invalidateQueries({ queryKey: ["clauses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const updM = useMutation({
    mutationFn: (v: { id: string; body: string }) =>
      upd({ data: { id: v.id, patch: { body: v.body } } }),
    onSuccess: () => {
      toast.success("Atualizado");
      qc.invalidateQueries({ queryKey: ["clauses"] });
    },
  });
  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["clauses"] });
    },
  });

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Biblioteca de cláusulas</h1>
          <p className="text-sm text-muted-foreground">
            Textos reutilizáveis (LGPD, SLA, garantia) para inserir em propostas.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova cláusula
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova cláusula</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Slug</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="lgpd"
                />
              </div>
              <div className="space-y-1">
                <Label>Título</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Categoria</Label>
                <Input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="LGPD, SLA, Garantia…"
                />
              </div>
              <div className="space-y-1">
                <Label>Corpo</Label>
                <WordEditor
                  value={form.body}
                  onChange={(html) => setForm({ ...form, body: html })}
                  minHeight={280}
                  placeholder="Escreva o conteúdo da cláusula…"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => createM.mutate()}
                disabled={!form.slug || !form.title || createM.isPending}
              >
                Criar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {(data ?? []).map((c) => (
          <ClauseCard
            key={c.id}
            clause={c}
            onSave={(body) => updM.mutate({ id: c.id, body })}
            onDelete={async () => {
              if (await confirmDialog("Excluir cláusula?")) delM.mutate(c.id);
            }}
          />
        ))}
        {(data ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma cláusula ainda.</p>
        )}
      </div>
    </div>
  );
}

function ClauseCard({
  clause,
  onSave,
  onDelete,
}: {
  clause: { id: string; slug: string; title: string; category: string | null; body: string };
  onSave: (body: string) => void;
  onDelete: () => void;
}) {
  const [body, setBody] = useState(clause.body);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span>{clause.title}</span>
          <code className="text-xs text-muted-foreground">/{clause.slug}</code>
        </CardTitle>
        {clause.category && <p className="text-xs text-muted-foreground">{clause.category}</p>}
      </CardHeader>
      <CardContent className="space-y-2">
        <WordEditor value={body} onChange={setBody} minHeight={220} />
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" onClick={() => onSave(body)}>
            <Save className="mr-2 h-3.5 w-3.5" />
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
