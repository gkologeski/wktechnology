import {
  pageSizeMm,
  uid,
  type VisualDesign,
  type VisualElement,
  type VisualPage,
} from "@/lib/proposals/visual-design";

export type SnapGuide = {
  orientation: "vertical" | "horizontal";
  posMm: number;
};

export type EditorMode = "page" | "master";

export function roundMm(v: number): number {
  return Math.round(v * 10) / 10;
}

/** Calcula encaixe magnético com centro/margens da página e bordas dos outros elementos. */
export function computeSnapGuides(
  moving: { x: number; y: number; w: number; h: number },
  others: VisualElement[],
  pageW: number,
  pageH: number,
  thresholdMm = 1.6,
): { x: number; y: number; guides: SnapGuide[] } {
  const guides: SnapGuide[] = [];
  const vTargets: number[] = [0, 16, pageW / 2, pageW - 16, pageW];
  const hTargets: number[] = [0, 16, 24, pageH / 2, pageH - 16, pageH];

  for (const o of others) {
    if (o.hidden) continue;
    vTargets.push(o.x, o.x + o.w / 2, o.x + o.w);
    hTargets.push(o.y, o.y + o.h / 2, o.y + o.h);
  }

  let snappedX = moving.x;
  let bestDx = thresholdMm + 0.01;
  let vGuide: number | null = null;
  const xAnchors = [
    { offset: 0, val: moving.x },
    { offset: moving.w / 2, val: moving.x + moving.w / 2 },
    { offset: moving.w, val: moving.x + moving.w },
  ];
  for (const anchor of xAnchors) {
    for (const target of vTargets) {
      const d = Math.abs(anchor.val - target);
      if (d < bestDx) {
        bestDx = d;
        snappedX = target - anchor.offset;
        vGuide = target;
      }
    }
  }
  if (vGuide !== null) guides.push({ orientation: "vertical", posMm: roundMm(vGuide) });

  let snappedY = moving.y;
  let bestDy = thresholdMm + 0.01;
  let hGuide: number | null = null;
  const yAnchors = [
    { offset: 0, val: moving.y },
    { offset: moving.h / 2, val: moving.y + moving.h / 2 },
    { offset: moving.h, val: moving.y + moving.h },
  ];
  for (const anchor of yAnchors) {
    for (const target of hTargets) {
      const d = Math.abs(anchor.val - target);
      if (d < bestDy) {
        bestDy = d;
        snappedY = target - anchor.offset;
        hGuide = target;
      }
    }
  }
  if (hGuide !== null) guides.push({ orientation: "horizontal", posMm: roundMm(hGuide) });

  return { x: roundMm(snappedX), y: roundMm(snappedY), guides };
}

export function getMasterElements(design: VisualDesign): VisualElement[] {
  return [...design.master.headerElements, ...design.master.footerElements];
}

export function setMasterElements(design: VisualDesign, elements: VisualElement[]): VisualDesign {
  const dims = pageSizeMm(design.orientation);
  const midY = dims.height / 2;
  return {
    ...design,
    master: {
      ...design.master,
      headerElements: elements.filter((e) => e.y < midY),
      footerElements: elements.filter((e) => e.y >= midY),
    },
  };
}

export function getActiveElements(
  design: VisualDesign,
  pageIndex: number,
  mode: EditorMode,
): VisualElement[] {
  if (mode === "master") return getMasterElements(design);
  return design.pages[pageIndex]?.elements ?? [];
}

export function updateActiveElements(
  design: VisualDesign,
  pageIndex: number,
  mode: EditorMode,
  updater: (elements: VisualElement[]) => VisualElement[],
): VisualDesign {
  if (mode === "master") {
    return setMasterElements(design, updater(getMasterElements(design)));
  }
  return {
    ...design,
    pages: design.pages.map((p, i) =>
      i === pageIndex ? { ...p, elements: updater(p.elements) } : p,
    ),
  };
}

export function expandGroupSelection(elements: VisualElement[], ids: string[]): string[] {
  const idSet = new Set(ids);
  const groupIds = new Set<string>();
  for (const el of elements) {
    if (idSet.has(el.id) && el.groupId) groupIds.add(el.groupId);
  }
  if (groupIds.size === 0) return [...idSet];
  for (const el of elements) {
    if (el.groupId && groupIds.has(el.groupId)) idSet.add(el.id);
  }
  return [...idSet];
}

