import { useCallback, useEffect, useRef, useState } from "react";
import { Lock, RotateCw } from "lucide-react";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { pageSizeMm, type VisualDesign, type VisualElement } from "@/lib/proposals/visual-design";
import {
  computeSnapGuides,
  expandGroupSelection,
  getActiveElements,
  getMasterElements,
  roundMm,
  type EditorMode,
  type SnapGuide,
} from "./visual-editor-state";
import { VisualElementView } from "./visual-element-view";

const BASE_PX_PER_MM = 3.2; // 210mm ≈ 672px a 100%

type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

type DragAction =
  | {
      kind: "move";
      startClientX: number;
      startClientY: number;
      initial: Map<string, { x: number; y: number; w: number; h: number }>;
      primaryId: string;
    }
  | {
      kind: "resize";
      handle: Handle;
      id: string;
      startClientX: number;
      startClientY: number;
      startBox: { x: number; y: number; w: number; h: number };
    }
  | {
      kind: "rotate";
      id: string;
      centerX: number;
      centerY: number;
      startAngle: number;
      initialRotation: number;
    };

type VisualCanvasProps = {
  design: VisualDesign;
  pageIndex: number;
  mode: EditorMode;
  zoom: number;
  showRuler: boolean;
  editable: boolean;
  selectedIds: string[];
  signedUrls: Record<string, string>;
  onSelect: (ids: string[]) => void;
  onLiveElementsChange: (elements: VisualElement[]) => void;
  onCommitElementsChange: (elements: VisualElement[]) => void;
};

const HANDLES: Array<{ key: Handle; className: string; cursor: string }> = [
  { key: "nw", className: "-left-1.5 -top-1.5", cursor: "nwse-resize" },
  { key: "n", className: "left-1/2 -top-1.5 -translate-x-1/2", cursor: "ns-resize" },
  { key: "ne", className: "-right-1.5 -top-1.5", cursor: "nesw-resize" },
  { key: "e", className: "-right-1.5 top-1/2 -translate-y-1/2", cursor: "ew-resize" },
  { key: "se", className: "-bottom-1.5 -right-1.5", cursor: "nwse-resize" },
  { key: "s", className: "-bottom-1.5 left-1/2 -translate-x-1/2", cursor: "ns-resize" },
  { key: "sw", className: "-bottom-1.5 -left-1.5", cursor: "nesw-resize" },
  { key: "w", className: "-left-1.5 top-1/2 -translate-y-1/2", cursor: "ew-resize" },
];

