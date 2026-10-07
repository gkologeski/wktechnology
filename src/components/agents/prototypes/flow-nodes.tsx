import { useId, type CSSProperties } from "react";
import { DndContext, useDraggable, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import {
  Bot,
  ShieldCheck,
  UserRound,
  CircleStop,
  Zap,
  Plus,
  Minus,
  Maximize,
  Settings2,
  X,
  Database,
  Calendar,
  GitBranch,
  FileText,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useDemo } from "./state";
import { EDGES, type FlowNode } from "./model";
const icons: Record<string, typeof Bot> = {
  entrada: Zap,
  proteção: ShieldCheck,
  agente: Bot,
  humano: UserRound,
  saída: CircleStop,
};
const groups = [
  {
    name: "Construir",
    items: ["Agente", "Classificar", "Proteções", "Condição", "Enviar resposta", "Fim"],
  },
  { name: "Conhecimento", items: ["Buscar KB", "Consultar catálogo", "Buscar cliente"] },
  {
    name: "Ferramentas",
    items: ["Agendar reunião", "Escalar pra humano", "Prospecção", "Nota interna"],
  },
];

export function DraggableNode({
  node,
  zoom,
  selected,
  onSelect,
}: {
  node: FlowNode;
  zoom: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: node.id });
  const Icon = icons[node.kind] ?? GitBranch;
  const style: CSSProperties = {
    left: node.x,
    top: node.y,
    transform: transform ? `translate(${transform.x / zoom}px,${transform.y / zoom}px)` : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      aria-label={`Bloco ${node.title}`}
      aria-pressed={selected}
      className="ap-node"
      data-selected={selected}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSelect();
      }}
    >
      <span className="ap-port -left-1" />
      <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
          <Icon size={16} />
        </span>
        <span className="min-w-0 truncate text-sm font-semibold">{node.title}</span>
      </div>
      <p className="px-4 py-3 text-xs leading-relaxed text-muted-foreground">{node.summary}</p>
      <span className="ap-port -right-1" />
    </div>
  );
}
export function Inspector({ selected }: { selected: string }) {
  const { agent, patch } = useDemo();
  const id = useId();
  const node = agent.nodes.find((n) => n.id === selected);
  if (!node) return null;
  const update = (change: Partial<FlowNode>) =>
    patch({ nodes: agent.nodes.map((n) => (n.id === selected ? { ...n, ...change } : n)) });
  return (
    <div className="space-y-5">
      <div>
        <p className="ap-caption uppercase">Configuração do bloco</p>
        <h3 className="mt-1 text-base font-semibold">{node.title}</h3>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-title`}>Título</Label>
        <Input
          id={`${id}-title`}
          value={node.title}
          onChange={(e) => update({ title: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-summary`}>Instrução / parâmetro</Label>
        <Textarea
          id={`${id}-summary`}
          value={node.summary}
          onChange={(e) => update({ summary: e.target.value })}
          rows={4}
        />
      </div>
      <div className="space-y-2 text-xs">
        <p className="font-medium">Ferramentas disponíveis</p>
        {[Database, Calendar, UserRound].map((Icon, i) => (
          <div key={i} className="flex items-center gap-2 py-1 text-muted-foreground">
            <Icon size={14} />
            {["Buscar conhecimento", "Agenda do agente", "Transferência humana"][i]}
          </div>
        ))}
      </div>
      <div className="border-t border-border-subtle pt-4 text-xs text-muted-foreground">
        Saída: {node.kind === "proteção" ? "Passou / Bloqueou" : "Próximo bloco"}
        <br />
        <span className="mt-2 block text-success">Alterações no desenho local</span>
      </div>
    </div>
  );
}
