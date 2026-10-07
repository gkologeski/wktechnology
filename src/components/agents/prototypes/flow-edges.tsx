import { getNodeType } from "@/lib/agents/flow/catalog";
import type { GraphEdge } from "@/lib/agents/flow/runtime";
import type { FlowNode } from "./model";
import { INPUT_Y, NODE_W, portY } from "./flow-nodes";

export const WORLD_W = 1720;
export const WORLD_H = 560;
const WARN = new Set([
  "blocked",
  "erro",
  "sem resposta",
  "sem horário",
  "não",
  "recusado",
  "não encontrado",
]);

export function FlowEdges({
  nodes,
  edges,
  layout,
}: {
  nodes: FlowNode[];
  edges: GraphEdge[];
  layout: string;
}) {
  return (
    <svg
      width={WORLD_W}
      height={WORLD_H}
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
      {edges.map((e) => {
        const from = nodes.find((n) => n.id === e.from);
        const to = nodes.find((n) => n.id === e.to);
        if (!from || !to) return null;
        const idx = Math.max(0, getNodeType(from.type)?.outputs(from.config).indexOf(e.port) ?? 0);
        const x1 = from.x + NODE_W + 2;
        const y1 = from.y + portY(idx) + 11;
        const x2 = to.x - 8;
        const y2 = to.y + INPUT_Y;
        const m = (x1 + x2) / 2;
        return (
          <path
            key={e.id}
            d={`M${x1} ${y1} C${m} ${y1},${m} ${y2},${x2} ${y2}`}
            fill="none"
            className={WARN.has(e.port) ? "stroke-warning" : "stroke-primary"}
            strokeWidth="1.8"
            markerEnd={`url(#arrow-${layout})`}
          />
        );
      })}
    </svg>
  );
}
