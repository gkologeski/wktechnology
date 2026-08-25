// Persistência local da preferência de layout (grupos + ordem) dos campos
// no ExtraFieldsEditor. É preferência puramente visual do usuário — não
// interfere no payload da ação nem em regras de negócio.

export interface FieldGroup {
  id: string;
  label: string;
  fieldNames: string[];
  collapsed?: boolean;
}

export interface FieldLayout {
  version: 1;
  groups: FieldGroup[];
}

const KEY_PREFIX = "wf-extra-fields-layout:";
const VERSION = 1 as const;

export function loadFieldLayout(entity: string): FieldLayout {
  if (typeof window === "undefined") return { version: VERSION, groups: [] };
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + entity);
    if (!raw) return { version: VERSION, groups: [] };
    const parsed = JSON.parse(raw) as Partial<FieldLayout>;
    if (!parsed || parsed.version !== VERSION || !Array.isArray(parsed.groups)) {
      return { version: VERSION, groups: [] };
    }
    // Sanitiza estrutura
    const groups: FieldGroup[] = parsed.groups
      .filter(
        (g): g is FieldGroup => !!g && typeof g.id === "string" && typeof g.label === "string",
      )
      .map((g) => ({
        id: g.id,
        label: g.label,
        fieldNames: Array.isArray(g.fieldNames)
          ? g.fieldNames.filter((s) => typeof s === "string")
          : [],
        collapsed: Boolean(g.collapsed),
      }));
    return { version: VERSION, groups };
  } catch {
    return { version: VERSION, groups: [] };
  }
}

export function saveFieldLayout(entity: string, layout: FieldLayout): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY_PREFIX + entity, JSON.stringify(layout));
  } catch {
    // ignore quota
  }
}

export function clearFieldLayout(entity: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY_PREFIX + entity);
  } catch {
    // ignore
  }
}

export function newGroupId(): string {
  return `g_${Math.random().toString(36).slice(2, 9)}`;
}

/** Remove um campo de qualquer grupo em que esteja. */
export function removeFieldFromGroups(layout: FieldLayout, fieldName: string): FieldLayout {
  return {
    ...layout,
    groups: layout.groups.map((g) => ({
      ...g,
      fieldNames: g.fieldNames.filter((n) => n !== fieldName),
    })),
  };
}

/** Insere um campo em um grupo, em uma posição específica (default: fim). */
export function insertFieldInGroup(
  layout: FieldLayout,
  fieldName: string,
  groupId: string,
  index?: number,
): FieldLayout {
  const cleaned = removeFieldFromGroups(layout, fieldName);
  return {
    ...cleaned,
    groups: cleaned.groups.map((g) => {
      if (g.id !== groupId) return g;
      const next = [...g.fieldNames];
      const at =
        typeof index === "number" && index >= 0 && index <= next.length ? index : next.length;
      next.splice(at, 0, fieldName);
      return { ...g, fieldNames: next };
    }),
  };
}

export function reorderGroups(
  layout: FieldLayout,
  fromIndex: number,
  toIndex: number,
): FieldLayout {
  if (fromIndex === toIndex) return layout;
  const next = [...layout.groups];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) return layout;
  const at = Math.max(0, Math.min(next.length, toIndex));
  next.splice(at, 0, moved);
  return { ...layout, groups: next };
}
