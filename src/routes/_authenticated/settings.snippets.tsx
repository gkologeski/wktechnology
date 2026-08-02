import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Copy, Trash2, Pencil, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SnippetFormDialog } from "@/components/snippets/snippet-form-dialog";
import {
  listSnippets as listSnippetsFn,
  deleteSnippet as deleteSnippetFn,
  type SnippetRow,
} from "@/lib/snippets.functions";
import { useMyRole } from "@/lib/use-my-role";
import { confirmDialog } from "@/components/ui/confirm-dialog";

export const Route = createFileRoute("/_authenticated/settings/snippets")({
  component: SnippetsSettings,
});

function SnippetsSettings() {
  const qc = useQueryClient();
  const list = useServerFn(listSnippetsFn);
  const del = useServerFn(deleteSnippetFn);
  const { isAdmin } = useMyRole();

  const [tab, setTab] = useState<"all" | "personal" | "shared">("all");
  const [q, setQ] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<SnippetRow> | null>(null);

  const query = useQuery({
    queryKey: ["snippets", tab, q],
    queryFn: () => list({ data: { visibility: tab, q: q || undefined } }),
  });

  const items = useMemo(() => query.data?.items ?? [], [query.data]);

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Snippet removido");
      qc.invalidateQueries({ queryKey: ["snippets"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao remover"),
  });

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (s: SnippetRow) => {
    setEditing(s);
    setDialogOpen(true);
  };
  const duplicate = (s: SnippetRow) => {
    setEditing({
      name: `${s.name} (cópia)`,
      shortcut: `${s.shortcut}-copia`,
      body_html: s.body_html,
      body_text: s.body_text,
      folder: s.folder,
      visibility: "personal",
    });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Snippets</h1>
          <p className="text-sm text-muted-foreground">
            Textos pré-prontos inseridos com <code>/atalho</code> em emails, notas, tickets, chat,
            WhatsApp e cotações.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" /> Novo snippet
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="personal">Meus</TabsTrigger>
            <TabsTrigger value="shared">Compartilhados</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative ml-auto w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar…"
            className="pl-8"
          />
        </div>
      </div>

      <div className="rounded-md border bg-card">
        {query.isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
        ) : query.isError ? (
          <div className="p-6 text-sm text-destructive">
            Não foi possível carregar.{" "}
            <Button variant="link" onClick={() => query.refetch()}>
              Tentar de novo
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhum snippet ainda. Crie o primeiro para inserir textos com <code>/atalho</code>.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Atalho</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Pasta</TableHead>
                <TableHead>Escopo</TableHead>
                <TableHead className="text-right">Usos</TableHead>
                <TableHead className="w-[120px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-sm">/{s.shortcut}</TableCell>
                  <TableCell>{s.name}</TableCell>
                  <TableCell className="text-muted-foreground">{s.folder ?? "—"}</TableCell>
                  <TableCell>
                    {s.visibility === "shared" ? (
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                        compartilhado
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">pessoal</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{s.usage_count}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(s)}
                        aria-label="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => duplicate(s)}
                        aria-label="Duplicar"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          if (await confirmDialog(`Remover /${s.shortcut}?`)) delMut.mutate(s.id);
                        }}
                        aria-label="Remover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <SnippetFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        canShare={isAdmin}
        onSaved={() => qc.invalidateQueries({ queryKey: ["snippets"] })}
      />
    </div>
  );
}
