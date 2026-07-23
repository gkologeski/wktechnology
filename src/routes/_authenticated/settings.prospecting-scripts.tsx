import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2, Play, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  listScripts,
  upsertScript,
  deleteScript,
  type ProspectingScript,
} from "@/lib/prospecting-scripts.functions";
import { previewVoice, CURATED_VOICES } from "@/lib/voice-agent.functions";

export const Route = createFileRoute("/_authenticated/settings/prospecting-scripts")({
  component: ScriptsPage,
});

export function ScriptsPage() {
  const listFn = useServerFn(listScripts);
  const saveFn = useServerFn(upsertScript);
  const delFn = useServerFn(deleteScript);
  const previewFn = useServerFn(previewVoice);

  const [rows, setRows] = useState<ProspectingScript[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<ProspectingScript> | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const refresh = async () => setRows(await listFn());
  useEffect(() => {
    refresh(); /* eslint-disable-next-line */
  }, []);

  const save = async () => {
    if (!edit) return;
    try {
      await saveFn({
        data: {
          id: edit.id ?? null,
          name: edit.name ?? "",
          system_prompt: edit.system_prompt ?? "",
          first_message: edit.first_message ?? "",
          objective: edit.objective ?? null,
          voice_id: edit.voice_id ?? null,
          voice_provider: (edit.voice_provider ?? "elevenlabs") as "elevenlabs",
          variables: edit.variables ?? {},
        },
      });
      toast.success("Script salvo");
      setOpen(false);
      setEdit(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const testVoice = async () => {
    if (!edit?.voice_id || !edit?.first_message) {
      toast.error("Defina uma voz e a mensagem de abertura primeiro");
      return;
    }
    setPreviewing(true);
    try {
      const out = await previewFn({ data: { voice_id: edit.voice_id, text: edit.first_message } });
      const audio = new Audio(`data:audio/mpeg;base64,${out.audio_base64}`);
      await audio.play();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-lg font-semibold">Scripts de prospecção</h2>
          <p className="text-sm text-muted-foreground">
            Crie variações de roteiro para testar em campanhas A/B.
          </p>
        </div>
        <Button
          onClick={() => {
            setEdit({ voice_provider: "elevenlabs" });
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo script
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum script ainda.</p>
          )}
          <div className="divide-y">
            {rows.map((r) => (
              <div key={r.id} className="py-2 flex items-center justify-between gap-2">
                <button
                  className="text-left flex-1 min-w-0"
                  onClick={() => {
                    setEdit(r);
                    setOpen(true);
                  }}
                >
                  <div className="font-medium truncate">{r.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{r.objective ?? "—"}</div>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    if (confirm("Remover?")) {
                      await delFn({ data: { id: r.id } });
                      refresh();
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Editar script" : "Novo script"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div>
              <Label>Nome</Label>
              <Input
                value={edit?.name ?? ""}
                onChange={(e) => setEdit((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Objetivo</Label>
              <Input
                value={edit?.objective ?? ""}
                onChange={(e) => setEdit((f) => ({ ...f, objective: e.target.value }))}
                placeholder="Qualificar, agendar reunião..."
              />
            </div>
            <div>
              <Label>Voz (ElevenLabs voice_id)</Label>
              <div className="flex gap-2">
                <Input
                  className="flex-1"
                  value={edit?.voice_id ?? ""}
                  onChange={(e) => setEdit((f) => ({ ...f, voice_id: e.target.value }))}
                  placeholder={CURATED_VOICES[0].id}
                />
                <Button variant="outline" onClick={testVoice} disabled={previewing}>
                  {previewing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Deixe vazio para usar a voz padrão do workspace.
              </p>
            </div>
            <div>
              <Label>Mensagem de abertura</Label>
              <Textarea
                rows={3}
                value={edit?.first_message ?? ""}
                onChange={(e) => setEdit((f) => ({ ...f, first_message: e.target.value }))}
                placeholder="Oi {{lead.name}}, aqui é a Sara da..."
              />
            </div>
            <div>
              <Label>Prompt do sistema</Label>
              <Textarea
                rows={8}
                value={edit?.system_prompt ?? ""}
                onChange={(e) => setEdit((f) => ({ ...f, system_prompt: e.target.value }))}
                placeholder="Você é um SDR ligando para {{lead.name}} da empresa {{lead.company}}. Seu objetivo é..."
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Variáveis disponíveis: <code>{`{{lead.name}}`}</code>,{" "}
              <code>{`{{lead.company}}`}</code>.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
