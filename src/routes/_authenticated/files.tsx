import { getPublicAppUrl } from "@/lib/app-url";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  FolderOpen,
  Folder,
  File as FileIcon,
  Upload,
  MoreHorizontal,
  Trash2,
  Pencil,
  Download,
  Link2,
  Link2Off,
  Plus,
  Home as HomeIcon,
  ChevronRight,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  listFiles,
  getFolderPath,
  createFolder,
  renameNode,
  deleteFile,
  deleteFolder,
  togglePublicLink,
  getDownloadUrl,
  registerUploadedFile,
} from "@/lib/files.functions";

export const Route = createFileRoute("/_authenticated/files")({
  head: () => ({
    meta: [
      { title: "Arquivos · TechERP" },
      { name: "description", content: "Gerenciador de arquivos pessoal com link público." },
    ],
  }),
  component: FilesPage,
});

const QUOTA = 100 * 1024 * 1024;

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function sanitize(name: string) {
  return name.replace(/[^\w.\-() ]+/g, "_").slice(0, 180);
}

function FilesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [folderId, setFolderId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<{
    id: string;
    kind: "file" | "folder";
    name: string;
  } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    kind: "file" | "folder";
    name: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const listFn = useServerFn(listFiles);
  const trailFn = useServerFn(getFolderPath);
  const createFolderFn = useServerFn(createFolder);
  const renameFn = useServerFn(renameNode);
  const deleteFileFn = useServerFn(deleteFile);
  const deleteFolderFn = useServerFn(deleteFolder);
  const toggleLinkFn = useServerFn(togglePublicLink);
  const downloadFn = useServerFn(getDownloadUrl);

  const { data, isLoading } = useQuery({
    queryKey: ["user-files", folderId],
    queryFn: () => listFn({ data: { folderId } }),
  });

  const { data: trail } = useQuery({
    queryKey: ["user-files-trail", folderId],
    queryFn: () => trailFn({ data: { folderId } }),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["user-files"] });
    void qc.invalidateQueries({ queryKey: ["user-files-trail"] });
  };

  const createFolderMut = useMutation({
    mutationFn: () => createFolderFn({ data: { name: newFolderName.trim(), parentId: folderId } }),
    onSuccess: () => {
      toast.success("Pasta criada");
      setNewFolderOpen(false);
      setNewFolderName("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const renameMut = useMutation({
    mutationFn: () =>
      renameFn({
        data: { id: renameTarget!.id, kind: renameTarget!.kind, name: renameValue.trim() },
      }),
    onSuccess: () => {
      toast.success("Renomeado");
      setRenameTarget(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      if (!deleteTarget) return;
      if (deleteTarget.kind === "file") await deleteFileFn({ data: { id: deleteTarget.id } });
      else await deleteFolderFn({ data: { id: deleteTarget.id } });
    },
    onSuccess: () => {
      toast.success("Excluído");
      setDeleteTarget(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const usedPct = useMemo(() => {
    if (!data) return 0;
    return Math.min(100, Math.round((data.usedBytes / QUOTA) * 100));
  }, [data]);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || !user) return;
    const files = Array.from(fileList);
    const totalNew = files.reduce((s, f) => s + f.size, 0);
    if (data && data.usedBytes + totalNew > QUOTA) {
      toast.error("Cota de 100 MB excedida");
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const path = `${user.id}/${crypto.randomUUID()}-${sanitize(f.name)}`;
        const up = await supabase.storage.from("user-files").upload(path, f, {
          contentType: f.type || "application/octet-stream",
          upsert: false,
        });
        if (up.error) throw new Error(up.error.message);
        try {
          await registerUploadedFile({
            data: {
              folder_id: folderId,
              name: f.name,
              storage_path: path,
              size_bytes: f.size,
              mime_type: f.type || null,
            },
          });
        } catch (insErr) {
          await supabase.storage.from("user-files").remove([path]);
          throw insErr;
        }
        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      }
      toast.success(`${files.length} arquivo(s) enviado(s)`);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function copyPublicLink(token: string) {
    const url = `${getPublicAppUrl()}/api/public/files/${token}`;
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  }

  async function togglePublic(id: string, currentEnabled: boolean) {
    try {
      const res = await toggleLinkFn({ data: { id, enable: !currentEnabled } });
      if (res?.is_public && res.public_token) await copyPublicLink(res.public_token);
      else toast.success("Link público desativado");
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  }

  async function download(id: string) {
    try {
      const { url } = await downloadFn({ data: { id } });
      window.open(url, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Arquivos</h1>
          <p className="text-sm text-muted-foreground">
            Espaço pessoal com 100 MB. Gere links públicos para compartilhar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setNewFolderOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nova pasta
          </Button>
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <Upload className="h-4 w-4 mr-2" /> {uploading ? "Enviando…" : "Enviar arquivos"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files)}
          />
        </div>
      </div>

      <div className="bg-card border border-border/60 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">
            {data ? `${formatBytes(data.usedBytes)} de ${formatBytes(QUOTA)}` : "—"}
          </span>
          <span className="text-xs text-muted-foreground">{usedPct}%</span>
        </div>
        <Progress value={usedPct} />
        {uploading && (
          <div className="mt-3">
            <Progress value={uploadProgress} />
            <p className="text-xs text-muted-foreground mt-1">Enviando {uploadProgress}%</p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 text-sm">
        <button
          onClick={() => setFolderId(null)}
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <HomeIcon className="h-3.5 w-3.5" /> Início
        </button>
        {(trail ?? []).map((t) => (
          <span key={t.id} className="inline-flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <button
              onClick={() => setFolderId(t.id)}
              className="text-muted-foreground hover:text-foreground"
            >
              {t.name}
            </button>
          </span>
        ))}
      </div>

      <div
        className="bg-card border border-border/60 rounded-2xl min-h-[300px]"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void handleFiles(e.dataTransfer.files);
        }}
      >
        {isLoading ? (
          <div className="p-8 text-sm text-muted-foreground">Carregando…</div>
        ) : (data?.folders.length ?? 0) === 0 && (data?.files.length ?? 0) === 0 ? (
          <div className="p-12 text-center">
            <FolderOpen className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Pasta vazia. Arraste arquivos aqui ou clique em Enviar arquivos.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {(data?.folders ?? []).map((f) => (
              <li key={f.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40">
                <Folder className="h-5 w-5 text-primary shrink-0" />
                <button
                  onClick={() => setFolderId(f.id)}
                  className="text-sm font-medium text-left flex-1 truncate hover:underline"
                >
                  {f.name}
                </button>
                <NodeMenu
                  onRename={() => {
                    setRenameTarget({ id: f.id, kind: "folder", name: f.name });
                    setRenameValue(f.name);
                  }}
                  onDelete={() => setDeleteTarget({ id: f.id, kind: "folder", name: f.name })}
                />
              </li>
            ))}
            {(data?.files ?? []).map((f) => (
              <li key={f.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40">
                <FileIcon className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{f.name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <span>{formatBytes(Number(f.size_bytes))}</span>
                    {f.is_public && f.public_token && (
                      <span className="inline-flex items-center gap-1 text-primary">
                        <Link2 className="h-3 w-3" /> público
                      </span>
                    )}
                  </div>
                </div>
                {f.is_public && f.public_token && (
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Copiar link público"
                    onClick={() => void copyPublicLink(f.public_token!)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
                <NodeMenu
                  onDownload={() => void download(f.id)}
                  onTogglePublic={() => void togglePublic(f.id, f.is_public)}
                  publicEnabled={f.is_public}
                  onRename={() => {
                    setRenameTarget({ id: f.id, kind: "file", name: f.name });
                    setRenameValue(f.name);
                  }}
                  onDelete={() => setDeleteTarget({ id: f.id, kind: "file", name: f.name })}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova pasta</DialogTitle>
          </DialogHeader>
          <Input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Nome da pasta"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createFolderMut.mutate()}
              disabled={!newFolderName.trim() || createFolderMut.isPending}
            >
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renameTarget} onOpenChange={(v) => !v && setRenameTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Renomear</DialogTitle>
          </DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => renameMut.mutate()}
              disabled={!renameValue.trim() || renameMut.isPending}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir {deleteTarget?.kind === "folder" ? "pasta" : "arquivo"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.{" "}
              {deleteTarget?.kind === "folder" && "Todos os arquivos da pasta serão removidos."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMut.mutate()}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function NodeMenu({
  onDownload,
  onTogglePublic,
  publicEnabled,
  onRename,
  onDelete,
}: {
  onDownload?: () => void;
  onTogglePublic?: () => void;
  publicEnabled?: boolean;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onDownload && (
          <DropdownMenuItem onClick={onDownload}>
            <Download className="h-4 w-4 mr-2" /> Baixar
          </DropdownMenuItem>
        )}
        {onTogglePublic && (
          <DropdownMenuItem onClick={onTogglePublic}>
            {publicEnabled ? (
              <>
                <Link2Off className="h-4 w-4 mr-2" /> Desativar link público
              </>
            ) : (
              <>
                <Link2 className="h-4 w-4 mr-2" /> Gerar link público
              </>
            )}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onRename}>
          <Pencil className="h-4 w-4 mr-2" /> Renomear
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive" onClick={onDelete}>
          <Trash2 className="h-4 w-4 mr-2" /> Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
