import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileText, Image as ImageIcon, Link2, Pencil, Trash2, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
import { EmptyState, SectionHeader } from "@/components/techhire/ui";
import {
  createSdrMaterialUpload,
  deleteSdrMaterial,
  saveSdrMaterial,
} from "@/lib/prospecting/sdr.functions";

const MAX_BYTES = 16 * 1024 * 1024;
const ACCEPT =
  "application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,text/plain,image/jpeg,image/png,image/webp,video/mp4,video/3gpp";

export type SdrMaterialRow = {
  id: string;
  title: string;
  description?: string | null;
  kind: string;
  url: string | null;
  mime?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  approved: boolean;
  active: boolean;
};

type Props = {
  workspaceId: string;
  canManage: boolean;
  materials: SdrMaterialRow[];
  offers: { id: string; name: string; status: string }[];
  links: { material_id: string; offer_id: string }[];
  onChanged: () => void;
};

type Form = {
  id?: string;
  kind: "link" | "file";
  title: string;
  description: string;
  url: string;
  offerIds: string[];
  file: File | null;
  currentFile: string | null;
};

const EMPTY: Form = {
  kind: "link",
  title: "",
  description: "",
  url: "",
  offerIds: [],
  file: null,
  currentFile: null,
};

function kindLabel(m: SdrMaterialRow) {
  if (m.kind !== "file") return { label: "Link", Icon: Link2 };
  const mime = m.mime ?? "";
  if (mime.startsWith("image/")) return { label: "Imagem", Icon: ImageIcon };
  if (mime.startsWith("video/")) return { label: "Vídeo", Icon: Video };
  return { label: mime === "application/pdf" ? "PDF" : "Documento", Icon: FileText };
}

