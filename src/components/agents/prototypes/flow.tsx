import { useState, useRef, useEffect, type CSSProperties } from "react";
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
import { DraggableNode, Inspector } from "./flow-nodes";
export function FlowCanvas({ layout = "studio" }: { layout?: "studio" | "tray" | "bottom" }) {
  const { agent, patch } = useDemo();
  const [selected, setSelected] = useState("agent");
  const [zoom, setZoom] = useState(0.65);
  const [pan, setPan] = useState({ x: 18, y: 65 });
  const [inspector, setInspector] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const resize = () => {
      const z = Math.max(
        0.23,
        Math.min((element.clientWidth - 60) / 1160, (element.clientHeight - 100) / 530, 1),
      );
      setZoom(z);
      setPan({ x: 24, y: (element.clientHeight - 530 * z) / 2 });
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const rect = element.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        const z = zoomRef.current;
        const next = Math.min(1.5, Math.max(0.2, z * Math.exp(-e.deltaY * 0.01)));
        zoomRef.current = next;
        setZoom(next);
        setPan((p) => ({ x: px - ((px - p.x) * next) / z, y: py - ((py - p.y) * next) / z }));
        return;
      }
      setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, []);
  const fit = () => {
    const width = ref.current?.clientWidth ?? 600;
    const height = ref.current?.clientHeight ?? 500;
    const z = Math.min((width - 60) / 1160, (height - 100) / 530, 1);
    setZoom(Math.max(0.23, z));
    setPan({ x: 24, y: (height - 530 * z) / 2 });
  };
  const add = (title: string) => {
    const node = {
      id: crypto.randomUUID(),
      title,
      kind: "agente",
      summary: "Configurar instrução deste bloco",
      x: 450,
      y: 450,
      from: selected,
    };
    patch({ nodes: [...agent.nodes, node] });
    setSelected(node.id);
  };
  const Palette = ({ tray = false }: { tray?: boolean }) => (
    <div className={tray ? "ap-flow-tray" : "ap-palette"}>
      {groups.map((group) => (
        <div key={group.name} className={tray ? "flex items-center gap-1" : "mb-5"}>
          {!tray && (
            <h3 className="mb-2 px-2 text-[10px] font-semibold uppercase text-muted-foreground">
              {group.name}
            </h3>
          )}
          {group.items.map((title, i) => (
            <Button
              key={title}
              size="sm"
              variant="ghost"
              className={tray ? "shrink-0" : "mb-1 w-full justify-start font-normal"}
              onClick={() => add(title)}
              title={`Adicionar ${title}`}
            >
              <span className="text-muted-foreground">
                {i % 3 === 0 ? <Bot /> : i % 3 === 1 ? <GitBranch /> : <Plus />}
              </span>
              {title}
            </Button>
          ))}
        </div>
      ))}
      {!tray && (
        <div className="border-t border-border-subtle pt-3">
          <Button
            disabled
            variant="ghost"
            size="sm"
            title="Integração HTTP não disponível no protótipo"
          >
            HTTP Request
          </Button>
          <p className="px-2 text-[10px] text-muted-foreground">Não conectado</p>
        </div>
      )}
    </div>
  );
  const canvas = (
    <div
      ref={ref}
      className="ap-canvas cursor-grab touch-none active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-ring"
      aria-label="Canvas de fluxo. Arraste o fundo ou use as setas para mover a visualização"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        const step = 40;
        const d = {
          ArrowLeft: [step, 0],
          ArrowRight: [-step, 0],
          ArrowUp: [0, step],
          ArrowDown: [0, -step],
        }[e.key];
        if (!d) return;
        e.preventDefault();
        setPan((p) => ({ x: p.x + d[0], y: p.y + d[1] }));
      }}
      onPointerDown={(e) => {
        const target = e.target as HTMLElement;
        if (
          e.button !== 0 ||
          target.closest(".ap-node, button, .ap-minimap, .ap-flow-tools, input, textarea")
        )
          return;
        const start = { x: e.clientX, y: e.clientY, ...pan };
        const el = e.currentTarget;
        el.setPointerCapture(e.pointerId);
        const move = (ev: PointerEvent) =>
          setPan({ x: start.x + ev.clientX - e.clientX, y: start.y + ev.clientY - e.clientY });
        const end = () => {
          if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
          el.removeEventListener("pointermove", move);
          el.removeEventListener("pointerup", end);
          el.removeEventListener("pointercancel", end);
        };
        el.addEventListener("pointermove", move);
        el.addEventListener("pointerup", end);
        el.addEventListener("pointercancel", end);
      }}
    >
      <div className="absolute left-4 top-4 z-10 flex gap-2 text-[10px] text-muted-foreground">
        <span className="rounded-md bg-product-panel px-2 py-1">
          Rascunho · {agent.nodes.length} blocos
        </span>
        <span className="rounded-md bg-product-panel px-2 py-1">Alterações locais</span>
      </div>
      <DndContext
        sensors={sensors}
        onDragEnd={(e) => {
          patch({
            nodes: agent.nodes.map((n) =>
              n.id === e.active.id
                ? {
                    ...n,
                    x: Math.max(10, n.x + e.delta.x / zoom),
                    y: Math.max(10, n.y + e.delta.y / zoom),
                  }
                : n,
            ),
          });
        }}
      >
        <div
          className="ap-canvas-world"
          style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})` }}
        >
          <svg
            width="1200"
            height="650"
            className="pointer-events-none absolute inset-0 overflow-visible"
            aria-hidden="true"
          >
            <defs>
              <marker
                id={`arrow-${layout}`}
                markerWidth="7"
                markerHeight="7"
                refX="6"
                refY="3.5"
                orient="auto"
              >
                <path d="M0 0L7 3.5L0 7" className="fill-primary" />
              </marker>
            </defs>
            {[
              ...EDGES,
              ...agent.nodes.filter((n) => n.from).map((n) => [n.from!, n.id, "Próximo"]),
            ].map(([a, b, label]) => {
              const from = agent.nodes.find((n) => n.id === a),
                to = agent.nodes.find((n) => n.id === b);
              if (!from || !to) return null;
              const x1 = from.x + 222,
                y1 = from.y + 52,
                x2 = to.x - 8,
                y2 = to.y + 52,
                m = (x1 + x2) / 2;
              return (
                <g key={a + b}>
                  <path
                    d={`M${x1} ${y1} C${m} ${y1},${m} ${y2},${x2} ${y2}`}
                    fill="none"
                    className={label === "Bloqueou" ? "stroke-warning" : "stroke-primary"}
                    strokeWidth="1.8"
                    markerEnd={`url(#arrow-${layout})`}
                  />
                  {label && (
                    <g>
                      <rect
                        x={m - 30}
                        y={(y1 + y2) / 2 - 21}
                        width="68"
                        height="20"
                        rx="4"
                        className="fill-product-canvas"
                      />
                      <text
                        x={m + 4}
                        y={(y1 + y2) / 2 - 7}
                        textAnchor="middle"
                        className="fill-muted-foreground text-[11px]"
                      >
                        {label}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
          {agent.nodes.map((node) => (
            <DraggableNode
              key={node.id}
              node={node}
              zoom={zoom}
              selected={selected === node.id}
              onSelect={() => {
                setSelected(node.id);
                if (layout === "tray" || (ref.current?.clientWidth ?? 900) < 500)
                  setInspector(true);
              }}
            />
          ))}
        </div>
      </DndContext>
      <div className="ap-flow-tools">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Afastar"
          title="Afastar"
          onClick={() => setZoom((z) => Math.max(0.2, z - 0.1))}
        >
          <Minus />
        </Button>
        <span className="w-11 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Aproximar"
          title="Aproximar"
          onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}
        >
          <Plus />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Ajustar fluxo à tela"
          title="Ajustar à tela"
          onClick={fit}
        >
          <Maximize />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Editar bloco selecionado"
          title="Configurar bloco"
          onClick={() => setInspector(true)}
        >
          <Settings2 />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Adicionar bloco"
          title="Adicionar agente"
          onClick={() => add("Agente")}
        >
          <Bot />
        </Button>
      </div>
      <svg
        className="ap-minimap"
        viewBox="0 0 1200 650"
        role="img"
        aria-label="Minimapa do fluxo"
        onClick={fit}
      >
        {agent.nodes.map((n) => (
          <rect
            key={n.id}
            x={n.x}
            y={n.y}
            width="218"
            height="106"
            rx="12"
            className={selected === n.id ? "fill-primary" : "fill-product-panel-strong"}
          />
        ))}
        <rect
          x={-pan.x / zoom}
          y={-pan.y / zoom}
          width={(ref.current?.clientWidth ?? 600) / zoom}
          height={(ref.current?.clientHeight ?? 500) / zoom}
          fill="none"
          className="stroke-primary"
          strokeWidth="6"
        />
      </svg>
    </div>
  );
  return (
    <>
      <div className={layout === "studio" ? "ap-flow" : "ap-flow-focus"}>
        {layout === "studio" ? (
          <>
            <Palette />
            {canvas}
            <aside className="ap-inspector">
              <Inspector selected={selected} />
            </aside>
          </>
        ) : (
          <>
            <Palette tray />
            {canvas}
            {layout === "bottom" && (
              <div className="ap-flow-bottom">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Settings2 size={16} />
                  Bloco selecionado
                </div>
                <Input
                  aria-label="Título do bloco selecionado"
                  value={agent.nodes.find((n) => n.id === selected)?.title ?? ""}
                  onChange={(e) =>
                    patch({
                      nodes: agent.nodes.map((n) =>
                        n.id === selected ? { ...n, title: e.target.value } : n,
                      ),
                    })
                  }
                />
                <Button variant="outline" onClick={() => setInspector(true)}>
                  Configurar parâmetros
                </Button>
              </div>
            )}
          </>
        )}
      </div>
      <Dialog open={inspector} onOpenChange={setInspector}>
        <DialogContent>
          <DialogTitle>Editar bloco</DialogTitle>
          <DialogDescription>Configuração local do fluxo demonstrativo.</DialogDescription>
          <Inspector selected={selected} />
        </DialogContent>
      </Dialog>
    </>
  );
}
