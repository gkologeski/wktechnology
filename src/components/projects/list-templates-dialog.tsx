// Refinos Sprint E: salvar lista como template e criar lista a partir de template.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookmarkPlus, LayoutTemplate, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  listTemplates,
  saveListAsTemplate,
  deleteTemplate,
  createListFromTemplate,
} from "@/lib/project-list-extras.functions";

// Botão "Salvar como template" para o header da lista.
export function SaveAsTemplateButton({ listId, listName }: { listId: string; listName: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const qc = useQueryClient();
  const saveFn = useServerFn(saveListAsTemplate);
  const m = useMutation({
    mutationFn: () =>
      saveFn({ data: { listId, name: name.trim(), description: description || null } }),
    onSuccess: () => {
      toast.success("Template salvo");
      setOpen(false);
      setName("");
      setDescription("");
      qc.invalidateQueries({ queryKey: ["project-list-templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v && !name) setName(`${listName} — template`);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <BookmarkPlus className="h-4 w-4 mr-2" /> Salvar como template
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Salvar lista como template</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Nome</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="text-sm font-medium">Descrição</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Salvamos os status e campos personalizados desta lista. Tarefas não são copiadas.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={() => m.mutate()} disabled={!name.trim() || m.isPending}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Botão "Nova lista a partir de template", útil na tela Espaços.
export function CreateListFromTemplateButton({
  spaceId,
  folderId,
  projectId,
  onCreated,
}: {
  spaceId: string;
  folderId?: string | null;
  projectId?: string | null;
  onCreated?: (listId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const listFn = useServerFn(listTemplates);
  const createFn = useServerFn(createListFromTemplate);
  const deleteFn = useServerFn(deleteTemplate);
  const qc = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["project-list-templates"],
    queryFn: () => listFn({}),
    enabled: open,
  });

  const createM = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          templateId: selectedId!,
          name: name.trim(),
          spaceId,
          folderId: folderId ?? null,
          projectId: projectId ?? null,
        },
      }),
    onSuccess: (list: any) => {
      toast.success("Lista criada a partir do template");
      setOpen(false);
      setName("");
      setSelectedId(null);
      onCreated?.(list.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Template removido");
      qc.invalidateQueries({ queryKey: ["project-list-templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <LayoutTemplate className="h-4 w-4 mr-2" /> Nova lista de template
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Criar lista a partir de template</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Escolha um template</label>
            {isLoading ? (
              <div className="py-4 flex justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : templates.length === 0 ? (
              <p className="text-xs text-muted-foreground mt-1">
                Nenhum template salvo ainda. Salve uma lista como template a partir da tela dela.
              </p>
            ) : (
              <div className="mt-1 space-y-1.5 max-h-56 overflow-auto">
                {templates.map((t: any) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    className={`w-full text-left rounded-md border px-3 py-2 text-sm hover:border-primary/40 ${selectedId === t.id ? "border-primary bg-primary/5" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{t.name}</div>
                      <span
                        role="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteM.mutate(t.id);
                        }}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </span>
                    </div>
                    {t.description && (
                      <div className="text-xs text-muted-foreground truncate">{t.description}</div>
                    )}
                    <div className="mt-1 flex gap-1.5">
                      <Badge variant="outline" className="text-[10px]">
                        {(t.statuses ?? []).length} status
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {(t.custom_fields ?? []).length} campos
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedId && (
            <div>
              <label className="text-sm font-medium">Nome da nova lista</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => createM.mutate()}
            disabled={!selectedId || !name.trim() || createM.isPending}
          >
            Criar lista
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
