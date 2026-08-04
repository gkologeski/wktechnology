// Seletor reutilizável do Centro de Arquivos.
// Permite escolher arquivos já existentes em /files (com navegação por pastas)
// em qualquer fluxo que aceite upload, devolvendo objetos `File` prontos para
// serem enviados/anexados pelo componente chamador.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, FileText, Folder, FolderOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getDownloadUrl, getFolderPath, listFiles } from "@/lib/files.functions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type FileRow = {
  id: string;
  name: string;
  size_bytes: number | null;
  mime_type: string | null;
};

function formatBytes(n: number | null): string {
  if (!n) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function FileCenterPickerDialog({
  open,
  onOpenChange,
  onPicked,
  multiple = true,
  title = "Escolher do Centro de Arquivos",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPicked: (files: File[]) => void | Promise<void>;
  multiple?: boolean;
  title?: string;
}) {
  const list = useServerFn(listFiles);
  const path = useServerFn(getFolderPath);
  const download = useServerFn(getDownloadUrl);

  const [folderId, setFolderId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, FileRow>>({});
  const [loading, setLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["file-center-picker", folderId],
    queryFn: () => list({ data: { folderId } }),
    enabled: open,
  });
  const { data: trail = [] } = useQuery({
    queryKey: ["file-center-picker-path", folderId],
    queryFn: () => path({ data: { folderId } }),
    enabled: open,
  });

  const folders = data?.folders ?? [];
  const files = (data?.files ?? []) as FileRow[];
  const selectedList = Object.values(selected);

  const toggle = (f: FileRow) =>
    setSelected((prev) => {
      if (prev[f.id]) {
        const next = { ...prev };
        delete next[f.id];
        return next;
      }
      return multiple ? { ...prev, [f.id]: f } : { [f.id]: f };
    });

  const confirm = async () => {
    if (selectedList.length === 0) return;
    setLoading(true);
    try {
      const out: File[] = [];
      for (const row of selectedList) {
        const { url } = await download({ data: { id: row.id } });
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Falha ao baixar ${row.name}`);
        const blob = await res.blob();
        out.push(
          new File([blob], row.name, {
            type: row.mime_type || blob.type || "application/octet-stream",
          }),
        );
      }
      await onPicked(out);
      setSelected({});
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao anexar arquivos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!loading) onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Navegue pelas pastas e selecione os arquivos que deseja utilizar.
          </DialogDescription>
        </DialogHeader>

        <nav
          aria-label="Caminho de pastas"
          className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground"
        >
          <button
            type="button"
            className="hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1"
            onClick={() => setFolderId(null)}
          >
            Meus arquivos
          </button>
          {trail.map((t) => (
            <span key={t.id} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
              <button
                type="button"
                className="hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1"
                onClick={() => setFolderId(t.id)}
              >
                {t.name}
              </button>
            </span>
          ))}
        </nav>

        <div className="max-h-72 overflow-auto rounded-md border divide-y">
          {isLoading ? (
            <div className="space-y-2 p-3" aria-busy="true">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-6 w-1/2" />
            </div>
          ) : folders.length === 0 && files.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-6 text-center">
              <FolderOpen className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">Esta pasta está vazia.</p>
            </div>
          ) : (
            <>
              {folders.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setFolderId(f.id)}
                >
                  <Folder className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span className="truncate">{f.name}</span>
                </button>
              ))}
              {files.map((f) => (
                <label
                  key={f.id}
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-muted/60"
                >
                  <Checkbox
                    checked={Boolean(selected[f.id])}
                    onCheckedChange={() => toggle(f)}
                    aria-label={`Selecionar ${f.name}`}
                  />
                  <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <span className="text-xs text-muted-foreground">{formatBytes(f.size_bytes)}</span>
                </label>
              ))}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={confirm} disabled={loading || selectedList.length === 0}>
            {loading ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" /> Anexando…
              </>
            ) : (
              `Usar ${selectedList.length || ""}`.trim()
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
