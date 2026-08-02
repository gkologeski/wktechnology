import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listKbCategoriesAdmin,
  upsertKbCategory,
  deleteKbCategory,
  listKbArticlesAdmin,
  getKbArticleAdmin,
  upsertKbArticle,
  deleteKbArticle,
  seedStarterKb,
} from "@/lib/kb.functions";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RichHtmlEditor } from "@/components/rich-html-editor";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Plus, Eye } from "lucide-react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/ui/confirm-dialog";

export const Route = createFileRoute("/_authenticated/settings/kb")({
  component: KbAdminPage,
});

function KbAdminPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Base de conhecimento"
        description="Artigos públicos que ajudam clientes a se auto-atender."
      />
      <Tabs defaultValue="articles">
        <TabsList>
          <TabsTrigger value="articles">Artigos</TabsTrigger>
          <TabsTrigger value="categories">Categorias</TabsTrigger>
        </TabsList>
        <TabsContent value="articles" className="mt-4">
          <ArticlesTab />
        </TabsContent>
        <TabsContent value="categories" className="mt-4">
          <CategoriesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CategoriesTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listKbCategoriesAdmin);
  const upsertFn = useServerFn(upsertKbCategory);
  const delFn = useServerFn(deleteKbCategory);
  const { data = [] } = useQuery({ queryKey: ["kb-cats"], queryFn: () => listFn() });
  const [editing, setEditing] = useState<{ id?: string; name: string; description: string } | null>(
    null,
  );
  const save = useMutation({
    mutationFn: (v: { id?: string; name: string; description?: string }) =>
      upsertFn({ data: { ...v, position: 0 } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kb-cats"] });
      setEditing(null);
      toast.success("Salvo.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kb-cats"] });
      toast.success("Removido.");
    },
  });
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Categorias</CardTitle>
        <Button size="sm" onClick={() => setEditing({ name: "", description: "" })}>
          <Plus className="h-4 w-4 mr-1" />
          Nova
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                  Nenhuma categoria.
                </TableCell>
              </TableRow>
            )}
            {data.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-muted-foreground">{c.slug}</TableCell>
                <TableCell className="text-muted-foreground truncate max-w-xs">
                  {c.description ?? "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      setEditing({ id: c.id, name: c.name, description: c.description ?? "" })
                    }
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={async () => {
                      if (await confirmDialog("Remover?")) remove.mutate(c.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar categoria" : "Nova categoria"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Nome *</label>
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Descrição</label>
                <Textarea
                  rows={3}
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button
              disabled={!editing?.name.trim() || save.isPending}
              onClick={() =>
                editing &&
                save.mutate({
                  id: editing.id,
                  name: editing.name,
                  description: editing.description || undefined,
                })
              }
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ArticlesTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listKbArticlesAdmin);
  const catsFn = useServerFn(listKbCategoriesAdmin);
  const getFn = useServerFn(getKbArticleAdmin);
  const upsertFn = useServerFn(upsertKbArticle);
  const delFn = useServerFn(deleteKbArticle);
  const { data = [] } = useQuery({ queryKey: ["kb-arts"], queryFn: () => listFn() });
  const { data: cats = [] } = useQuery({ queryKey: ["kb-cats"], queryFn: () => catsFn() });

  type EditState = {
    id?: string;
    title: string;
    excerpt: string;
    body: string;
    category_id: string | null;
    published: boolean;
  };
  const [edit, setEdit] = useState<EditState | null>(null);

  const save = useMutation({
    mutationFn: (v: EditState) => upsertFn({ data: { ...v, category_id: v.category_id || null } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kb-arts"] });
      setEdit(null);
      toast.success("Salvo.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kb-arts"] });
      toast.success("Removido.");
    },
  });

  async function openEdit(id?: string) {
    if (!id) {
      setEdit({ title: "", excerpt: "", body: "", category_id: null, published: false });
      return;
    }
    const a = await getFn({ data: { id } });
    setEdit({
      id: a.id,
      title: a.title,
      excerpt: a.excerpt ?? "",
      body: a.body ?? "",
      category_id: a.category_id ?? null,
      published: !!a.published,
    });
  }

  const seedFn = useServerFn(seedStarterKb);
  const seed = useMutation({
    mutationFn: () => seedFn(),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["kb-arts"] });
      qc.invalidateQueries({ queryKey: ["kb-cats"] });
      toast.success(`Base inicial: ${r.created} criados, ${r.skipped} já existiam.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Artigos</CardTitle>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={seed.isPending}
            onClick={() => seed.mutate()}
          >
            Popular base inicial (12 artigos)
          </Button>
          <Button size="sm" onClick={() => openEdit()}>
            <Plus className="h-4 w-4 mr-1" />
            Novo
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Views</TableHead>
              <TableHead className="w-32"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                  Nenhum artigo.
                </TableCell>
              </TableRow>
            )}
            {data.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <div className="font-medium">{a.title}</div>
                  <div className="text-xs text-muted-foreground">/{a.slug}</div>
                </TableCell>
                <TableCell>
                  {a.published ? (
                    <Badge>Publicado</Badge>
                  ) : (
                    <Badge variant="outline">Rascunho</Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{a.views}</TableCell>
                <TableCell className="text-right">
                  {a.published && (
                    <Button size="icon" variant="ghost" asChild>
                      <a href={`/kb/${a.slug}`} target="_blank" rel="noreferrer">
                        <Eye className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => openEdit(a.id)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={async () => {
                      if (await confirmDialog("Remover?")) remove.mutate(a.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Editar artigo" : "Novo artigo"}</DialogTitle>
          </DialogHeader>
          {edit && (
            <div className="space-y-3 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="text-sm font-medium">Título *</label>
                <Input
                  value={edit.title}
                  onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Resumo</label>
                <Textarea
                  rows={2}
                  value={edit.excerpt}
                  onChange={(e) => setEdit({ ...edit, excerpt: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Categoria</label>
                <Select
                  value={edit.category_id ?? "none"}
                  onValueChange={(v) => setEdit({ ...edit, category_id: v === "none" ? null : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sem categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem categoria</SelectItem>
                    {cats.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Conteúdo</label>
                <RichHtmlEditor
                  value={edit.body}
                  onChange={(html) => setEdit({ ...edit, body: html })}
                  minHeight={320}
                  placeholder="Escreva o conteúdo do artigo…"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={edit.published}
                  onCheckedChange={(v) => setEdit({ ...edit, published: v })}
                />
                <label className="text-sm">Publicado</label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>
              Cancelar
            </Button>
            <Button
              disabled={!edit?.title.trim() || save.isPending}
              onClick={() => edit && save.mutate(edit)}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