export function cloneElementsWithOffset(
  elements: VisualElement[],
  offsetMm = 6,
  startZ = 1,
): VisualElement[] {
  const groupMap = new Map<string, string>();
  return elements.map((el, i) => {
    let nextGroupId = el.groupId ?? null;
    if (nextGroupId) {
      const existing = groupMap.get(nextGroupId);
      if (existing) {
        nextGroupId = existing;
      } else {
        const fresh = uid("grp");
        groupMap.set(nextGroupId, fresh);
        nextGroupId = fresh;
      }
    }
    return {
      ...structuredClone(el),
      id: uid("el"),
      name: el.name.endsWith(" (cópia)") ? el.name : `${el.name} (cópia)`,
      x: roundMm(el.x + offsetMm),
      y: roundMm(el.y + offsetMm),
      z: startZ + i,
      groupId: nextGroupId,
    };
  });
}

export function reorderLayer(
  elements: VisualElement[],
  selectedIds: string[],
  action: "front" | "back" | "forward" | "backward",
): VisualElement[] {
  if (!selectedIds.length) return elements;
  const set = new Set(selectedIds);
  const sorted = [...elements].sort((a, b) => a.z - b.z);
  let nextOrder: VisualElement[];
  if (action === "front") {
    nextOrder = [...sorted.filter((e) => !set.has(e.id)), ...sorted.filter((e) => set.has(e.id))];
  } else if (action === "back") {
    nextOrder = [...sorted.filter((e) => set.has(e.id)), ...sorted.filter((e) => !set.has(e.id))];
  } else if (action === "forward") {
    nextOrder = [...sorted];
    for (let i = nextOrder.length - 2; i >= 0; i--) {
      const cur = nextOrder[i];
      const above = nextOrder[i + 1];
      if (cur && above && set.has(cur.id) && !set.has(above.id)) {
        nextOrder[i] = above;
        nextOrder[i + 1] = cur;
      }
    }
  } else {
    nextOrder = [...sorted];
    for (let i = 1; i < nextOrder.length; i++) {
      const cur = nextOrder[i];
      const below = nextOrder[i - 1];
      if (cur && below && set.has(cur.id) && !set.has(below.id)) {
        nextOrder[i] = below;
        nextOrder[i - 1] = cur;
      }
    }
  }
  const zById = new Map<string, number>();
  nextOrder.forEach((e, idx) => zById.set(e.id, idx + 1));
  return elements.map((e) => ({ ...e, z: zById.get(e.id) ?? e.z }));
}

export function alignSelectedElements(
  elements: VisualElement[],
  selectedIds: string[],
  alignment: "left" | "centerX" | "right" | "top" | "centerY" | "bottom",
  pageW: number,
  pageH: number,
): VisualElement[] {
  const set = new Set(selectedIds);
  const targets = elements.filter((e) => set.has(e.id) && !e.locked);
  if (!targets.length) return elements;
  const single = targets.length === 1;
  const minX = single ? 16 : Math.min(...targets.map((t) => t.x));
  const maxX = single ? pageW - 16 : Math.max(...targets.map((t) => t.x + t.w));
  const minY = single ? 16 : Math.min(...targets.map((t) => t.y));
  const maxY = single ? pageH - 16 : Math.max(...targets.map((t) => t.y + t.h));
  const midX = single ? pageW / 2 : (minX + maxX) / 2;
  const midY = single ? pageH / 2 : (minY + maxY) / 2;

  return elements.map((el) => {
    if (!set.has(el.id) || el.locked) return el;
    switch (alignment) {
      case "left":
        return { ...el, x: roundMm(minX) };
      case "centerX":
        return { ...el, x: roundMm(midX - el.w / 2) };
      case "right":
        return { ...el, x: roundMm(maxX - el.w) };
      case "top":
        return { ...el, y: roundMm(minY) };
      case "centerY":
        return { ...el, y: roundMm(midY - el.h / 2) };
      case "bottom":
        return { ...el, y: roundMm(maxY - el.h) };
    }
  });
}

export function duplicatePage(page: VisualPage, index: number): VisualPage {
  const copy = structuredClone(page);
  return {
    ...copy,
    id: uid("page"),
    name: `${page.name} (cópia ${index + 1})`,
    elements: copy.elements.map((el) => ({ ...el, id: uid("el") })),
  };
}