function fmtSize(n?: number | null) {
  if (!n) return "";
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`;
}

export function SdrMaterialsPanel(p: Props) {
  const save = useServerFn(saveSdrMaterial);
  const prepare = useServerFn(createSdrMaterialUpload);
  const remove = useServerFn(deleteSdrMaterial);
  const [form, setForm] = useState<Form>(EMPTY);
  const [toDelete, setToDelete] = useState<SdrMaterialRow | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const linksBy = (mid: string) =>
    p.links.filter((l) => l.material_id === mid).map((l) => l.offer_id);
  const name = (id: string) => p.offers.find((o) => o.id === id)?.name ?? "?";

  const reset = () => {
    setForm(EMPTY);
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = useMutation({
    mutationFn: async () => {
      let file: { storagePath: string; fileName: string; mime: string; size: number } | null =
        null;
      if (form.kind === "file" && form.file) {
        const f = form.file;
        if (f.size > MAX_BYTES) throw new Error("Arquivo acima de 16 MB.");
        const mime = f.type || "application/octet-stream";
        const up = await prepare({
          data: { workspaceId: p.workspaceId, fileName: f.name, mime, size: f.size },
        });
        const { error } = await supabase.storage
          .from("sdr-materials")
          .uploadToSignedUrl(up.path, up.token, f, { contentType: mime });
        if (error) throw new Error("Falha no envio do arquivo: " + error.message);
        file = { storagePath: up.path, fileName: f.name, mime, size: f.size };
      }
      return save({
        data: {
          workspaceId: p.workspaceId,
          id: form.id,
          kind: form.kind,
          title: form.title,
          description: form.description || null,
          url: form.kind === "link" ? form.url : null,
          file,
          offerIds: form.offerIds,
          approved: true,
          active: true,
        },
      });
    },
    onSuccess: () => (toast.success(form.id ? "Material atualizado" : "Material salvo"), reset(), p.onChanged()),
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: (m: SdrMaterialRow) =>
      save({
        data: {
          workspaceId: p.workspaceId,
          id: m.id,
          kind: m.kind === "file" ? "file" : "link",
          title: m.title,
          url: m.kind === "file" ? null : m.url,
          offerIds: linksBy(m.id),
          approved: true,
          active: !m.active,
        },
      }),
    onSuccess: p.onChanged,
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => remove({ data: { workspaceId: p.workspaceId, id } }),
    onSuccess: () => (toast.success("Material excluído"), setToDelete(null), p.onChanged()),
    onError: (e: Error) => toast.error(e.message),
  });

  const edit = (m: SdrMaterialRow) =>
    setForm({
      id: m.id,
      kind: m.kind === "file" ? "file" : "link",
      title: m.title,
      description: m.description ?? "",
      url: m.url ?? "",
      offerIds: linksBy(m.id),
      file: null,
      currentFile: m.file_name ?? null,
    });

  const canSubmit =
    !!form.title.trim() &&
    (form.kind === "link" ? /^https:\/\//.test(form.url) : !!form.file || !!form.currentFile) &&
    !submit.isPending;

  return (
    <section className="space-y-3">
      <SectionHeader
        title="Materiais"
        description="Links, PDFs, documentos, imagens e vídeos que os agentes podem enviar quando o cliente pedir. Arquivos vão como anexo do WhatsApp (até 16 MB)."
      />
      {p.materials.length === 0 ? (
        <EmptyState
          title="Nenhum material"
          description="Sem material, o agente não oferece envio."
        />
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {p.materials.map((m) => {
            const k = kindLabel(m);
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
                <k.Icon className="size-4 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{m.title}</span>
                    <Badge variant="outline">{k.label}</Badge>
                    <Badge variant={m.approved && m.active ? "secondary" : "outline"}>
                      {!m.active ? "Inativo" : m.approved ? "Aprovado" : "Aguardando aprovação"}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {m.kind === "file"
                      ? `${m.file_name ?? "arquivo"} ${fmtSize(m.file_size)}`
                      : m.url}
                    {" · "}
                    {linksBy(m.id).map(name).join(", ") || "Sem serviço vinculado"}
                  </p>
                </div>
                {p.canManage && (
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={toggle.isPending}
                      onClick={() => toggle.mutate(m)}
                    >
                      {m.active ? "Desativar" : "Ativar"}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Editar ${m.title}`}
                      onClick={() => edit(m)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Excluir ${m.title}`}
                      onClick={() => setToDelete(m)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {p.canManage && (
        <div className="space-y-3 rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">{form.id ? "Editar material" : "Novo material"}</p>
            <ToggleGroup
              type="single"
              size="sm"
              variant="outline"
              value={form.kind}
              onValueChange={(v) => v && setForm({ ...form, kind: v as Form["kind"] })}
              aria-label="Tipo de material"
            >
              <ToggleGroupItem value="link">Link</ToggleGroupItem>
              <ToggleGroupItem value="file">Arquivo (PDF, documento, imagem, vídeo)</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="mat-t">Título</Label>
              <Input
                id="mat-t"
                value={form.title}
                maxLength={200}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            {form.kind === "link" ? (
              <div className="space-y-1">
                <Label htmlFor="mat-u">Link (https)</Label>
                <Input
                  id="mat-u"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                />
              </div>
            ) : (
              <div className="space-y-1">
                <Label htmlFor="mat-f">Arquivo (até 16 MB)</Label>
                <Input
                  id="mat-f"
                  ref={fileRef}
                  type="file"
                  accept={ACCEPT}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    if (f && f.size > MAX_BYTES) {
                      toast.error("Arquivo acima de 16 MB.");
                      e.target.value = "";
                      return;
                    }
                    setForm({ ...form, file: f });
                  }}
                />
                {form.currentFile && !form.file && (
                  <p className="text-xs text-muted-foreground">Atual: {form.currentFile}</p>
                )}
              </div>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="mat-d">Descrição (ajuda o agente a escolher)</Label>
            <Textarea
              id="mat-d"
              rows={2}
              maxLength={1000}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <fieldset className="grid gap-2 sm:grid-cols-2">
            <legend className="mb-1 text-sm font-medium">Serviços atendidos</legend>
            {p.offers
              .filter((o) => o.status === "active")
              .map((o) => (
                <label key={o.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.offerIds.includes(o.id)}
                    onCheckedChange={(v) =>
                      setForm({
                        ...form,
                        offerIds: v
                          ? [...form.offerIds, o.id]
                          : form.offerIds.filter((x) => x !== o.id),
                      })
                    }
                  />
                  {o.name}
                </label>
              ))}
          </fieldset>
          <div className="flex gap-2">
            <Button disabled={!canSubmit} onClick={() => submit.mutate()}>
              {submit.isPending ? "Salvando…" : form.id ? "Salvar alterações" : "Adicionar material"}
            </Button>
            {form.id && (
              <Button variant="outline" onClick={reset}>
                Cancelar
              </Button>
            )}
          </div>
        </div>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir material?</AlertDialogTitle>
            <AlertDialogDescription>
              “{toDelete?.title}” deixará de ser enviado pelos agentes. Mensagens já enviadas
              continuam no histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={del.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (toDelete) del.mutate(toDelete.id);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
