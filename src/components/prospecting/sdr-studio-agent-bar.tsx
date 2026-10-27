// Barra do Estúdio: escolhe o agente aberto em todas as seções e reúne as
// ações sobre ele (principal, editar, duplicar, excluir).
import { Bot, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProductPanel } from "@/components/techhire/ui";
import { agentOptionLabel, sortDefaultFirst } from "@/lib/prospecting/sdr/default-agent";
import { SdrAgentActions, type SdrAgentLike } from "./sdr-agent-actions";

export function SdrStudioAgentBar({
  agents,
  agentId,
  defaultAgentId,
  creating,
  workspaceWide,
  loading,
  onSelect,
}: {
  agents: SdrAgentLike[];
  agentId: string | null;
  defaultAgentId: string | null;
  creating: boolean;
  workspaceWide: boolean;
  loading: boolean;
  onSelect: (id: string | null) => void;
}) {
  const current = creating ? null : (agents.find((a) => a.id === agentId) ?? null);
  const isMain = !!current && current.id === defaultAgentId;

  return (
    <ProductPanel className="mt-4 overflow-hidden">
      <div className="flex flex-col gap-3 px-4 py-3 md:px-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 items-end gap-3">
          <div className="hidden size-9 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary sm:flex">
            <Bot className="size-4" aria-hidden="true" />
          </div>
          <div className="flex w-full min-w-0 flex-col gap-1.5 sm:w-80">
            <Label htmlFor="sdr-studio-agent">Agente aberto</Label>
            <Select
              value={creating ? "__new__" : (agentId ?? undefined)}
              onValueChange={(v) => onSelect(v === "__new__" ? null : v)}
              disabled={loading || (!agents.length && !creating)}
            >
              <SelectTrigger id="sdr-studio-agent">
                <SelectValue placeholder={loading ? "Carregando…" : "Nenhum agente ainda"} />
              </SelectTrigger>
              <SelectContent>
                {creating ? <SelectItem value="__new__">Novo agente (não salvo)</SelectItem> : null}
                {sortDefaultFirst(agents, defaultAgentId).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {agentOptionLabel(a, defaultAgentId)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {current ? (
            <div className="hidden flex-wrap gap-1.5 pb-2 md:flex">
              <Badge variant={current.enabled ? "secondary" : "outline"}>
                {current.enabled ? "Ativo" : "Desativado"}
              </Badge>
              {isMain ? <Badge variant="outline">Principal</Badge> : null}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <SdrAgentActions
            current={current}
            isMain={isMain}
            onDeleted={() => onSelect(null)}
            onDuplicated={(id) => onSelect(id)}
          />
        </div>
      </div>
      {creating || workspaceWide ? (
        <p className="flex items-start gap-2 border-t border-product-divider bg-product-toolbar px-4 py-2 text-xs text-text-secondary md:px-5">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {creating
            ? "Novo agente: preencha o Playbook e salve para liberar as demais seções."
            : "Esta seção vale para todos os agentes do workspace. A conversa de teste usa o agente aberto."}
        </p>
      ) : null}
    </ProductPanel>
  );
}
