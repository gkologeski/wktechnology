import { useRef } from "react";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowDownToLine,
  ArrowUpToLine,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  Group,
  ImagePlus,
  Lock,
  Plus,
  Trash2,
  Ungroup,
  Unlock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/lib/access-control/use-permissions";
import {
  VISUAL_FONTS,
  VISUAL_ICON_NAMES,
  VISUAL_VARIABLES,
  type VisualDesign,
  type VisualElement,
  type VisualIconName,
  type VisualStyle,
} from "@/lib/proposals/visual-design";
import { getActiveElements, type EditorMode } from "./visual-editor-state";

type VisualInspectorProps = {
  design: VisualDesign;
  pageIndex: number;
  mode: EditorMode;
  editable: boolean;
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  onUpdateElement: (id: string, updater: (el: VisualElement) => VisualElement) => void;
  onUpdatePage: (patch: { name?: string; backgroundColor?: string; useMaster?: boolean }) => void;
  onUpdateOrientation: (orientation: "portrait" | "landscape") => void;
  onUpdateMaster: (patch: { enabled?: boolean; skipFirstPage?: boolean }) => void;
  onLayerAction: (action: "front" | "back" | "forward" | "backward") => void;
  onAlign: (alignment: "left" | "centerX" | "right" | "top" | "centerY" | "bottom") => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
  onToggleGroup: () => void;
  onUploadImage: (file: File) => Promise<string | null>;
};

