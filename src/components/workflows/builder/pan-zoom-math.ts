export type Viewport = { x: number; y: number; zoom: number };

export const MIN_ZOOM = 0.3;
export const MAX_ZOOM = 2;

export function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

/** Zoom mantendo fixo o ponto da tela (px, py) sob o ponteiro. */
export function zoomAround(v: Viewport, nextZoom: number, px: number, py: number): Viewport {
  const zoom = clampZoom(nextZoom);
  const k = zoom / v.zoom;
  return { zoom, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
}
