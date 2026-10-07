import { useState, useRef, useEffect } from "react";
import { DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { toast } from "sonner";
import {
  Plus,
  Minus,
  Maximize,
  Settings2,
  Undo2,
  Redo2,
  Lock,
  LockOpen,
  Download,
  Upload,
  AlertTriangle,
  GitBranch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CATEGORIES, NODE_TYPES, defaultConfig, getNodeType } from "@/lib/agents/flow/catalog";
import { useDemo } from "./state";
import { flowIssues, type Agent, type FlowNode } from "./model";
import { DraggableNode, Inspector, ICONS } from "./flow-nodes";
import { FlowEdges, WORLD_W, WORLD_H } from "./flow-edges";

type Snapshot = Pick<Agent, "nodes" | "edges">;

export function FlowCanvas({ layout = "studio" }: { layout?: "studio" | "tray" | "bottom" }) {
  const { agent, patch: rawPatch } = useDemo();
  const [selected, setSelected] = useState("agent");
  const [zoom, setZoom] = useState(0.5);
  const [pan, setPan] = useState({ x: 18, y: 65 });
  const [inspector, setInspector] = useState(false);
  const [locked, setLocked] = useState(false);
  const [query, setQuery] = useState("");
  const [connecting, setConnecting] = useState<{ from: string; port: string } | null>(null);
  const past = useRef<Snapshot[]>([]);
  const future = useRef<Snapshot[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const issues = flowIssues(agent);
  const errors = issues.filter((i) => i.level === "erro");

  const patch = (change: Partial<Snapshot>) => {
    past.current = [...past.current.slice(-49), { nodes: agent.nodes, edges: agent.edges }];
    future.current = [];
    rawPatch(change);
  };
  const undo = () => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push({ nodes: agent.nodes, edges: agent.edges });
    rawPatch(prev);
  };
  const redo = () => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push({ nodes: agent.nodes, edges: agent.edges });
    rawPatch(next);
  };

  const fitTo = (element: HTMLElement) => {
    const z = Math.max(
      0.2,
      Math.min((element.clientWidth - 60) / WORLD_W, (element.clientHeight - 90) / WORLD_H, 1),
    );
    setZoom(z);
    setPan({ x: 24, y: Math.max(40, (element.clientHeight - WORLD_H * z) / 2) });
  };
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    fitTo(element);
    const observer = new ResizeObserver(() => fitTo(element));
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

  const add = (type: string) => {
    const def = getNodeType(type);
    if (!def) return;
    if (def.unique && agent.nodes.some((n) => n.type === type)) {
      toast.error(`O fluxo já tem um bloco ${def.label}.`);
      return;
    }
    const from = agent.nodes.find((n) => n.id === selected);
    const fromDef = from && getNodeType(from.type);
    const freePort =
      fromDef && !fromDef.visual
        ? fromDef
            .outputs(from.config)
            .find((p) => !agent.edges.some((e) => e.from === from.id && e.port === p))
        : undefined;
    const node: FlowNode = {
      id: crypto.randomUUID(),
      type,
      title: def.label,
      config: defaultConfig(type),
      x: (from?.x ?? 300) + (freePort ? 285 : 40),
      y: (from?.y ?? 300) + (freePort ? 0 : 160),
    };
    patch({
      nodes: [...agent.nodes, node],
      edges:
        freePort && !def.visual && type !== "start"
          ? [
              ...agent.edges,
              { id: crypto.randomUUID(), from: from!.id, to: node.id, port: freePort },
            ]
          : agent.edges,
    });
    setSelected(node.id);
  };
  const remove = (id: string) => {
    patch({
      nodes: agent.nodes.filter((n) => n.id !== id),
      edges: agent.edges.filter((e) => e.from !== id && e.to !== id),
    });
    setSelected("start");
    setInspector(false);
  };
  const duplicate = (id: string) => {
    const src = agent.nodes.find((n) => n.id === id);
    if (!src) return;
    const copy = {
      ...structuredClone(src),
      id: crypto.randomUUID(),
      title: `${src.title} (cópia)`,
      x: src.x + 30,
      y: src.y + 140,
    };
    patch({ nodes: [...agent.nodes, copy] });
    setSelected(copy.id);
  };
  const exportJson = () => {
    const blob = new Blob(
      [JSON.stringify({ version: 1, nodes: agent.nodes, edges: agent.edges }, null, 2)],
      { type: "application/json" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `fluxo-${agent.name.toLowerCase().replace(/\W+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importJson = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as Snapshot;
      if (
        !Array.isArray(data.nodes) ||
        !Array.isArray(data.edges) ||
        data.nodes.some((n) => !getNodeType(n.type))
      )
        throw new Error("formato");
      patch({ nodes: data.nodes, edges: data.edges });
      toast.success("Fluxo importado no rascunho local");
    } catch {
      toast.error("Arquivo de fluxo inválido.");
    }
  };
  const onPort = (from: string, port: string) => {
    if (locked) return;
    setConnecting({ from, port });
    toast.message(`Clique no bloco de destino da saída “${port}”`);
  };
  const onNode = (id: string) => {
    if (connecting) {
      const to = agent.nodes.find((n) => n.id === id);
      if (to && id !== connecting.from && to.type !== "start" && !getNodeType(to.type)?.visual)
        patch({
          edges: [
            ...agent.edges.filter(
              (e) => !(e.from === connecting.from && e.port === connecting.port),
            ),
            { id: crypto.randomUUID(), from: connecting.from, to: id, port: connecting.port },
          ],
        });
      else toast.error("Destino inválido para esta conexão.");
      setConnecting(null);
      return;
    }
    setSelected(id);
    if (layout === "tray" || (ref.current?.clientWidth ?? 900) < 500) setInspector(true);
  };

  const Palette = ({ tray = false }: { tray?: boolean }) => (
    <div className={tray ? "ap-flow-tray" : "ap-palette"}>
      {CATEGORIES.map((cat) => (
        <div key={cat} className={tray ? "flex items-center gap-1" : "mb-4"}>
          {!tray && (
            <h3 className="mb-1.5 px-2 text-[10px] font-semibold uppercase text-muted-foreground">
              {cat}
            </h3>
          )}
          {NODE_TYPES.filter((d) => d.category === cat && d.type !== "start").map((d) => {
            const Icon = ICONS[d.icon] ?? GitBranch;
            return (
              <Button
                key={d.type}
                size="sm"
                variant="ghost"
                disabled={locked}
                className={tray ? "shrink-0" : "mb-0.5 h-7 w-full justify-start font-normal"}
                onClick={() => add(d.type)}
                title={d.description}
              >
                <Icon className="text-muted-foreground" />
                {d.label}
              </Button>
            );
          })}
        </div>
      ))}
    </div>
  );
  const issueCount = (id: string) =>
    issues.filter((i) => i.nodeId === id && i.level === "erro").length;
  const q = query.trim().toLowerCase();

  const canvas = (
    <div
      ref={ref}
      className="ap-canvas cursor-grab touch-none active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-ring"
      aria-label="Canvas de fluxo. Arraste o fundo ou use as setas para mover a visualização"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
          return;
        }
        if (e.key === "Escape") setConnecting(null);
        if (e.target !== e.currentTarget) return;
        const d = {
          ArrowLeft: [40, 0],
          ArrowRight: [-40, 0],
          ArrowUp: [0, 40],
          ArrowDown: [0, -40],
        }[e.key];
        if (!d) return;
        e.preventDefault();
        setPan((p) => ({ x: p.x + d[0]!, y: p.y + d[1]! }));
      }}
      onPointerDown={(e) => {
        const target = e.target as HTMLElement;
        if (
          e.button !== 0 ||
          target.closest(
            ".ap-node, button, .ap-minimap, .ap-flow-tools, .ap-flow-top, input, textarea",
          )
        )
          return;
        const start = { ...pan };
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
      <div className="ap-flow-top absolute left-3 right-3 top-3 z-10 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
        <span className="rounded-md bg-product-panel px-2 py-1">
          Rascunho · {agent.nodes.length} blocos · {agent.edges.length} conexões
        </span>
        <span
          className={`flex items-center gap-1 rounded-md bg-product-panel px-2 py-1 ${errors.length ? "text-destructive" : "text-success"}`}
          title={errors.map((i) => i.message).join("\n")}
        >
          {errors.length > 0 && <AlertTriangle size={12} />}
          {errors.length ? `${errors.length} pendências` : "Fluxo válido"}
        </span>
        {connecting && (
          <span className="rounded-md bg-accent px-2 py-1 text-accent-foreground">
            Conectando “{connecting.port}” · Esc cancela
          </span>
        )}
        <Input
          aria-label="Buscar bloco"
          placeholder="Buscar bloco"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="ml-auto h-7 w-36 text-xs"
        />
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          aria-label="Desfazer"
          title="Desfazer (Ctrl+Z)"
          onClick={undo}
        >
          <Undo2 />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          aria-label="Refazer"
          title="Refazer (Ctrl+Shift+Z)"
          onClick={redo}
        >
          <Redo2 />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          aria-label={locked ? "Desbloquear interação" : "Bloquear interação"}
          aria-pressed={locked}
          onClick={() => setLocked((l) => !l)}
        >
          {locked ? <Lock /> : <LockOpen />}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          aria-label="Exportar JSON"
          title="Exportar JSON"
          onClick={exportJson}
        >
          <Download />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          aria-label="Importar JSON"
          title="Importar JSON"
          onClick={() => fileRef.current?.click()}
        >
          <Upload />
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          aria-hidden="true"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importJson(f);
            e.target.value = "";
          }}
        />
      </div>
      <DndContext
        sensors={sensors}
        onDragEnd={(e) => {
          if (locked) return;
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
          style={{
            width: WORLD_W,
            height: WORLD_H,
            transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
          }}
        >
          <FlowEdges nodes={agent.nodes} edges={agent.edges} layout={layout} />
          {agent.nodes.map((node) => (
            <DraggableNode
              key={node.id}
              node={node}
              zoom={zoom}
              selected={selected === node.id}
              dimmed={
                !!q && !`${node.title} ${getNodeType(node.type)?.label}`.toLowerCase().includes(q)
              }
              issues={issueCount(node.id)}
              connecting={!!connecting}
              onSelect={() => onNode(node.id)}
              onPort={(p) => onPort(node.id, p)}
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
          onClick={() => ref.current && fitTo(ref.current)}
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
      </div>
      <svg
        className="ap-minimap"
        viewBox={`0 0 ${WORLD_W} ${WORLD_H}`}
        role="img"
        aria-label="Minimapa do fluxo"
        onClick={() => ref.current && fitTo(ref.current)}
      >
        {agent.nodes.map((n) => (
          <rect
            key={n.id}
            x={n.x}
            y={n.y}
            width="230"
            height="150"
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
          strokeWidth="8"
        />
      </svg>
    </div>
  );
  const inspectorEl = <Inspector selected={selected} onDelete={remove} onDuplicate={duplicate} />;
  return (
    <>
      <div className={layout === "studio" ? "ap-flow" : "ap-flow-focus"}>
        {layout === "studio" ? (
          <>
            <Palette />
            {canvas}
            <aside className="ap-inspector">{inspectorEl}</aside>
          </>
        ) : (
          <>
            <Palette tray />
            {canvas}
            {layout === "bottom" && (
              <div className="ap-flow-bottom">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Settings2 size={16} />
                  {agent.nodes.find((n) => n.id === selected)?.title ?? "Bloco selecionado"}
                </div>
                <span className="text-xs text-muted-foreground">
                  {getNodeType(agent.nodes.find((n) => n.id === selected)?.type ?? "")?.summary(
                    agent.nodes.find((n) => n.id === selected)?.config ?? {},
                  )}
                </span>
                <Button variant="outline" onClick={() => setInspector(true)}>
                  Configurar parâmetros
                </Button>
              </div>
            )}
          </>
        )}
      </div>
      <Dialog open={inspector} onOpenChange={setInspector}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogTitle>Editar bloco</DialogTitle>
          <DialogDescription>Configuração do rascunho local deste protótipo.</DialogDescription>
          {inspectorEl}
        </DialogContent>
      </Dialog>
    </>
  );
}
