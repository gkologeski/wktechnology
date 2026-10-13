// Inspetores dos blocos de prospecção: Aguardar resposta, Agente SDR e Transferir.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listSdrAgentsForWorkflow } from "@/lib/workflow-refs.functions";
import type { WorkflowAction } from "@/lib/workflows/types";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";

type WaitAction = Extract<WorkflowAction, { type: "wait_for_reply" }>;
type AgentAction = Extract<WorkflowAction, { type: "sdr_agent" }>;
type HandoffAction = Extract<WorkflowAction, { type: "handoff" }>;

export function WaitForReplyForm({
  action,
  onChange,
}: {
  action: WaitAction;
  onChange: (a: WaitAction) => void;
}) {
  const toggle = (ch: "whatsapp" | "email", on: boolean) => {
    const set = new Set(action.channels);
    if (on) set.add(ch);
    else set.delete(ch);
    onChange({ ...action, channels: [...set] as WaitAction["channels"] });
  };
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Pausa o fluxo até o contato responder (mensagem recebida de verdade) ou até o prazo acabar.
        A resposta é conferida a cada 10 minutos. Pode ficar no caminho principal ou dentro de um
        caminho.
      </p>
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium">Canais que contam como resposta *</legend>
        {(["whatsapp", "email"] as const).map((ch) => (
          <label key={ch} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={action.channels.includes(ch)}
              onCheckedChange={(v) => toggle(ch, v === true)}
            />
            {ch === "whatsapp" ? "WhatsApp" : "E-mail"}
          </label>
        ))}
      </fieldset>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs" htmlFor="wf-wait-amount">
            Prazo *
          </Label>
          <Input
            id="wf-wait-amount"
            type="number"
            min={1}
            max={720}
            value={action.timeout_amount}
            onChange={(e) =>
              onChange({ ...action, timeout_amount: Math.max(1, Number(e.target.value) || 1) })
            }
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs" htmlFor="wf-wait-unit">
            Unidade
          </Label>
          <Select
            value={action.timeout_unit}
            onValueChange={(v) => onChange({ ...action, timeout_unit: v as "hours" | "days" })}
          >
            <SelectTrigger id="wf-wait-unit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hours">Horas</SelectItem>
              <SelectItem value="days">Dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {action.channels.length === 0 && (
        <p className="text-xs text-destructive" role="alert">
          Escolha ao menos um canal.
        </p>
      )}
    </div>
  );
}

function useAgents() {
  const fn = useServerFn(listSdrAgentsForWorkflow);
  return useQuery({ queryKey: ["wf-sdr-agents"], queryFn: () => fn(), staleTime: 60_000 });
}

export function SdrAgentForm({
  action,
  onChange,
}: {
  action: AgentAction;
  onChange: (a: AgentAction) => void;
}) {
  const q = useAgents();
  const agents = q.data ?? [];
  const chosen = agents.find((a) => a.id === action.playbook_id);
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Liga ou desliga o agente na conversa de WhatsApp do registro. O agente usa só a versão
        publicada e respeita opt-out, piloto e limites dele.
      </p>
      <div className="space-y-1">
        <Label className="text-xs" htmlFor="wf-sdr-mode">
          Ação
        </Label>
        <Select
          value={action.mode}
          onValueChange={(v) => onChange({ ...action, mode: v as "on" | "off" })}
        >
          <SelectTrigger id="wf-sdr-mode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="on">Ligar agente</SelectItem>
            <SelectItem value="off">Desligar agente</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {action.mode === "on" && (
        <div className="space-y-1">
          <Label className="text-xs" htmlFor="wf-sdr-agent">
            Agente *
          </Label>
          {q.isLoading ? (
            <p className="text-xs text-muted-foreground" aria-live="polite">
              Carregando agentes…
            </p>
          ) : q.isError ? (
            <p className="text-xs text-destructive" role="alert">
              Não foi possível carregar os agentes.
            </p>
          ) : agents.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum agente nesta empresa.</p>
          ) : (
            <Select
              value={action.playbook_id ?? ""}
              onValueChange={(v) => onChange({ ...action, playbook_id: v })}
            >
              <SelectTrigger id="wf-sdr-agent">
                <SelectValue placeholder="Escolha o agente" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                    {a.published ? "" : " (sem versão publicada)"}
                    {a.enabled ? "" : " · desativado"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {chosen && (!chosen.published || !chosen.enabled) && (
            <p className="text-xs text-destructive" role="alert">
              Este agente precisa estar ativo e com versão publicada; a publicação do fluxo fica
              bloqueada até lá.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function HandoffForm({
  action,
  onChange,
}: {
  action: HandoffAction;
  onChange: (a: HandoffAction) => void;
}) {
  const membersQ = useWorkspaceMembers();
  const members = (membersQ.data ?? []).map((m) => ({
    id: m.user_id as string,
    name: m.full_name?.trim() || "Sem nome",
  }));
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Pausa o agente da conversa, define o responsável do registro e avisa a pessoa.
      </p>
      <div className="space-y-1">
        <Label className="text-xs" htmlFor="wf-handoff-user">
          Pessoa
        </Label>
        <Select
          value={action.user_id ?? "__owner"}
          onValueChange={(v) => onChange({ ...action, user_id: v === "__owner" ? undefined : v })}
        >
          <SelectTrigger id="wf-handoff-user">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__owner">Responsável atual do registro</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs" htmlFor="wf-handoff-reason">
          Motivo *
        </Label>
        <Textarea
          id="wf-handoff-reason"
          rows={2}
          value={action.reason}
          onChange={(e) => onChange({ ...action, reason: e.target.value })}
        />
      </div>
    </div>
  );
}