export function VisualInspector({
  design,
  pageIndex,
  mode,
  editable: editableProp,
  selectedIds,
  onSelect,
  onUpdateElement,
  onUpdatePage,
  onUpdateOrientation,
  onUpdateMaster,
  onLayerAction,
  onAlign,
  onDuplicateSelected,
  onDeleteSelected,
  onToggleGroup,
  onUploadImage,
}: VisualInspectorProps) {
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
  const replaceImageRef = useRef<HTMLInputElement>(null);
  const elements = getActiveElements(design, pageIndex, mode);
  const page = design.pages[pageIndex];
  const selectedElements = elements.filter((e) => selectedIds.includes(e.id));
  const single = selectedElements.length === 1 ? selectedElements[0] : null;
  const hasGroup =
    selectedElements.length > 1 &&
    selectedElements.every((e) => e.groupId && e.groupId === selectedElements[0]?.groupId);

  function patchStyle(el: VisualElement, patch: Partial<VisualStyle>) {
    onUpdateElement(el.id, (cur) => ({ ...cur, style: { ...cur.style, ...patch } }));
  }

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-l border-border bg-card">
      <div className="border-b border-border px-3 py-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {single
            ? single.name
            : selectedElements.length > 1
              ? `${selectedElements.length} elementos selecionados`
              : mode === "master"
                ? "Página mestre"
                : "Página e camadas"}
        </h3>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-3 text-xs">
        {selectedElements.length > 1 && (
          <div className="space-y-3">
            <div>
              <Label className="mb-1.5 block text-[11px] text-muted-foreground">Alinhamento</Label>
              <div className="grid grid-cols-6 gap-1">
                {(
                  [
                    ["left", AlignStartVertical, "Esquerda"],
                    ["centerX", AlignCenterVertical, "Centro horizontal"],
                    ["right", AlignEndVertical, "Direita"],
                    ["top", AlignStartHorizontal, "Topo"],
                    ["centerY", AlignCenterHorizontal, "Meio vertical"],
                    ["bottom", AlignEndHorizontal, "Base"],
                  ] as const
                ).map(([key, Icon, label]) => (
                  <Button
                    key={key}
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-7 w-full"
                    disabled={!editable}
                    title={label}
                    aria-label={label}
                    onClick={() => onAlign(key)}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="flex-1 gap-1"
                disabled={!editable}
                onClick={onToggleGroup}
              >
                {hasGroup ? <Ungroup className="h-3.5 w-3.5" /> : <Group className="h-3.5 w-3.5" />}
                {hasGroup ? "Desagrupar" : "Agrupar"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!editable}
                onClick={onDuplicateSelected}
                title="Duplicar"
                aria-label="Duplicar seleção"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!editable}
                onClick={onDeleteSelected}
                title="Excluir"
                aria-label="Excluir seleção"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {single && (
          <div className="space-y-3.5">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-7 w-7"
                disabled={!editable}
                title={single.locked ? "Destravar" : "Travar"}
                aria-label={single.locked ? "Destravar elemento" : "Travar elemento"}
                onClick={() =>
                  onUpdateElement(single.id, (cur) => ({ ...cur, locked: !cur.locked }))
                }
              >
                {single.locked ? (
                  <Lock className="h-3.5 w-3.5" />
                ) : (
                  <Unlock className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-7 w-7"
                disabled={!editable}
                title="Trazer para frente"
                aria-label="Trazer para frente"
                onClick={() => onLayerAction("front")}
              >
                <ArrowUpToLine className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-7 w-7"
                disabled={!editable}
                title="Avançar camada"
                aria-label="Avançar camada"
                onClick={() => onLayerAction("forward")}
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-7 w-7"
                disabled={!editable}
                title="Recuar camada"
                aria-label="Recuar camada"
                onClick={() => onLayerAction("backward")}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-7 w-7"
                disabled={!editable}
                title="Enviar para trás"
                aria-label="Enviar para trás"
                onClick={() => onLayerAction("back")}
              >
                <ArrowDownToLine className="h-3.5 w-3.5" />
              </Button>
              <div className="flex-1" />
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-7 w-7"
                disabled={!editable}
                title="Duplicar"
                aria-label="Duplicar elemento"
                onClick={onDuplicateSelected}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-7 w-7 text-destructive hover:text-destructive"
                disabled={!editable}
                title="Excluir"
                aria-label="Excluir elemento"
                onClick={onDeleteSelected}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["x", "X (mm)"],
                  ["y", "Y (mm)"],
                  ["w", "Largura"],
                  ["h", "Altura"],
                  ["rotation", "Rotação (°)"],
                ] as const
              ).map(([field, label]) => (
                <label key={field} className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">{label}</span>
                  <Input
                    type="number"
                    step={field === "rotation" ? 1 : 0.5}
                    disabled={!editable || single.locked}
                    value={single[field]}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (!Number.isFinite(n)) return;
                      onUpdateElement(single.id, (cur) => ({
                        ...cur,
                        [field]:
                          field === "w" ? Math.max(4, n) : field === "h" ? Math.max(0.4, n) : n,
                      }));
                    }}
                    className="h-7 text-xs"
                  />
                </label>
              ))}
              <label className="space-y-1">
                <span className="text-[11px] text-muted-foreground">Opacidade</span>
                <Input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  disabled={!editable}
                  value={single.style.opacity ?? 1}
                  onChange={(e) => {
                    const n = Math.min(1, Math.max(0, Number(e.target.value) || 0));
                    patchStyle(single, { opacity: n });
                  }}
                  className="h-7 text-xs"
                />
              </label>
            </div>

            <div>
              <Label className="mb-1 block text-[11px] text-muted-foreground">
                Alinhar na página
              </Label>
              <div className="grid grid-cols-6 gap-1">
                {(
                  [
                    ["left", AlignStartVertical, "Alinhar à esquerda"],
                    ["centerX", AlignCenterVertical, "Centralizar horizontalmente"],
                    ["right", AlignEndVertical, "Alinhar à direita"],
                    ["top", AlignStartHorizontal, "Alinhar ao topo"],
                    ["centerY", AlignCenterHorizontal, "Centralizar verticalmente"],
                    ["bottom", AlignEndHorizontal, "Alinhar à base"],
                  ] as const
                ).map(([key, Icon, label]) => (
                  <Button
                    key={key}
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-7 w-full"
                    disabled={!editable || single.locked}
                    title={label}
                    aria-label={label}
                    onClick={() => onAlign(key)}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </Button>
                ))}
              </div>
            </div>

            {(single.type === "heading" || single.type === "text") && (
              <div className="space-y-2.5 border-t border-border pt-3">
                <label className="block space-y-1">
                  <span className="text-[11px] text-muted-foreground">
                    Texto (use **negrito** ou variáveis)
                  </span>
                  <Textarea
                    rows={4}
                    disabled={!editable}
                    value={single.props.text}
                    onChange={(e) =>
                      onUpdateElement(single.id, (cur) =>
                        cur.type === "heading" || cur.type === "text"
                          ? { ...cur, props: { ...cur.props, text: e.target.value } }
                          : cur,
                      )
                    }
                    className="text-xs"
                  />
                </label>

                <Select
                  disabled={!editable}
                  value="__insert__"
                  onValueChange={(token) => {
                    if (token === "__insert__") return;
                    onUpdateElement(single.id, (cur) =>
                      cur.type === "heading" || cur.type === "text"
                        ? { ...cur, props: { ...cur.props, text: `${cur.props.text}${token}` } }
                        : cur,
                    );
                  }}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="Inserir campo dinâmico..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__insert__">Inserir campo dinâmico...</SelectItem>
                    {VISUAL_VARIABLES.map((v) => (
                      <SelectItem key={v.key} value={v.key}>
                        {v.label} ({v.key})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">Fonte</span>
                    <Select
                      disabled={!editable}
                      value={
                        single.style.fontFamily ??
                        (single.type === "heading"
                          ? design.brandKit.headingFont
                          : design.brandKit.bodyFont)
                      }
                      onValueChange={(v) =>
                        patchStyle(single, { fontFamily: v as VisualStyle["fontFamily"] })
                      }
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VISUAL_FONTS.map((f) => (
                          <SelectItem key={f.value} value={f.value}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <label className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">Tamanho (pt)</span>
                    <Input
                      type="number"
                      min={6}
                      max={120}
                      step={0.5}
                      disabled={!editable}
                      value={single.style.fontSize ?? (single.type === "heading" ? 22 : 11)}
                      onChange={(e) =>
                        patchStyle(single, { fontSize: Number(e.target.value) || 11 })
                      }
                      className="h-7 text-xs"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">Peso</span>
                    <Select
                      disabled={!editable}
                      value={single.style.fontWeight ?? (single.type === "heading" ? "800" : "400")}
                      onValueChange={(v) =>
                        patchStyle(single, { fontWeight: v as VisualStyle["fontWeight"] })
                      }
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="400">Regular</SelectItem>
                        <SelectItem value="500">Médio</SelectItem>
                        <SelectItem value="600">Seminegrito</SelectItem>
                        <SelectItem value="700">Negrito</SelectItem>
                        <SelectItem value="800">Extranegrito</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">Alinhamento</span>
                    <Select
                      disabled={!editable}
                      value={single.style.textAlign ?? "left"}
                      onValueChange={(v) =>
                        patchStyle(single, { textAlign: v as VisualStyle["textAlign"] })
                      }
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">Esquerda</SelectItem>
                        <SelectItem value="center">Centro</SelectItem>
                        <SelectItem value="right">Direita</SelectItem>
                        <SelectItem value="justify">Justificado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">Cor do texto</span>
                    <input
                      type="color"
                      disabled={!editable}
                      value={single.style.textColor ?? design.brandKit.textColor}
                      onChange={(e) => patchStyle(single, { textColor: e.target.value })}
                      className="h-7 w-full cursor-pointer rounded border border-border bg-background p-0.5"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">Fundo</span>
                    <div className="flex gap-1">
                      <input
                        type="color"
                        disabled={!editable}
                        value={single.style.bgColor ?? "#FFFFFF"}
                        onChange={(e) => patchStyle(single, { bgColor: e.target.value })}
                        className="h-7 flex-1 cursor-pointer rounded border border-border bg-background p-0.5"
                      />
                      {single.style.bgColor && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 px-1.5 text-[10px]"
                          disabled={!editable}
                          onClick={() => patchStyle(single, { bgColor: undefined })}
                        >
                          Limpar
                        </Button>
                      )}
                    </div>
                  </label>
                </div>

                <label className="flex items-center gap-2">
                  <Checkbox
                    disabled={!editable}
                    checked={Boolean(single.style.uppercase)}
                    onCheckedChange={(v) => patchStyle(single, { uppercase: Boolean(v) })}
                  />
                  <span>Letras maiúsculas</span>
                </label>
              </div>
            )}

            {(single.type === "rect" ||
              single.type === "circle" ||
              single.type === "line" ||
              single.type === "divider") && (
              <div className="space-y-2.5 border-t border-border pt-3">
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">Cor</span>
                    <input
                      type="color"
                      disabled={!editable}
                      value={single.style.bgColor ?? design.brandKit.primaryColor}
                      onChange={(e) => patchStyle(single, { bgColor: e.target.value })}
                      className="h-7 w-full cursor-pointer rounded border border-border bg-background p-0.5"
                    />
                  </label>
                  {single.type === "rect" && (
                    <label className="space-y-1">
                      <span className="text-[11px] text-muted-foreground">Arredondamento</span>
                      <Input
                        type="number"
                        min={0}
                        max={40}
                        disabled={!editable}
                        value={single.style.borderRadius ?? 0}
                        onChange={(e) =>
                          patchStyle(single, { borderRadius: Number(e.target.value) || 0 })
                        }
                        className="h-7 text-xs"
                      />
                    </label>
                  )}
                </div>
                {single.type === "rect" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="text-[11px] text-muted-foreground">Filete destaque</span>
                      <Select
                        disabled={!editable}
                        value={single.props.accentStripe}
                        onValueChange={(v) =>
                          onUpdateElement(single.id, (cur) =>
                            cur.type === "rect"
                              ? {
                                  ...cur,
                                  props: {
                                    ...cur.props,
                                    accentStripe: v as "none" | "left" | "top",
                                  },
                                }
                              : cur,
                          )
                        }
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          <SelectItem value="left">Esquerda</SelectItem>
                          <SelectItem value="top">Topo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[11px] text-muted-foreground">Sombra</span>
                      <Select
                        disabled={!editable}
                        value={single.style.shadow ?? "none"}
                        onValueChange={(v) =>
                          patchStyle(single, { shadow: v as VisualStyle["shadow"] })
                        }
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sem sombra</SelectItem>
                          <SelectItem value="sm">Suave</SelectItem>
                          <SelectItem value="md">Média</SelectItem>
                          <SelectItem value="lg">Forte</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            )}

            {single.type === "icon" && (
              <div className="space-y-2.5 border-t border-border pt-3">
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Ícone</span>
                  <Select
                    disabled={!editable}
                    value={single.props.icon}
                    onValueChange={(v) =>
                      onUpdateElement(single.id, (cur) =>
                        cur.type === "icon"
                          ? { ...cur, props: { ...cur.props, icon: v as VisualIconName } }
                          : cur,
                      )
                    }
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VISUAL_ICON_NAMES.map((ic) => (
                        <SelectItem key={ic} value={ic}>
                          {ic}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <label className="block space-y-1">
                  <span className="text-[11px] text-muted-foreground">Cor do ícone</span>
                  <input
                    type="color"
                    disabled={!editable}
                    value={single.style.textColor ?? design.brandKit.primaryColor}
                    onChange={(e) => patchStyle(single, { textColor: e.target.value })}
                    className="h-7 w-full cursor-pointer rounded border border-border bg-background p-0.5"
                  />
                </label>
              </div>
            )}

            {single.type === "image" && (
              <div className="space-y-2.5 border-t border-border pt-3">
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Origem dinâmica</span>
                  <Select
                    disabled={!editable}
                    value={single.props.bindLogo}
                    onValueChange={(v) =>
                      onUpdateElement(single.id, (cur) =>
                        cur.type === "image"
                          ? {
                              ...cur,
                              props: {
                                ...cur.props,
                                bindLogo: v as "none" | "contracting" | "workspace",
                              },
                            }
                          : cur,
                      )
                    }
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Imagem enviada</SelectItem>
                      <SelectItem value="contracting">Logo da prestadora (WK)</SelectItem>
                      <SelectItem value="workspace">Logo do workspace</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <input
                  ref={replaceImageRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    const path = await onUploadImage(file);
                    if (path) {
                      onUpdateElement(single.id, (cur) =>
                        cur.type === "image"
                          ? {
                              ...cur,
                              props: {
                                ...cur.props,
                                storagePath: path,
                                bindLogo: "none",
                                alt: file.name,
                              },
                            }
                          : cur,
                      );
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full gap-1.5"
                  disabled={!editable}
                  onClick={() => replaceImageRef.current?.click()}
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                  Trocar imagem
                </Button>
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Ajuste</span>
                  <Select
                    disabled={!editable}
                    value={single.props.fit}
                    onValueChange={(v) =>
                      onUpdateElement(single.id, (cur) =>
                        cur.type === "image"
                          ? { ...cur, props: { ...cur.props, fit: v as "contain" | "cover" } }
                          : cur,
                      )
                    }
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contain">Conter inteira</SelectItem>
                      <SelectItem value="cover">Preencher quadro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {single.type === "table" && (
              <div className="space-y-2.5 border-t border-border pt-3">
                <label className="flex items-start gap-2">
                  <Checkbox
                    disabled={!editable}
                    checked={single.binding === "items"}
                    onCheckedChange={(v) =>
                      onUpdateElement(single.id, (cur) => ({
                        ...cur,
                        binding: v ? "items" : null,
                      }))
                    }
                  />
                  <span>Preencher automaticamente com os itens da proposta</span>
                </label>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">Colunas</span>
                  </div>
                  {single.props.headers.map((h, idx) => (
                    <Input
                      key={idx}
                      disabled={!editable}
                      value={h}
                      onChange={(e) =>
                        onUpdateElement(single.id, (cur) => {
                          if (cur.type !== "table") return cur;
                          const headers = [...cur.props.headers];
                          headers[idx] = e.target.value;
                          return { ...cur, props: { ...cur.props, headers } };
                        })
                      }
                      className="h-7 text-xs"
                    />
                  ))}
                </div>
                {single.binding !== "items" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full gap-1"
                    disabled={!editable}
                    onClick={() =>
                      onUpdateElement(single.id, (cur) =>
                        cur.type === "table"
                          ? {
                              ...cur,
                              props: {
                                ...cur.props,
                                rows: [...cur.props.rows, cur.props.headers.map(() => "Novo item")],
                              },
                            }
                          : cur,
                      )
                    }
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar linha
                  </Button>
                )}
              </div>
            )}

            {single.type === "price_card" && (
              <div className="space-y-2.5 border-t border-border pt-3">
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Estilo do cartão</span>
                  <Select
                    disabled={!editable}
                    value={single.props.variant}
                    onValueChange={(v) =>
                      onUpdateElement(single.id, (cur) =>
                        cur.type === "price_card"
                          ? {
                              ...cur,
                              props: {
                                ...cur.props,
                                variant: v as "dark" | "light" | "accent",
                              },
                              style: {
                                ...cur.style,
                                bgColor:
                                  v === "dark"
                                    ? design.brandKit.darkSurfaceColor
                                    : v === "accent"
                                      ? design.brandKit.primaryColor
                                      : design.brandKit.lightSurfaceColor,
                                textColor: v === "light" ? design.brandKit.textColor : "#FFFFFF",
                              },
                            }
                          : cur,
                      )
                    }
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dark">Escuro</SelectItem>
                      <SelectItem value="light">Claro</SelectItem>
                      <SelectItem value="accent">Cor principal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-start gap-2">
                  <Checkbox
                    disabled={!editable}
                    checked={single.binding === "items_repeat"}
                    onCheckedChange={(v) =>
                      onUpdateElement(single.id, (cur) => ({
                        ...cur,
                        binding: v ? "items_repeat" : null,
                      }))
                    }
                  />
                  <span>Repetir automaticamente para cada serviço</span>
                </label>
                {(
                  [
                    ["eyebrow", "Rótulo superior"],
                    ["title", "Título"],
                    ["price", "Valor / variável"],
                    ["subtitle", "Legenda"],
                  ] as const
                ).map(([field, label]) => (
                  <label key={field} className="block space-y-1">
                    <span className="text-[11px] text-muted-foreground">{label}</span>
                    <Input
                      disabled={!editable}
                      value={single.props[field]}
                      onChange={(e) =>
                        onUpdateElement(single.id, (cur) =>
                          cur.type === "price_card"
                            ? { ...cur, props: { ...cur.props, [field]: e.target.value } }
                            : cur,
                        )
                      }
                      className="h-7 text-xs"
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {!selectedElements.length && (
          <div className="space-y-4">
            {mode === "page" && page && (
              <div className="space-y-2.5">
                <label className="block space-y-1">
                  <span className="text-[11px] text-muted-foreground">Nome da página</span>
                  <Input
                    disabled={!editable}
                    value={page.name}
                    onChange={(e) => onUpdatePage({ name: e.target.value })}
                    className="h-7 text-xs"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">Fundo da página</span>
                    <input
                      type="color"
                      disabled={!editable}
                      value={page.backgroundColor}
                      onChange={(e) => onUpdatePage({ backgroundColor: e.target.value })}
                      className="h-7 w-full cursor-pointer rounded border border-border bg-background p-0.5"
                    />
                  </label>
                  <div className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">Orientação A4</span>
                    <Select
                      disabled={!editable}
                      value={design.orientation}
                      onValueChange={(v) => onUpdateOrientation(v as "portrait" | "landscape")}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="portrait">Retrato</SelectItem>
                        <SelectItem value="landscape">Paisagem</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <label className="flex items-center gap-2">
                  <Checkbox
                    disabled={!editable}
                    checked={page.useMaster}
                    onCheckedChange={(v) => onUpdatePage({ useMaster: Boolean(v) })}
                  />
                  <span>Mostrar cabeçalho e rodapé mestre</span>
                </label>
              </div>
            )}

            <div className="space-y-2 border-t border-border pt-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Cabeçalho e rodapé (Mestre)
              </div>
              <label className="flex items-center gap-2">
                <Checkbox
                  disabled={!editable}
                  checked={design.master.enabled}
                  onCheckedChange={(v) => onUpdateMaster({ enabled: Boolean(v) })}
                />
                <span>Ativar página mestre</span>
              </label>
              <label className="flex items-center gap-2">
                <Checkbox
                  disabled={!editable || !design.master.enabled}
                  checked={design.master.skipFirstPage}
                  onCheckedChange={(v) => onUpdateMaster({ skipFirstPage: Boolean(v) })}
                />
                <span>Ocultar na capa (página 1)</span>
              </label>
            </div>

            <div className="space-y-1.5 border-t border-border pt-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Camadas ({elements.length})
              </div>
              {elements.length === 0 ? (
                <p className="text-muted-foreground">
                  Nenhum elemento nesta página. Adicione blocos pelo painel esquerdo.
                </p>
              ) : (
                <div className="space-y-1">
                  {[...elements]
                    .sort((a, b) => b.z - a.z)
                    .map((el) => (
                      <div
                        key={el.id}
                        className="flex items-center gap-1 rounded border border-border bg-background px-2 py-1 hover:border-primary/60"
                      >
                        <button
                          type="button"
                          onClick={() => onSelect([el.id])}
                          className="min-w-0 flex-1 truncate text-left text-xs font-medium"
                        >
                          {el.name}
                        </button>
                        <button
                          type="button"
                          disabled={!editable}
                          aria-label={el.hidden ? "Mostrar camada" : "Ocultar camada"}
                          onClick={() =>
                            onUpdateElement(el.id, (cur) => ({ ...cur, hidden: !cur.hidden }))
                          }
                          className="p-0.5 text-muted-foreground hover:text-foreground"
                        >
                          {el.hidden ? (
                            <EyeOff className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          disabled={!editable}
                          aria-label={el.locked ? "Destravar camada" : "Travar camada"}
                          onClick={() =>
                            onUpdateElement(el.id, (cur) => ({ ...cur, locked: !cur.locked }))
                          }
                          className="p-0.5 text-muted-foreground hover:text-foreground"
                        >
                          {el.locked ? (
                            <Lock className="h-3.5 w-3.5" />
                          ) : (
                            <Unlock className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
