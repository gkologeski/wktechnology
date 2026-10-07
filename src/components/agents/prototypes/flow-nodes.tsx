import { useId, type CSSProperties } from "react";
import { useDraggable } from "@dnd-kit/core";
import {
  Bot,
  ShieldCheck,
  UserRound,
  CircleStop,
  Zap,
  GitBranch,
  Split,
  Check,
  Send,
  StickyNote,
  UserSearch,
  Database,
  Package,
  Calendar,
  UserPlus,
  Tag,
  Image,
  Clock,
  FileText,
  Star,
  Target,
  Globe,
  Trash2,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getNodeType } from "@/lib/agents/flow/catalog";
import { DEPENDENCY_LABEL } from "@/lib/agents/flow/runtime";
import { NodeConfigForm } from "@/components/agents/flow/node-config-form";
import { useDemo } from "./state";
import { DEMO_AVAILABLE, DEMO_OPTIONS, type FlowNode } from "./model";

export const ICONS: Record<string, typeof Bot> = {
  zap: Zap,
  bot: Bot,
  split: Split,
  shield: ShieldCheck,
  branch: GitBranch,
  check: Check,
  send: Send,
  stop: CircleStop,
  sticky: StickyNote,
  "user-search": UserSearch,
  database: Database,
  package: Package,
  calendar: Calendar,
  user: UserRound,
  "user-plus": UserPlus,
  tag: Tag,
  image: Image,
  clock: Clock,
  file: FileText,
  star: Star,
  target: Target,
  globe: Globe,
};
export const NODE_W = 230;
export const INPUT_Y = 22;
export const portY = (i: number) => 104 + i * 22;

export function DraggableNode({
  node,
  zoom,
  selected,
  dimmed,
  issues,
  connecting,
  onSelect,
  onPort,
}: {
  node: FlowNode;
  zoom: number;
  selected: boolean;
  dimmed: boolean;
  issues: number;
  connecting: boolean;
  onSelect: () => void;
  onPort: (port: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: node.id });
  const def = getNodeType(node.type);
  const Icon = ICONS[def?.icon ?? ""] ?? GitBranch;
  const outputs = def && !def.visual ? def.outputs(node.config) : [];
  const style: CSSProperties = {
    left: node.x,
    top: node.y,
    width: NODE_W,
    opacity: dimmed ? 0.35 : 1,
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
      aria-label={`Bloco ${node.title} (${def?.label ?? node.type})`}
      aria-pressed={selected}
      className="ap-node"
      data-selected={selected}
      data-type={node.type}
      data-visual={def?.visual ? "true" : undefined}
      data-connecting={connecting || undefined}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSelect();
      }}
    >
      {node.type !== "start" && !def?.visual && (
        <span className="ap-port" style={{ left: -5, top: INPUT_Y - 4 }} />
      )}
      <div className="flex items-center gap-2 border-b border-border-subtle px-3 py-2.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
          <Icon size={15} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{node.title}</span>
          <span className="block truncate text-[10px] text-muted-foreground">
            {def?.label ?? node.type}
          </span>
        </span>
        {issues > 0 && (
          <span
            className="rounded bg-destructive/10 px-1.5 text-[10px] font-medium text-destructive"
            title={`${issues} pendências`}
          >
            {issues}
          </span>
        )}
      </div>
      <p className="line-clamp-2 h-[42px] px-3 pt-2 text-[11px] leading-snug text-muted-foreground">
        {def?.summary(node.config)}
      </p>
      {outputs.length > 0 && (
        <div className="pb-1.5">
          {outputs.map((p) => (
            <div
              key={p}
              className="relative flex h-[22px] items-center justify-end pr-4 text-[10px] text-muted-foreground"
            >
              {p}
              <button
                type="button"
                className="ap-port ap-port-out"
                style={{ right: -5, top: 7 }}
                aria-label={`Conectar saída ${p} de ${node.title}`}
                title={`Conectar saída “${p}”`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onPort(p);
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Inspector({
  selected,
  onDelete,
  onDuplicate,
}: {
  selected: string;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
}) {
  const { agent, agents, patch } = useDemo();
  const id = useId();
  const node = agent.nodes.find((n) => n.id === selected);
  if (!node) return <p className="text-xs text-muted-foreground">Selecione um bloco no canvas.</p>;
  const def = getNodeType(node.type);
  const update = (change: Partial<FlowNode>) =>
    patch({ nodes: agent.nodes.map((n) => (n.id === selected ? { ...n, ...change } : n)) });
  const outputs = def && !def.visual ? def.outputs(node.config) : [];
  const setTarget = (port: string, to: string) =>
    patch({
      edges: [
        ...agent.edges.filter((e) => !(e.from === node.id && e.port === port)),
        ...(to === "__none" ? [] : [{ id: crypto.randomUUID(), from: node.id, to, port }]),
      ],
    });
  return (
    <div className="space-y-5" data-inspector={node.type}>
      <div>
        <p className="ap-caption uppercase">
          {def?.category} · {def?.label}
        </p>
        <h3 className="mt-1 text-base font-semibold">{node.title}</h3>
        {def?.dependency && (
          <p
            className={`mt-1 text-[10px] ${DEMO_AVAILABLE.includes(def.dependency) ? "text-muted-foreground" : "text-destructive"}`}
          >
            Depende de: {DEPENDENCY_LABEL[def.dependency]}
            {DEMO_AVAILABLE.includes(def.dependency)
              ? " · simulado no protótipo"
              : " · não conectado"}
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-title`} className="text-xs">
          Título no canvas
        </Label>
        <Input
          id={`${id}-title`}
          value={node.title}
          onChange={(e) => update({ title: e.target.value })}
        />
      </div>
      <NodeConfigForm
        type={node.type}
        config={node.config}
        onChange={(config) => update({ config })}
        options={{
          ...DEMO_OPTIONS,
          sources: agent.sources.map((s) => s.name),
          agents: agents.filter((a) => a.id !== agent.id && !a.archived).map((a) => a.name),
        }}
      />
      {outputs.length > 0 && (
        <div className="space-y-2 border-t border-border-subtle pt-3">
          <p className="text-xs font-medium">Conexões</p>
          {outputs.map((p) => {
            const edge = agent.edges.find((e) => e.from === node.id && e.port === p);
            return (
              <div key={p} className="grid grid-cols-[80px_1fr] items-center gap-2 text-xs">
                <span className="truncate text-muted-foreground">{p} →</span>
                <Select value={edge?.to ?? "__none"} onValueChange={(v) => setTarget(p, v)}>
                  <SelectTrigger aria-label={`Destino da saída ${p}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Sem conexão</SelectItem>
                    {agent.nodes
                      .filter(
                        (n) =>
                          n.id !== node.id && n.type !== "start" && !getNodeType(n.type)?.visual,
                      )
                      .map((n) => (
                        <SelectItem key={n.id} value={n.id}>
                          {n.title}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex gap-2 border-t border-border-subtle pt-3">
        {onDuplicate && node.type !== "start" && (
          <Button size="sm" variant="outline" onClick={() => onDuplicate(node.id)}>
            <Copy /> Duplicar
          </Button>
        )}
        {onDelete && node.type !== "start" && (
          <Button size="sm" variant="outline" onClick={() => onDelete(node.id)}>
            <Trash2 /> Remover
          </Button>
        )}
      </div>
    </div>
  );
}
