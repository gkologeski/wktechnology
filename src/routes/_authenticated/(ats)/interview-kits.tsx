// Admin de Kits de Entrevista (perguntas reaproveitáveis).
// Lote 4 do rollout UX/UI — segue Design Foundation TechHire.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Save,
  Video,
  Type as TypeIcon,
  Star,
  MessagesSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PageHeader,
  SectionHeader,
  EmptyState,
  MetaPill,
  Skeletons,
} from "@/components/techhire/ui";
import {
  listInterviewKits,
  saveInterviewKit,
  deleteInterviewKit,
  type InterviewKitQuestion,
} from "@/lib/ats/interview-kits.functions";

export const Route = createFileRoute("/_authenticated/(ats)/interview-kits")({
  head: () => ({ meta: [{ title: "Kits de Entrevista — ATS" }] }),
  component: InterviewKitsPage,
});

type Kit = {
  id?: string;
  name: string;
  is_default: boolean;
  questions: InterviewKitQuestion[];
};

function emptyKit(): Kit {
  return { name: "Novo kit", is_default: false, questions: [emptyQ()] };
}
function emptyQ(): InterviewKitQuestion {
  return { id: crypto.randomUUID().slice(0, 8), text: "", kind: "text" };
}

function InterviewKitsPage() {
  const listFn = useServerFn(listInterviewKits);
  const saveFn = useServerFn(saveInterviewKit);
  const delFn = useServerFn(deleteInterviewKit);

  const [kits, setKits] = useState<Array<Kit & { id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Kit | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = () =>
    listFn()
      .then((rows) =>
        setKits(
          rows.map((r) => ({
            id: r.id as string,
            name: r.name as string,
            is_default: !!r.is_default,
            questions: (r.questions as InterviewKitQuestion[]) ?? [],
          })),
        ),
      )
      .finally(() => setLoading(false));
  useEffect(() => {
    reload();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.name.trim()) return toast.error("Dê um nome ao kit");
    if (
      editing.questions.length === 0 ||
      editing.questions.some((q) => !q.text.trim())
    )
      return toast.error("Preencha o texto de todas as perguntas");
    setSaving(true);
    try {
      await saveFn({ data: editing as never });
      toast.success("Kit salvo");
      setEditing(null);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmDialog("Excluir este kit?"))) return;
    await delFn({ data: { id } });
    toast.success("Excluído");
    reload();
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Configurações · ATS"
        title="Kits de entrevista"
        description="Conjuntos de perguntas reaproveitáveis. Para entrevistas assíncronas, marque perguntas como vídeo."
        descriptionLive
        primaryAction={
          <Button onClick={() => setEditing(emptyKit())}>
            <Plus className="h-4 w-4 mr-2" />
            Novo kit
          </Button>
        }
      />

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeletons.Card key={i} lines={2} />
          ))}
        </div>
      ) : kits.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title="Nenhum kit ainda"
          description="Crie um kit para padronizar entrevistas e habilitar respostas assíncronas em vídeo."
          action={
            <Button size="sm" onClick={() => setEditing(emptyKit())}>
              <Plus className="h-4 w-4 mr-2" />
              Novo kit
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {kits.map((k) => {
            const videoCount = k.questions.filter((q) => q.kind === "video").length;
            return (
              <article
                key={k.id}
                className="group flex flex-col rounded-lg border border-border-subtle bg-surface-1 p-4 shadow-xs transition hover:border-border-default hover:bg-surface-2"
              >
                <header className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-text-primary flex items-center gap-1.5 truncate">
                      {k.name}
                      {k.is_default && (
                        <Star
                          className="h-3.5 w-3.5 text-status-warning-foreground shrink-0"
                          aria-label="Kit padrão"
                        />
                      )}
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <MetaPill>
                        {k.questions.length} pergunta
                        {k.questions.length === 1 ? "" : "s"}
                      </MetaPill>
                      {videoCount > 0 && (
                        <MetaPill>
                          <Video className="h-3 w-3" />
                          {videoCount} em vídeo
                        </MetaPill>
                      )}
                      {k.is_default && <MetaPill>Padrão</MetaPill>}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing(k)}
                    >
                      Editar
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDelete(k.id)}
                      aria-label={`Excluir kit ${k.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </header>
              </article>
            );
          })}
        </div>
      )}

      {editing && (
        <section className="rounded-lg border border-border-default bg-surface-1 p-5 shadow-xs space-y-5">
          <SectionHeader
            title={editing.id ? "Editar kit" : "Novo kit"}
            description="Defina nome, marque como padrão e gerencie as perguntas."
          />

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="kit-name">Nome do kit</Label>
              <Input
                id="kit-name"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="kit-default"
                checked={editing.is_default}
                onCheckedChange={(v) => setEditing({ ...editing, is_default: v })}
              />
              <Label htmlFor="kit-default" className="!m-0">
                Kit padrão
              </Label>
            </div>
          </div>

          <div className="space-y-3">
            <SectionHeader
              title="Perguntas"
              description="Adicione perguntas em texto ou vídeo (com tempo-limite)."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setEditing({
                      ...editing,
                      questions: [...editing.questions, emptyQ()],
                    })
                  }
                >
                  <Plus className="h-4 w-4 mr-2" /> Adicionar
                </Button>
              }
            />
            {editing.questions.map((q, idx) => (
              <div
                key={q.id}
                className="rounded-lg border border-border-subtle bg-surface-2 p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-text-tertiary">
                    Pergunta #{idx + 1}
                  </span>
                  <div className="flex items-center gap-2">
                    <Select
                      value={q.kind ?? "text"}
                      onValueChange={(v) => {
                        const qs = [...editing.questions];
                        qs[idx] = { ...q, kind: v as "text" | "video" };
                        setEditing({ ...editing, questions: qs });
                      }}
                    >
                      <SelectTrigger
                        className="w-32 h-8"
                        aria-label={`Tipo da pergunta ${idx + 1}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">
                          <TypeIcon className="inline h-3 w-3 mr-1" />
                          Texto
                        </SelectItem>
                        <SelectItem value="video">
                          <Video className="inline h-3 w-3 mr-1" />
                          Vídeo
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {q.kind === "video" && (
                      <Input
                        type="number"
                        className="w-20 h-8"
                        placeholder="seg"
                        aria-label={`Tempo limite em segundos da pergunta ${idx + 1}`}
                        value={q.time_limit_sec ?? ""}
                        onChange={(e) => {
                          const qs = [...editing.questions];
                          qs[idx] = {
                            ...q,
                            time_limit_sec: Number(e.target.value) || undefined,
                          };
                          setEditing({ ...editing, questions: qs });
                        }}
                      />
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => {
                        const qs = editing.questions.filter((_, i) => i !== idx);
                        setEditing({ ...editing, questions: qs });
                      }}
                      aria-label={`Remover pergunta ${idx + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Textarea
                  rows={2}
                  placeholder="Texto da pergunta"
                  aria-label={`Texto da pergunta ${idx + 1}`}
                  value={q.text}
                  onChange={(e) => {
                    const qs = [...editing.questions];
                    qs[idx] = { ...q, text: e.target.value };
                    setEditing({ ...editing, questions: qs });
                  }}
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