export function VisualCanvas({
  design,
  pageIndex,
  mode,
  zoom,
  showRuler,
  editable: editableProp,
  selectedIds,
  signedUrls,
  onSelect,
  onLiveElementsChange,
  onCommitElementsChange,
}: VisualCanvasProps) {
  const { can } = usePermissions();
  const editable =
    editableProp &&
    ["own", "team", "workspace"].some(
      (s) =>
        can(`techsales.proposal_templates.create.${s}`) ||
        can(`techsales.proposal_templates.update.${s}`) ||
        can(`techsales.proposals.create.${s}`) ||
        can(`techsales.proposals.update.${s}`),
    );
  const dims = pageSizeMm(design.orientation);
  const pxPerMm = BASE_PX_PER_MM * zoom;
  const pageWpx = dims.width * pxPerMm;
  const pageHpx = dims.height * pxPerMm;
  const page = design.pages[pageIndex];
  const activeElements = getActiveElements(design, pageIndex, mode);
  const masterElements = getMasterElements(design);
  const showMasterOverlay =
    mode === "page" &&
    design.master.enabled &&
    !!page?.useMaster &&
    !(design.master.skipFirstPage && pageIndex === 0);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [guides, setGuides] = useState<SnapGuide[]>([]);
  const [angleBadge, setAngleBadge] = useState<number | null>(null);
  const dragRef = useRef<DragAction | null>(null);
  const latestElementsRef = useRef<VisualElement[]>(activeElements);
  const movedRef = useRef(false);
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    latestElementsRef.current = activeElements;
  }, [activeElements]);

  useEffect(() => {
    setEditingId(null);
  }, [pageIndex, mode]);

  const finishDrag = useCallback(() => {
    if (dragRef.current && movedRef.current) {
      onCommitElementsChange(latestElementsRef.current);
    }
    dragRef.current = null;
    movedRef.current = false;
    setGuides([]);
    setAngleBadge(null);
  }, [onCommitElementsChange]);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      e.preventDefault();
      const cur = latestElementsRef.current;

      if (drag.kind === "move") {
        const dxMm = (e.clientX - drag.startClientX) / pxPerMm;
        const dyMm = (e.clientY - drag.startClientY) / pxPerMm;
        if (Math.abs(dxMm) > 0.2 || Math.abs(dyMm) > 0.2) movedRef.current = true;
        const primaryInit = drag.initial.get(drag.primaryId);
        if (!primaryInit) return;
        const others = cur.filter((el) => !drag.initial.has(el.id));
        const snap = computeSnapGuides(
          {
            x: primaryInit.x + dxMm,
            y: primaryInit.y + dyMm,
            w: primaryInit.w,
            h: primaryInit.h,
          },
          others,
          dims.width,
          dims.height,
        );
        const appliedDx = snap.x - primaryInit.x;
        const appliedDy = snap.y - primaryInit.y;
        setGuides(snap.guides);
        const next = cur.map((el) => {
          const init = drag.initial.get(el.id);
          if (!init || el.locked) return el;
          return { ...el, x: roundMm(init.x + appliedDx), y: roundMm(init.y + appliedDy) };
        });
        latestElementsRef.current = next;
        onLiveElementsChange(next);
        return;
      }

      if (drag.kind === "resize") {
        const dxMm = (e.clientX - drag.startClientX) / pxPerMm;
        const dyMm = (e.clientY - drag.startClientY) / pxPerMm;
        movedRef.current = true;
        let { x, y, w, h } = drag.startBox;
        const minW = 4;
        const minH = 0.5;
        if (drag.handle.includes("e")) w = Math.max(minW, drag.startBox.w + dxMm);
        if (drag.handle.includes("s")) h = Math.max(minH, drag.startBox.h + dyMm);
        if (drag.handle.includes("w")) {
          const nextW = Math.max(minW, drag.startBox.w - dxMm);
          x = drag.startBox.x + (drag.startBox.w - nextW);
          w = nextW;
        }
        if (drag.handle.includes("n")) {
          const nextH = Math.max(minH, drag.startBox.h - dyMm);
          y = drag.startBox.y + (drag.startBox.h - nextH);
          h = nextH;
        }
        if (e.shiftKey && drag.startBox.h > 0 && drag.handle.length === 2) {
          const ratio = drag.startBox.w / drag.startBox.h;
          h = Math.max(minH, w / ratio);
        }
        const next = cur.map((el) =>
          el.id === drag.id
            ? { ...el, x: roundMm(x), y: roundMm(y), w: roundMm(w), h: roundMm(h) }
            : el,
        );
        latestElementsRef.current = next;
        onLiveElementsChange(next);
        return;
      }

      if (drag.kind === "rotate") {
        movedRef.current = true;
        const angle = Math.atan2(e.clientY - drag.centerY, e.clientX - drag.centerX);
        let deg = Math.round(drag.initialRotation + ((angle - drag.startAngle) * 180) / Math.PI);
        if (e.shiftKey) deg = Math.round(deg / 15) * 15;
        while (deg > 180) deg -= 360;
        while (deg < -180) deg += 360;
        setAngleBadge(deg);
        const next = cur.map((el) => (el.id === drag.id ? { ...el, rotation: deg } : el));
        latestElementsRef.current = next;
        onLiveElementsChange(next);
      }
    },
    [dims.height, dims.width, onLiveElementsChange, pxPerMm],
  );

  function startMove(e: React.PointerEvent, el: VisualElement) {
    if (!editable || editingId === el.id) return;
    e.stopPropagation();
    let nextSel: string[];
    if (e.shiftKey) {
      const set = new Set(selectedIds);
      if (set.has(el.id)) set.delete(el.id);
      else set.add(el.id);
      nextSel = expandGroupSelection(activeElements, [...set]);
    } else if (selectedIds.includes(el.id)) {
      nextSel = expandGroupSelection(activeElements, selectedIds);
    } else {
      nextSel = expandGroupSelection(activeElements, [el.id]);
    }
    onSelect(nextSel);
    if (el.locked) return;
    const initial = new Map<string, { x: number; y: number; w: number; h: number }>();
    for (const item of activeElements) {
      if (nextSel.includes(item.id) && !item.locked) {
        initial.set(item.id, { x: item.x, y: item.y, w: item.w, h: item.h });
      }
    }
    if (!initial.size) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    movedRef.current = false;
    dragRef.current = {
      kind: "move",
      startClientX: e.clientX,
      startClientY: e.clientY,
      initial,
      primaryId: el.id,
    };
  }

  function startResize(e: React.PointerEvent, el: VisualElement, handle: Handle) {
    if (!editable || el.locked) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    movedRef.current = false;
    dragRef.current = {
      kind: "resize",
      handle,
      id: el.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startBox: { x: el.x, y: el.y, w: el.w, h: el.h },
    };
  }

  function startRotate(e: React.PointerEvent, el: VisualElement) {
    if (!editable || el.locked || !pageRef.current) return;
    e.stopPropagation();
    const rect = pageRef.current.getBoundingClientRect();
    const centerX = rect.left + (el.x + el.w / 2) * pxPerMm;
    const centerY = rect.top + (el.y + el.h / 2) * pxPerMm;
    const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    movedRef.current = false;
    dragRef.current = {
      kind: "rotate",
      id: el.id,
      centerX,
      centerY,
      startAngle,
      initialRotation: el.rotation ?? 0,
    };
  }

  const hTicks = Array.from({ length: Math.floor(dims.width / 10) + 1 }, (_, i) => i * 10);
  const vTicks = Array.from({ length: Math.floor(dims.height / 10) + 1 }, (_, i) => i * 10);
  const sortedActive = [...activeElements].sort((a, b) => a.z - b.z);
  const sortedMaster = [...masterElements].sort((a, b) => a.z - b.z);

  return (
    <div
      className="relative flex-1 overflow-auto bg-muted/60 p-6"
      onPointerDown={() => {
        setEditingId(null);
        onSelect([]);
      }}
    >
      <div className="mx-auto w-fit">
        {showRuler && (
          <div className="mb-1 ml-6 flex" style={{ width: `${pageWpx}px` }} aria-hidden="true">
            <div className="relative h-5 w-full border-b border-border bg-background/80 text-[9px] text-muted-foreground">
              {hTicks.map((mm) => (
                <span
                  key={mm}
                  className="absolute top-0 border-l border-border/70 pl-0.5 leading-tight"
                  style={{ left: `${mm * pxPerMm}px` }}
                >
                  {mm % 20 === 0 ? mm : ""}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex">
          {showRuler && (
            <div
              className="relative mr-1 w-5 shrink-0 border-r border-border bg-background/80 text-[9px] text-muted-foreground"
              style={{ height: `${pageHpx}px` }}
              aria-hidden="true"
            >
              {vTicks.map((mm) => (
                <span
                  key={mm}
                  className="absolute left-0 border-t border-border/70 pl-0.5 leading-none"
                  style={{ top: `${mm * pxPerMm}px` }}
                >
                  {mm % 20 === 0 ? mm : ""}
                </span>
              ))}
            </div>
          )}

          <div
            ref={pageRef}
            data-testid="visual-canvas-page"
            className="relative select-none border border-border shadow-md"
            style={{
              width: `${pageWpx}px`,
              height: `${pageHpx}px`,
              backgroundColor: mode === "master" ? "#FFFFFF" : (page?.backgroundColor ?? "#FFFFFF"),
            }}
            onPointerMove={handlePointerMove}
            onPointerUp={finishDrag}
            onPointerCancel={finishDrag}
          >
            {mode === "master" && (
              <>
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 border-b border-dashed border-primary/50 bg-primary/5"
                  style={{ height: `${design.master.headerHeightMm * pxPerMm}px` }}
                />
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-dashed border-primary/50 bg-primary/5"
                  style={{ height: `${design.master.footerHeightMm * pxPerMm}px` }}
                />
              </>
            )}

            {showMasterOverlay &&
              sortedMaster.map((el) =>
                el.hidden ? null : (
                  <div
                    key={`m-${el.id}`}
                    className="pointer-events-none absolute opacity-85"
                    style={{
                      left: `${el.x * pxPerMm}px`,
                      top: `${el.y * pxPerMm}px`,
                      width: `${el.w * pxPerMm}px`,
                      height: `${el.h * pxPerMm}px`,
                      transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                      zIndex: el.z,
                    }}
                  >
                    <VisualElementView
                      element={el}
                      brandKit={design.brandKit}
                      pxPerMm={pxPerMm}
                      signedUrls={signedUrls}
                      editing={false}
                    />
                  </div>
                ),
              )}

            {sortedActive.map((el) => {
              if (el.hidden) return null;
              const isSelected = selectedIds.includes(el.id);
              const isSingleSelected = isSelected && selectedIds.length === 1;
              const isEditing = editingId === el.id;
              return (
                <div
                  key={el.id}
                  data-element-id={el.id}
                  data-element-type={el.type}
                  onPointerDown={(e) => startMove(e, el)}
                  onDoubleClick={(e) => {
                    if (!editable || el.locked) return;
                    if (el.type === "heading" || el.type === "text") {
                      e.stopPropagation();
                      setEditingId(el.id);
                    }
                  }}
                  className={`absolute ${editable && !el.locked ? "cursor-move" : "cursor-default"} ${
                    isSelected
                      ? "ring-2 ring-primary ring-offset-0"
                      : "hover:ring-1 hover:ring-primary/50"
                  }`}
                  style={{
                    left: `${el.x * pxPerMm}px`,
                    top: `${el.y * pxPerMm}px`,
                    width: `${el.w * pxPerMm}px`,
                    height: `${Math.max(el.h * pxPerMm, 4)}px`,
                    transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                    zIndex: el.z + 10,
                  }}
                >
                  <VisualElementView
                    element={el}
                    brandKit={design.brandKit}
                    pxPerMm={pxPerMm}
                    signedUrls={signedUrls}
                    editing={isEditing}
                    onCommitText={(nextText) => {
                      const next = activeElements.map((item) =>
                        item.id === el.id && (item.type === "heading" || item.type === "text")
                          ? { ...item, props: { ...item.props, text: nextText } }
                          : item,
                      );
                      onCommitElementsChange(next);
                    }}
                    onEndEdit={() => setEditingId(null)}
                  />

                  {isSelected && el.binding && (
                    <span className="pointer-events-none absolute -top-5 left-0 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground shadow-sm">
                      {el.binding === "items"
                        ? "Dinâmico: Itens"
                        : el.binding === "items_repeat"
                          ? "Repetir por item"
                          : el.binding}
                    </span>
                  )}

                  {isSelected && el.locked && (
                    <span
                      className="pointer-events-none absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-muted text-muted-foreground shadow"
                      title="Elemento travado"
                    >
                      <Lock className="h-2.5 w-2.5" />
                    </span>
                  )}

                  {isSingleSelected && editable && !el.locked && !isEditing && (
                    <>
                      {HANDLES.map((h) => (
                        <div
                          key={h.key}
                          role="presentation"
                          onPointerDown={(e) => startResize(e, el, h.key)}
                          style={{ cursor: h.cursor }}
                          className={`absolute h-2.5 w-2.5 rounded-sm border border-primary bg-background shadow-sm ${h.className}`}
                        />
                      ))}
                      <button
                        type="button"
                        aria-label={`Girar ${el.name}`}
                        onPointerDown={(e) => startRotate(e, el)}
                        className="absolute -top-7 left-1/2 flex h-5 w-5 -translate-x-1/2 cursor-grab items-center justify-center rounded-full border border-primary bg-background text-primary shadow-sm active:cursor-grabbing"
                      >
                        <RotateCw className="h-3 w-3" />
                      </button>
                      {angleBadge !== null && (
                        <span className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 rounded bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background">
                          {angleBadge}°
                        </span>
                      )}
                    </>
                  )}
                </div>
              );
            })}

            {guides.map((g, idx) =>
              g.orientation === "vertical" ? (
                <div
                  key={`gv-${idx}`}
                  className="pointer-events-none absolute inset-y-0 z-50 w-px bg-primary"
                  style={{ left: `${g.posMm * pxPerMm}px` }}
                />
              ) : (
                <div
                  key={`gh-${idx}`}
                  className="pointer-events-none absolute inset-x-0 z-50 h-px bg-primary"
                  style={{ top: `${g.posMm * pxPerMm}px` }}
                />
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
