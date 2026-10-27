// Ações sobre o agente: criar, principal, editar nome, duplicar e excluir.
// A UI só espelha as permissões; o servidor revalida cada ação.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Loader2, Pencil, Plus, Star, Trash2 } from "lucide-react";
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
import { usePermissions } from "@/lib/access-control/use-permissions";
import {
  deletePlaybook,
  renamePlaybook,
  setDefaultPlaybook,
  upsertPlaybook,
} from "@/lib/sdr-agent.functions";
import { duplicateSdrAgent } from "@/lib/prospecting/sdr-agent.functions";

const P = "techsales.marketing.sdr_agent";
const CREATE_KEYS = [`${P}.create.own`, `${P}.create.team`, `${P}.create.workspace`];

export type SdrAgentLike = { id: string; name: string; enabled: boolean };

export function SdrAgentActions({
  current,
  isMain,
  onDeleted,
  onDuplicated,
}: {
  current: SdrAgentLike | null;
  isMain: boolean;
  onDeleted?: () => void;
  onDuplicated?: (id: string) => void;
}) {
  const qc = useQueryClient();
  const permissions = usePermissions();
  const rename = useServerFn(renamePlaybook);
  const del = useServerFn(deletePlaybook);
  const setMain = useServerFn(setDefaultPlaybook);
  const duplicate = useServerFn(duplicateSdrAgent);
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState("");
  const canCreate = permissions.canAny(CREATE_KEYS);

  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["sdr-overview"] }),
      qc.invalidateQueries({ queryKey: ["sdr-playbooks"] }),
      qc.invalidateQueries({ queryKey: ["service_channels"] }),
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
      if (!r.archived) onDeleted?.();
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const duplicateM = useMutation({
    mutationFn: (id: string) => duplicate({ data: { playbookId: id } }),
    onSuccess: async (r) => {
      toast.success(`"${r.name}" criado`, {
        description:
          "A cópia está desativada, com a persona em rascunho e sem número de WhatsApp. Revise, publique e ative quando quiser.",
      });
      await refresh();
      onDuplicated?.(r.id);
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
  const onDuplicate = async () => {
    if (!current) return;
    const ok = await confirmDialog(
      `Duplicar "${current.name}"? A cópia leva persona, roteiro, configuração, ferramentas e materiais, mas nasce desativada e sem número de WhatsApp.`,
    );
    if (ok) duplicateM.mutate(current.id);
  };

  return (
    <>
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
        disabled={!current || !canCreate || duplicateM.isPending}
        onClick={onDuplicate}
        title={
          canCreate
            ? "Criar uma cópia com todo o conteúdo"
            : "Você não tem permissão para criar agentes."
        }
        aria-label={current ? `Duplicar agente ${current.name}` : "Duplicar agente"}
      >
        {duplicateM.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
        Duplicar
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
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogTitle>Editar agente</DialogTitle>
          <DialogDescription>
            Persona e tom ficam em "Persona e teste"; situação, roteiro, número de WhatsApp e regras ficam em "Configuração do agente".
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
    </>
  );
}

const NEW_AGENT_PROMPT =
  "Avalie de 0 a 100 o interesse do lead em comprar nosso produto, com base nas respostas.";

/**
 * Cria um agente só com o nome; o resto é ajustado em "Configuração do agente".
 * Nasce ativo, sem número de WhatsApp e sem persona publicada, então não atende
 * ninguém até ser configurado. O servidor revalida a permissão de criação.
 */
export function SdrNewAgentButton({ onCreated }: { onCreated: (id: string) => void }) {
  const qc = useQueryClient();
  const permissions = usePermissions();
  const create = useServerFn(upsertPlaybook);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const canCreate = permissions.canAny(CREATE_KEYS);

  const createM = useMutation({
    mutationFn: () =>
      create({ data: { name: name.trim(), enabled: true, qualification_prompt: NEW_AGENT_PROMPT } }),
    onSuccess: async (r) => {
      const id = (r.item as { id: string }).id;
      toast.success("Agente criado", {
        description: "Configure o roteiro, a persona e o número de WhatsApp antes de usá-lo.",
      });
      setOpen(false);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["sdr-overview"] }),
        qc.invalidateQueries({ queryKey: ["sdr-playbooks"] }),
      ]);
      onCreated(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <Button
        onClick={() => {
          setName("");
          setOpen(true);
        }}
        disabled={!canCreate}
        title={canCreate ? undefined : "Você não tem permissão para criar agentes."}
      >
        <Plus className="h-4 w-4 mr-1" aria-hidden="true" /> Novo agente
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Novo agente</DialogTitle>
          <DialogDescription>
            Depois de criar, você ajusta tudo em "Configuração do agente" e em "Persona e teste".
          </DialogDescription>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim() && !createM.isPending) createM.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="sdr-new-agent-name">Nome do agente</Label>
              <Input
                id="sdr-new-agent-name"
                value={name}
                maxLength={120}
                required
                autoFocus
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!name.trim() || createM.isPending}>
                {createM.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Criar agente
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
