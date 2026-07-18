// Sprint C - Fase 4.2 parte 1
// Hub estilo ClickUp: Espaços → Pastas → Listas.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ChevronRight, Folder, LayoutGrid, List as ListIcon, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  listSpaceTree,
  createSpace,
  createFolder,
  createList,
  deleteSpace,
  deleteFolder,
  deleteList,
} from "@/lib/project-hierarchy.functions";
import { CreateListFromTemplateButton } from "@/components/projects/list-templates-dialog";

export const Route = createFileRoute("/_authenticated/projects/spaces")({
  head: () => ({
    meta: [
      { title: "Espaços — TechProjects" },
      { name: "description", content: "Organize projetos em Espaços, Pastas e Listas no estilo ClickUp." },
    ],
  }),
  component: SpacesHub,
});

type Space = { id: string; name: string; color: string | null; description: string | null };
type FolderRow = { id: string; name: string; space_id: string };
type ListRow = {
  id: string;
  name: string;
  color: string | null;
  space_id: string;
  folder_id: string | null;
  project_id: string | null;
  projects: { id: string; name: string } | null;
};

function SpacesHub() {
  const qc = useQueryClient();
  const tree = useServerFn(listSpaceTree);
  const { data, isLoading } = useQuery({
    queryKey: ["project-space-tree"],
    queryFn: () => tree({ data: {} as never }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["project-space-tree"] });

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Espaços"
        description="Organize projetos em Espaços, Pastas e Listas. Cada lista tem seus próprios status e tarefas."
        count={data?.spaces.length}
        countLabel={(data?.spaces.length ?? 0) === 1 ? "espaço" : "espaços"}
        actions={<NewSpaceButton onCreated={invalidate} />}
      />

      {isLoading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : (data?.spaces.length ?? 0) === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <LayoutGrid className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium">Nenhum espaço ainda</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Crie um espaço para agrupar pastas e listas.
          </p>
          <div className="mt-4 flex justify-center">
            <NewSpaceButton onCreated={invalidate} />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {data!.spaces.map((s) => (
            <SpaceCard
              key={s.id}
              space={s as Space}
              folders={(data!.folders as FolderRow[]).filter((f) => f.space_id === s.id)}
              lists={(data!.lists as ListRow[]).filter((l) => l.space_id === s.id)}
              onChanged={invalidate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NewSpaceButton({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#0ea5e9");
  const create = useServerFn(createSpace);
  const m = useMutation({
    mutationFn: () => create({ data: { name, color } }),
    onSuccess: () => {
      toast.success("Espaço criado");
      setOpen(false);
      setName("");
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" /> Novo espaço
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo espaço</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Nome</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Engenharia" />
          </div>
          <div>
            <label className="text-sm font-medium">Cor</label>
            <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-24" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => m.mutate()} disabled={!name.trim() || m.isPending}>Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SpaceCard({
  space,
  folders,
  lists,
  onChanged,
}: {
  space: Space;
  folders: FolderRow[];
  lists: ListRow[];
  onChanged: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const delSpace = useServerFn(deleteSpace);
  const delSpaceM = useMutation({
    mutationFn: () => delSpace({ data: { id: space.id } }),
    onSuccess: () => {
      toast.success("Espaço removido");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rootLists = lists.filter((l) => !l.folder_id);

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 p-3">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-muted-foreground hover:text-foreground"
          aria-label={expanded ? "Recolher" : "Expandir"}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <span
          className="h-3 w-3 rounded-full"
          style={{ background: space.color ?? "#94a3b8" }}
        />
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{space.name}</div>
          {space.description ? (
            <div className="text-xs text-muted-foreground truncate">{space.description}</div>
          ) : null}
        </div>
        <Badge variant="outline" className="text-xs">
          {lists.length} {lists.length === 1 ? "lista" : "listas"}
        </Badge>
        <NewFolderButton spaceId={space.id} onCreated={onChanged} />
        <NewListButton spaceId={space.id} onCreated={onChanged} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              …
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => {
                if (confirm("Remover espaço e tudo dentro dele?")) delSpaceM.mutate();
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" /> Remover
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {expanded && (
        <div className="border-t px-3 py-2 space-y-2">
          {folders.map((f) => (
            <FolderRowUI
              key={f.id}
              folder={f}
              lists={lists.filter((l) => l.folder_id === f.id)}
              onChanged={onChanged}
            />
          ))}
          {rootLists.map((l) => (
            <ListRowUI key={l.id} list={l} onChanged={onChanged} />
          ))}
          {folders.length === 0 && rootLists.length === 0 && (
            <div className="text-xs text-muted-foreground py-2 pl-6">
              Espaço vazio. Crie uma pasta ou lista.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FolderRowUI({
  folder,
  lists,
  onChanged,
}: {
  folder: FolderRow;
  lists: ListRow[];
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(true);
  const del = useServerFn(deleteFolder);
  const delM = useMutation({
    mutationFn: () => del({ data: { id: folder.id } }),
    onSuccess: () => {
      toast.success("Pasta removida");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded border bg-background/50">
      <div className="flex items-center gap-2 p-2">
        <button onClick={() => setOpen((v) => !v)} className="text-muted-foreground">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <Folder className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1 text-sm font-medium">{folder.name}</div>
        <NewListButton spaceId={folder.space_id} folderId={folder.id} onCreated={onChanged} />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => {
            if (confirm("Remover pasta? As listas ficarão soltas no espaço.")) delM.mutate();
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {open && (
        <div className="pb-2 pl-8 pr-2 space-y-1">
          {lists.length === 0 ? (
            <div className="text-xs text-muted-foreground py-1">Pasta vazia.</div>
          ) : (
            lists.map((l) => <ListRowUI key={l.id} list={l} onChanged={onChanged} />)
          )}
        </div>
      )}
    </div>
  );
}

function ListRowUI({ list, onChanged }: { list: ListRow; onChanged: () => void }) {
  const del = useServerFn(deleteList);
  const delM = useMutation({
    mutationFn: () => del({ data: { id: list.id } }),
    onSuccess: () => {
      toast.success("Lista removida");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="flex items-center gap-2 rounded border bg-background/50 px-2 py-1.5">
      <ListIcon className="h-4 w-4" style={{ color: list.color ?? "hsl(var(--muted-foreground))" }} />
      <Link
        to="/projects/lists/$id"
        params={{ id: list.id }}
        className="flex-1 text-sm font-medium hover:underline truncate"
      >
        {list.name}
      </Link>
      {list.projects ? (
        <Badge variant="outline" className="text-xs">
          {list.projects.name}
        </Badge>
      ) : (
        <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
          Sem projeto
        </Badge>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => {
          if (confirm("Remover lista?")) delM.mutate();
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function NewFolderButton({ spaceId, onCreated }: { spaceId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const create = useServerFn(createFolder);
  const m = useMutation({
    mutationFn: () => create({ data: { spaceId, name } }),
    onSuccess: () => {
      toast.success("Pasta criada");
      setOpen(false);
      setName("");
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8">
          <Folder className="h-3.5 w-3.5 mr-1" /> Pasta
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova pasta</DialogTitle>
        </DialogHeader>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da pasta" />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => m.mutate()} disabled={!name.trim() || m.isPending}>Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewListButton({
  spaceId,
  folderId,
  onCreated,
}: {
  spaceId: string;
  folderId?: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const create = useServerFn(createList);

  // Carrega projetos para vincular (opcional, mas obrigatório para criar tarefas)
  const { data: projects = [] } = useQuery({
    queryKey: ["projects", "picker"],
    queryFn: async () => {
      const { listProjects } = await import("@/lib/projects.functions");
      return await (listProjects as unknown as (a: { data: unknown }) => Promise<{ id: string; name: string }[]>)({ data: {} });
    },
    staleTime: 60_000,
    enabled: open,
  });

  const m = useMutation({
    mutationFn: () =>
      create({
        data: {
          spaceId,
          folderId: folderId ?? null,
          name,
          projectId: projectId || null,
        },
      }),
    onSuccess: () => {
      toast.success("Lista criada");
      setOpen(false);
      setName("");
      setProjectId("");
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8">
          <Plus className="h-3.5 w-3.5 mr-1" /> Lista
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova lista</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Nome</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Backlog Q1" />
          </div>
          <div>
            <label className="text-sm font-medium">Projeto vinculado (opcional)</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full h-10 rounded-md border bg-background px-3 text-sm"
            >
              <option value="">— Sem projeto —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Necessário para criar tarefas. Pode ser vinculado depois.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => m.mutate()} disabled={!name.trim() || m.isPending}>Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
