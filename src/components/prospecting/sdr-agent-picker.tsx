import { useState } from "react";
import { useSdrPlaybooks } from "@/hooks/use-default-sdr-agent";
import {
  agentOptionLabel,
  pickDefaultAgent,
  sortDefaultFirst,
} from "@/lib/prospecting/sdr/default-agent";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SdrAgentStudio } from "./sdr-agent-studio";
import { SdrAgentActions } from "./sdr-agent-actions";

type PickerPlaybook = {
  id: string;
  name: string;
  enabled: boolean;
  questionnaire_id: string | null;
};

/**
 * Agente editado em "Persona e teste". Com `agentId`, a escolha vem da barra do
 * Estúdio (sem seletor próprio); sem ela, mostra seletor e ações (Prospecção).
 */
export function SdrAgentPicker({
  workspaceId,
  playbooks,
  agentId,
}: {
  workspaceId: string;
  playbooks: PickerPlaybook[];
  agentId?: string | null;
}) {
  const { defaultPlaybookId } = useSdrPlaybooks();
  const fallback = pickDefaultAgent(playbooks, defaultPlaybookId, (l) =>
    l.find((p) => p.questionnaire_id),
  );
  const [picked, setPicked] = useState<string | null>(null);
  const controlled = agentId !== undefined;
  const playbookId = controlled
    ? agentId
    : picked && playbooks.some((p) => p.id === picked)
      ? picked
      : fallback;
  const current = playbooks.find((p) => p.id === playbookId) ?? null;

  return (
    <div className="space-y-4">
      {!controlled && playbooks.length > 0 && (
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
          <SdrAgentActions
            current={current}
            isMain={!!current && current.id === defaultPlaybookId}
            onDeleted={() => setPicked(null)}
            onDuplicated={setPicked}
          />
        </div>
      )}
      <SdrAgentStudio
        key={playbookId ?? "none"}
        workspaceId={workspaceId}
        playbookId={playbookId ?? null}
      />
    </div>
  );
}
