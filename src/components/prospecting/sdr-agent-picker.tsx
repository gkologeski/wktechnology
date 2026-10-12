import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SdrAgentStudio } from "./sdr-agent-studio";

type PickerPlaybook = { id: string; name: string; enabled: boolean; questionnaire_id: string | null };

/** Seleção explícita do agente (playbook) editado em "Persona e teste". */
export function SdrAgentPicker({
  workspaceId,
  playbooks,
}: {
  workspaceId: string;
  playbooks: PickerPlaybook[];
}) {
  const fallback = (playbooks.find((p) => p.questionnaire_id) ?? playbooks[0])?.id ?? null;
  const [picked, setPicked] = useState<string | null>(null);
  const playbookId = picked && playbooks.some((p) => p.id === picked) ? picked : fallback;
  return (
    <div className="space-y-4">
      {playbooks.length > 1 && (
        <div className="flex max-w-md flex-col gap-1.5">
          <Label htmlFor="sdr-agent-picker">Agente</Label>
          <Select value={playbookId ?? undefined} onValueChange={setPicked}>
            <SelectTrigger id="sdr-agent-picker">
              <SelectValue placeholder="Escolha o agente" />
            </SelectTrigger>
            <SelectContent>
              {playbooks.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                  {p.enabled ? "" : " (desativado)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <SdrAgentStudio
        key={playbookId ?? "none"}
        workspaceId={workspaceId}
        playbookId={playbookId}
      />
    </div>
  );
}
