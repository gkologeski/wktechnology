// Admin de Kits de Entrevista (perguntas reaproveitáveis).
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Save, Video, Type as TypeIcon, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [editing, setEditing] = useState<Kit | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = () =>
    listFn().then((rows) =>
      setKits(
        rows.map((r) => ({
          id: r.id as string,
          name: r.name as string,
          is_default: !!r.is_default,
          questions: (r.questions as InterviewKitQuestion[]) ?? [],
        })),
      ),
    );
  useEffect(() => { reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.name.trim()) return toast.error("Dê um nome ao kit");
    if (editing.questions.length === 0 || editing.questions.some((q) => !q.text.trim()))
      return toast.error("Preencha o texto de todas as perguntas");
    setSaving(true);
    try {
      await saveFn({ data: editing as never });
      toast.success("Kit salvo");
      setEditing(null);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este kit?")) return;
    await delFn({ data: { id } });
    toast.success("Excluído");
    reload();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Kits de Entrevista</h1>
          <p className="text-sm text-muted-foreground">
            Conjuntos de perguntas reaproveitáveis. Para entrevistas assíncronas, marque perguntas como vídeo.
          </p>
        </div>
        <Button onClick={() => setEditing(emptyKit())}>
          <Plus className="h-4 w-4 mr-2" /> Novo kit
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {kits.map((k) => (
          <div key={k.id} className="border rounded-lg p-4 hover:bg-muted/30 transition">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  {k.name}
                  {k.is_default && <Star className="h-4 w-4 text-amber-500" />}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {k.questions.length} pergunta{k.questions.length === 1 ? "" : "s"}
                  {" · "}
                  {k.questions.filter((q) => q.kind === "video").length} em vídeo
                </p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => setEditing(k)}>Editar</Button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(k.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {kits.length === 0 && (
          <div className="col-span-2 text-center text-muted-foreground py-12 border rounded-lg border-dashed">
            Nenhum kit ainda. Crie o primeiro.
          </div>
        )}
      </div>

      {editing && (
        <div className="border rounded-lg p-6 space-y-4 bg-card">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
            <div className="space-y-1">
              <Label>Nome do kit</Label>
              <Input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={editing.is_default}
                onCheckedChange={(v) => setEditing({ ...editing, is_default: v })}
              />
              <Label>Kit padrão</Label>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Perguntas</Label>
            {editing.questions.map((q, idx) => (
              <div key={q.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">#{idx + 1}</span>
                  <div className="flex items-center gap-2">
                    <Select
                      value={q.kind ?? "text"}
                      onValueChange={(v) => {
                        const qs = [...editing.questions];
                        qs[idx] = { ...q, kind: v as "text" | "video" };
                        setEditing({ ...editing, questions: qs });
                      }}
                    >
                      <SelectTrigger className="w-32 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text"><TypeIcon className="inline h-3 w-3 mr-1" />Texto</SelectItem>
                        <SelectItem value="video"><Video className="inline h-3 w-3 mr-1" />Vídeo</SelectItem>
                      </SelectContent>
                    </Select>
                    {q.kind === "video" && (
                      <Input
                        type="number"
                        className="w-20 h-8"
                        placeholder="seg"
                        value={q.time_limit_sec ?? ""}
                        onChange={(e) => {
                          const qs = [...editing.questions];
                          qs[idx] = { ...q, time_limit_sec: Number(e.target.value) || undefined };
                          setEditing({ ...editing, questions: qs });
                        }}
                      />
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const qs = editing.questions.filter((_, i) => i !== idx);
                        setEditing({ ...editing, questions: qs });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Textarea
                  rows={2}
                  placeholder="Texto da pergunta"
                  value={q.text}
                  onChange={(e) => {
                    const qs = [...editing.questions];
                    qs[idx] = { ...q, text: e.target.value };
                    setEditing({ ...editing, questions: qs });
                  }}
                />
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing({ ...editing, questions: [...editing.questions, emptyQ()] })}
            >
              <Plus className="h-4 w-4 mr-2" /> Adicionar pergunta
            </Button>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
