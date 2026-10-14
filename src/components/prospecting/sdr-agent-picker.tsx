import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Pencil, Star, Trash2 } from "lucide-react";
import { useSdrPlaybooks } from "@/hooks/use-default-sdr-agent";
import {
  agentOptionLabel,
  pickDefaultAgent,
  sortDefaultFirst,
} from "@/lib/prospecting/sdr/default-agent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { deletePlaybook, renamePlaybook, setDefaultPlaybook } from "@/lib/sdr-agent.functions";
import { SdrAgentStudio } from "./sdr-agent-studio";

type PickerPlaybook = {
  id: string;
  name: string;
  enabled: boolean;
  questionnaire_id: string | null;
};

/** Seleção explícita do agente (playbook) editado em "Persona e teste", com editar/excluir. */
export function SdrAgentPicker({
  workspaceId,
  playbooks,
}: {
  workspaceId: string;
  playbooks: PickerPlaybook[];
}) {
  const qc = useQueryClient();
  const rename = useServerFn(renamePlaybook);
  const del = useServerFn(deletePlaybook);
  const setMain = useServerFn(setDefaultPlaybook);
  const { defaultPlaybookId } = useSdrPlaybooks();
  const fallback = pickDefaultAgent(playbooks, defaultPlaybookId, (l) =>
    l.find((p) => p.questionnaire_id),
  );
  const [picked, setPicked] = useState<string | null>(null);
  const playbookId = picked && playbooks.some((p) => p.id === picked) ? picked : fallback;
  const current = playbooks.find((p) => p.id === playbookId) ?? null;
  const isMain = !!current && current.id === defaultPlaybookId;
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState("");
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["sdr-overview"] }),
      qc.invalidateQueries({ queryKey: ["sdr-playbooks"] }),
    ]);

  const mainM = useMutation({
    mutationFn: (id: string) => setMain({ data: { id } }),
    onSuccess: async () => {
      toast.success("Agente principal definido");
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const renameM = useMutation({
    mutationFn: () => rename({ data: { id: current!.id, name } }),
    onSuccess: async () => {
      toast.success("Agente atualizado");
      setEditOpen(false);
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: async (r) => {
      toast.success(
        r.archived
          ? "Agente desativado: ele tem histórico, versão publicada ou vínculo com campanha."
          : "Agente excluído",
      );
      if (!r.archived) setPicked(null);
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onDelete = async () => {
    if (!current) return;
    const ok = await confirmDialog(
      `Excluir o agente "${current.name}"? Se ele tiver histórico, versão publicada ou campanha vinculada, será apenas desativado.`,
    );
    if (ok) deleteM.mutate(current.id);
  };

  const onMain = async () => {
    if (!current) return;
    const ok = await confirmDialog(
      `Definir "${current.name}" como agente principal? Ele virá escolhido por padrão nos seletores e atenderá conversas novas sem agente vinculado.`,
    );
    if (ok) mainM.mutate(current.id);
  };

  return (
    <div className="space-y-4">
      {playbooks.length > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex w-full max-w-md flex-col gap-1.5">
            <Label htmlFor="sdr-agent-picker">Agente</Label>
            <Select value={playbookId ?? undefined} onValueChange={setPicked}>
              <SelectTrigger id="sdr-agent-picker">
                <SelectValue placeholder="Escolha o agente" />
              </SelectTrigger>
              <SelectContent>
                {sortDefaultFirst(playbooks, defaultPlaybookId).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {agentOptionLabel(p, defaultPlaybookId)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            disabled={!current || isMain || !current.enabled || mainM.isPending}
            onClick={onMain}
            title={
              current && !current.enabled
                ? "Agente desativado não pode ser o principal"
                : isMain
                  ? "Este é o agente principal"
                  : "Usar como escolha padrão"
            }
          >
            {mainM.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Star className={isMain ? "h-4 w-4 fill-current text-warning" : "h-4 w-4"} />
            )}
            {isMain ? "Agente principal" : "Definir como principal"}
          </Button>
          <Button
            variant="outline"
            disabled={!current}
            onClick={() => {
              setName(current?.name ?? "");
              setEditOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" /> Editar
          </Button>
          <Button
            variant="outline"
            disabled={!current || deleteM.isPending}
            onClick={onDelete}
            aria-label={current ? `Excluir agente ${current.name}` : "Excluir agente"}
          >
            {deleteM.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Excluir
          </Button>
        </div>
      )}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogTitle>Editar agente</DialogTitle>
          <DialogDescription>
            Persona e tom são editados abaixo; regras de canal e sequência ficam na aba Playbook.
          </DialogDescription>
          <div className="space-y-1.5">
            <Label htmlFor="sdr-agent-name">Nome do agente</Label>
            <Input
              id="sdr-agent-name"
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={!name.trim() || renameM.isPending} onClick={() => renameM.mutate()}>
              {renameM.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <SdrAgentStudio
        key={playbookId ?? "none"}
        workspaceId={workspaceId}
        playbookId={playbookId}
      />
    </div>
  );
}
