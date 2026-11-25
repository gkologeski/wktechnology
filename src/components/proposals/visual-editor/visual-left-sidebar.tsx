import { useRef, useState } from "react";
import {
  Braces,
  ImagePlus,
  LayoutTemplate,
  Loader2,
  Palette,
  Shapes,
  Sparkles,
  Type,
  Upload,
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
import { usePermissions } from "@/lib/access-control/use-permissions";
import {
  VISUAL_FONTS,
  VISUAL_ICON_NAMES,
  VISUAL_ICON_PATHS,
  VISUAL_VARIABLES,
  createDefaultElement,
  pageSizeMm,
  type VisualBrandKit,
  type VisualDesign,
  type VisualElement,
  type VisualElementType,
  type VisualIconName,
} from "@/lib/proposals/visual-design";
import { createNexxusStarterDesign } from "@/lib/proposals/nexxus-starter-template";
import { createConsultoriaStarterDesign } from "@/lib/proposals/consultoria-starter-template";

type SidebarTab = "templates" | "elements" | "text" | "variables" | "brand" | "uploads";

export type BrandEntityOption = {
  id: string;
  name: string;
  trade_name: string | null;
  cnpj: string | null;
  logo_url: string | null;
  is_default: boolean;
};

type VisualLeftSidebarProps = {
  design: VisualDesign;
  editable: boolean;
  uploading: boolean;
  brandEntities: BrandEntityOption[];
  workspacePrimaryColor: string | null;
  signedUrls: Record<string, string>;
  uploadedPaths: string[];
  onAddElement: (el: VisualElement) => void;
  onInsertVariable: (token: string, label: string) => void;
  onUpdateBrandKit: (patch: Partial<VisualBrandKit>) => void;
  onApplyStarter: (starter: VisualDesign) => void;
  onUploadImage: (file: File) => Promise<string | null>;
};

const TABS: Array<{ id: SidebarTab; label: string; icon: typeof Shapes }> = [
  { id: "templates", label: "Modelos", icon: LayoutTemplate },
  { id: "elements", label: "Elementos", icon: Shapes },
  { id: "text", label: "Texto", icon: Type },
  { id: "variables", label: "Dados", icon: Braces },
  { id: "brand", label: "Marca", icon: Palette },
  { id: "uploads", label: "Imagens", icon: Upload },
];

export function VisualLeftSidebar({
  design,
  editable: editableProp,
  uploading,
  brandEntities,
  workspacePrimaryColor,
  signedUrls,
  uploadedPaths,
  onAddElement,
  onInsertVariable,
  onUpdateBrandKit,
  onApplyStarter,
  onUploadImage,
}: VisualLeftSidebarProps) {
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
  const [tab, setTab] = useState<SidebarTab>("elements");
  const [varQuery, setVarQuery] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const bk = design.brandKit;
  const dims = pageSizeMm(design.orientation);

  function makeEl(type: VisualElementType): VisualElement {
    return createDefaultElement(type, dims.width, dims.height, 1, bk);
  }

  function addTextPreset(kind: "heading" | "subtitle" | "body" | "kicker" | "callout") {
    if (!editable) return;
    if (kind === "heading") {
      const el = makeEl("heading");
      if (el.type === "heading") {
        onAddElement({
          ...el,
          name: "Título",
          props: { text: "Título da seção" },
          style: { ...el.style, fontSize: 22, fontWeight: "800", textColor: bk.textColor },
        });
      }
      return;
    }
    if (kind === "subtitle") {
      const el = makeEl("heading");
      if (el.type === "heading") {
        onAddElement({
          ...el,
          name: "Subtítulo",
          h: 12,
          props: { text: "Subtítulo explicativo" },
          style: { ...el.style, fontSize: 14, fontWeight: "700", textColor: bk.primaryColor },
        });
      }
      return;
    }
    if (kind === "kicker") {
      const el = makeEl("text");
      if (el.type === "text") {
        onAddElement({
          ...el,
          name: "Etiqueta",
          w: 90,
          h: 7,
          props: { text: "01. SEÇÃO" },
          style: {
            ...el.style,
            fontSize: 8.5,
            fontWeight: "700",
            textColor: bk.primaryColor,
            letterSpacing: 1.2,
            uppercase: true,
          },
        });
      }
      return;
    }
    if (kind === "callout") {
      const el = makeEl("text");
      if (el.type === "text") {
        onAddElement({
          ...el,
          name: "Bloco destaque",
          w: 170,
          h: 26,
          props: {
            text: "**Destaque importante:** personalize este aviso para reforçar diferenciais ou condições comerciais.",
          },
          style: {
            ...el.style,
            fontSize: 10,
            bgColor: bk.lightSurfaceColor,
            borderColor: "#E2E8F0",
            borderWidth: 1,
            borderRadius: 3,
            paddingMm: 4,
          },
        });
      }
      return;
    }
    onAddElement(makeEl("text"));
  }

  function addIcon(icon: VisualIconName) {
    if (!editable) return;
    const el = makeEl("icon");
    if (el.type === "icon") {
      onAddElement({
        ...el,
        name: `Ícone ${icon}`,
        props: { icon, strokeWidth: 2 },
      });
    }
  }

  const varGroups = [...new Set(VISUAL_VARIABLES.map((v) => v.group))];
  const filteredVars = VISUAL_VARIABLES.filter(
    (v) =>
      !varQuery.trim() ||
      v.label.toLowerCase().includes(varQuery.toLowerCase()) ||
      v.key.toLowerCase().includes(varQuery.toLowerCase()),
  );

  return (
    <aside className="flex h-full shrink-0 border-r border-border bg-card">
      <nav
        aria-label="Ferramentas do editor visual"
        className="flex w-16 flex-col items-center gap-1 border-r border-border bg-muted/30 py-2"
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-pressed={active}
              className={`flex w-14 flex-col items-center gap-1 rounded-md px-1 py-2 text-[10px] font-medium transition-colors ${
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="w-56 overflow-y-auto p-3">
        {tab === "templates" && (
          <div className="space-y-3">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Modelos prontos
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Aplique um ponto de partida editorial e personalize cada página.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-background p-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Proposta Editorial (5 págs.)</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Capa executiva, diagnóstico, entregáveis, investimento com tabela dinâmica e
                encerramento — inspirado na proposta Nexxus.
              </p>
              <Button
                type="button"
                size="sm"
                className="mt-2.5 w-full"
                disabled={!editable}
                onClick={() => {
                  onApplyStarter(
                    createNexxusStarterDesign({
                      primaryColor: bk.primaryColor,
                      ...(bk.legalEntityName ? { legalEntityName: bk.legalEntityName } : {}),
                      ...(bk.logoUrl ? { logoUrl: bk.logoUrl } : {}),
                    }),
                  );
                }}
              >
                Aplicar modelo editorial
              </Button>
            </div>

            <div className="rounded-lg border border-border bg-background p-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Consultoria (6 págs.)</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Capa, diagnóstico inicial, metodologia em 4 etapas, entregáveis, cronograma,
                especialistas alocados e investimento com tabela dinâmica.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2.5 w-full"
                disabled={!editable}
                onClick={() => {
                  onApplyStarter(
                    createConsultoriaStarterDesign({
                      primaryColor: bk.primaryColor,
                      ...(bk.legalEntityName ? { legalEntityName: bk.legalEntityName } : {}),
                      ...(bk.logoUrl ? { logoUrl: bk.logoUrl } : {}),
                    }),
                  );
                }}
              >
                Aplicar modelo Consultoria
              </Button>
            </div>

            <div className="rounded-lg border border-border bg-background p-3">
              <div className="text-sm font-semibold">Cartão de investimento escuro</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Insere o bloco escuro de valor total na página atual.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2 w-full"
                disabled={!editable}
                onClick={() => onAddElement(makeEl("price_card"))}
              >
                Inserir cartão escuro
              </Button>
            </div>

            <div className="rounded-lg border border-border bg-background p-3">
              <div className="text-sm font-semibold">Tabela dinâmica de serviços</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Preenche automaticamente os itens da cotação/proposta.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2 w-full"
                disabled={!editable}
                onClick={() => onAddElement(makeEl("table"))}
              >
                Inserir tabela de itens
              </Button>
            </div>
          </div>
        )}

        {tab === "elements" && (
          <div className="space-y-4">
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Blocos e formas
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!editable}
                  onClick={() => onAddElement(makeEl("rect"))}
                >
                  Retângulo
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!editable}
                  onClick={() => {
                    const el = makeEl("rect");
                    if (el.type === "rect") {
                      onAddElement({
                        ...el,
                        name: "Card com filete",
                        w: 84,
                        h: 42,
                        props: { accentStripe: "left", accentColor: bk.primaryColor },
                        style: {
                          ...el.style,
                          bgColor: bk.lightSurfaceColor,
                          borderColor: "#E5E7EB",
                          borderWidth: 1,
                          borderRadius: 3,
                        },
                      });
                    }
                  }}
                >
                  Card lateral
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!editable}
                  onClick={() => onAddElement(makeEl("circle"))}
                >
                  Círculo
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!editable}
                  onClick={() => onAddElement(makeEl("line"))}
                >
                  Linha
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!editable}
                  onClick={() => onAddElement(makeEl("divider"))}
                >
                  Divisor
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!editable}
                  onClick={() => onAddElement(makeEl("table"))}
                >
                  Tabela itens
                </Button>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Cartões comerciais
              </h3>
              <div className="space-y-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full justify-start"
                  disabled={!editable}
                  onClick={() => onAddElement(makeEl("price_card"))}
                >
                  Cartão de valor (escuro)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full justify-start"
                  disabled={!editable}
                  onClick={() => {
                    const el = makeEl("price_card");
                    if (el.type === "price_card") {
                      onAddElement({
                        ...el,
                        name: "Cartão claro",
                        props: {
                          ...el.props,
                          variant: "light",
                          eyebrow: "CONDIÇÕES COMERCIAIS",
                          title: "Parcelamento",
                          price: "{{installments_summary}}",
                          subtitle: "Válida até {{valid_until}}",
                        },
                        style: {
                          ...el.style,
                          bgColor: bk.lightSurfaceColor,
                          textColor: bk.textColor,
                          borderColor: "#E2E8F0",
                          borderWidth: 1,
                          borderRadius: 4,
                          paddingMm: 6,
                        },
                      });
                    }
                  }}
                >
                  Cartão de condições (claro)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full justify-start"
                  disabled={!editable}
                  onClick={() => {
                    const el = makeEl("price_card");
                    if (el.type === "price_card") {
                      onAddElement({
                        ...el,
                        name: "Card por serviço",
                        binding: "items_repeat",
                        w: 84,
                        h: 34,
                        props: {
                          ...el.props,
                          variant: "light",
                          eyebrow: "SERVIÇO",
                          title: "{{item.name}}",
                          price: "{{item.billing}}",
                          subtitle: "",
                        },
                        style: {
                          ...el.style,
                          bgColor: bk.lightSurfaceColor,
                          textColor: bk.textColor,
                          borderColor: "#E2E8F0",
                          borderWidth: 1,
                          borderRadius: 3,
                          paddingMm: 4,
                        },
                      });
                    }
                  }}
                >
                  Card repetível por serviço
                </Button>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Ícones
              </h3>
              <div className="grid grid-cols-6 gap-1.5">
                {VISUAL_ICON_NAMES.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    disabled={!editable}
                    title={`Inserir ícone ${icon}`}
                    aria-label={`Inserir ícone ${icon}`}
                    onClick={() => addIcon(icon)}
                    className="flex h-8 w-8 items-center justify-center rounded border border-border bg-background text-foreground hover:border-primary hover:text-primary disabled:opacity-50"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      {VISUAL_ICON_PATHS[icon].map((d, i) => (
                        <path key={i} d={d} />
                      ))}
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "text" && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tipografia
            </h3>
            <p className="text-xs text-muted-foreground">
              Clique para adicionar à página. Dê duplo clique no texto no canvas para editar.
            </p>
            <button
              type="button"
              disabled={!editable}
              onClick={() => addTextPreset("heading")}
              className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-left text-lg font-extrabold hover:border-primary disabled:opacity-50"
            >
              Adicionar título
            </button>
            <button
              type="button"
              disabled={!editable}
              onClick={() => addTextPreset("subtitle")}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-left text-sm font-bold text-primary hover:border-primary disabled:opacity-50"
            >
              Adicionar subtítulo
            </button>
            <button
              type="button"
              disabled={!editable}
              onClick={() => addTextPreset("kicker")}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:border-primary disabled:opacity-50"
            >
              01. Etiqueta de seção
            </button>
            <button
              type="button"
              disabled={!editable}
              onClick={() => addTextPreset("body")}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-left text-xs text-foreground hover:border-primary disabled:opacity-50"
            >
              Adicionar parágrafo de texto
            </button>
            <button
              type="button"
              disabled={!editable}
              onClick={() => addTextPreset("callout")}
              className="w-full rounded-md border border-border bg-muted/40 px-3 py-2 text-left text-xs hover:border-primary disabled:opacity-50"
            >
              Bloco de destaque
            </button>
          </div>
        )}

        {tab === "variables" && (
          <div className="space-y-3">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Campos dinâmicos
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Clique para inserir no texto selecionado ou criar um novo bloco na página.
              </p>
            </div>
            <Input
              value={varQuery}
              onChange={(e) => setVarQuery(e.target.value)}
              placeholder="Buscar campo..."
              aria-label="Buscar campo dinâmico"
              className="h-8 text-xs"
            />
            {varGroups.map((group) => {
              const items = filteredVars.filter((v) => v.group === group);
              if (!items.length) return null;
              return (
                <div key={group} className="space-y-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group}
                  </div>
                  {items.map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      disabled={!editable}
                      onClick={() => onInsertVariable(v.key, v.label)}
                      className="flex w-full flex-col rounded border border-border bg-background px-2.5 py-1.5 text-left hover:border-primary disabled:opacity-50"
                    >
                      <span className="text-xs font-medium text-foreground">{v.label}</span>
                      <code className="text-[10px] text-muted-foreground">{v.key}</code>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {tab === "brand" && (
          <div className="space-y-3">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Kit da Marca
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Cores, fontes e empresa prestadora padrão aplicadas aos novos elementos.
              </p>
            </div>

            {brandEntities.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs">Empresa prestadora padrão</Label>
                <Select
                  disabled={!editable}
                  value={bk.legalEntityId ?? "__none__"}
                  onValueChange={(val) => {
                    const ent = brandEntities.find((e) => e.id === val);
                    onUpdateBrandKit({
                      legalEntityId: ent?.id ?? null,
                      legalEntityName: ent ? ent.trade_name || ent.name : "",
                      logoUrl: ent?.logo_url ?? bk.logoUrl,
                    });
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Selecionar empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Usar prestadora da proposta</SelectItem>
                    {brandEntities.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.trade_name || e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {workspacePrimaryColor && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full text-xs"
                disabled={!editable}
                onClick={() => onUpdateBrandKit({ primaryColor: workspacePrimaryColor })}
              >
                Usar cor principal do workspace
              </Button>
            )}

            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["primaryColor", "Primária"],
                  ["accentColor", "Destaque"],
                  ["darkSurfaceColor", "Fundo escuro"],
                  ["lightSurfaceColor", "Fundo suave"],
                  ["textColor", "Texto"],
                  ["mutedColor", "Texto suave"],
                ] as const
              ).map(([field, label]) => (
                <label key={field} className="space-y-1">
                  <span className="block text-[11px] text-muted-foreground">{label}</span>
                  <div className="flex items-center gap-1.5 rounded border border-border bg-background px-1.5 py-1">
                    <input
                      type="color"
                      disabled={!editable}
                      value={bk[field]}
                      onChange={(e) => onUpdateBrandKit({ [field]: e.target.value })}
                      className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0"
                    />
                    <span className="font-mono text-[10px] uppercase text-muted-foreground">
                      {bk[field]}
                    </span>
                  </div>
                </label>
              ))}
            </div>

            <div className="space-y-2">
              <div className="space-y-1">
                <Label className="text-xs">Fonte dos títulos</Label>
                <Select
                  disabled={!editable}
                  value={bk.headingFont}
                  onValueChange={(v) =>
                    onUpdateBrandKit({ headingFont: v as VisualBrandKit["headingFont"] })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
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
              <div className="space-y-1">
                <Label className="text-xs">Fonte do corpo</Label>
                <Select
                  disabled={!editable}
                  value={bk.bodyFont}
                  onValueChange={(v) =>
                    onUpdateBrandKit({ bodyFont: v as VisualBrandKit["bodyFont"] })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
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
            </div>
          </div>
        )}

        {tab === "uploads" && (
          <div className="space-y-3">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Imagens privadas
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                PNG, JPG, WebP, GIF ou SVG até 5 MB. Armazenamento exclusivo do workspace.
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                const path = await onUploadImage(file);
                if (path) {
                  const el = makeEl("image");
                  if (el.type === "image") {
                    onAddElement({
                      ...el,
                      name: file.name.slice(0, 40),
                      props: {
                        ...el.props,
                        storagePath: path,
                        alt: file.name,
                        fit: "contain",
                        bindLogo: "none",
                      },
                    });
                  }
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              className="w-full gap-1.5"
              disabled={!editable || uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImagePlus className="h-3.5 w-3.5" />
              )}
              Enviar imagem
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full text-xs"
              disabled={!editable}
              onClick={() => {
                const el = makeEl("image");
                if (el.type === "image") {
                  onAddElement({
                    ...el,
                    name: "Logo da prestadora",
                    w: 44,
                    h: 14,
                    props: {
                      ...el.props,
                      alt: "Logo da empresa prestadora",
                      fit: "contain",
                      bindLogo: "contracting",
                    },
                  });
                }
              }}
            >
              Inserir logo da prestadora
            </Button>

            {uploadedPaths.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Usadas neste modelo
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {uploadedPaths.map((path) => (
                    <button
                      key={path}
                      type="button"
                      disabled={!editable}
                      onClick={() => {
                        const el = makeEl("image");
                        if (el.type === "image") {
                          onAddElement({
                            ...el,
                            name: "Imagem",
                            props: {
                              ...el.props,
                              storagePath: path,
                              alt: "Imagem",
                              fit: "contain",
                              bindLogo: "none",
                            },
                          });
                        }
                      }}
                      className="flex h-16 items-center justify-center overflow-hidden rounded border border-border bg-background p-1 hover:border-primary"
                    >
                      {signedUrls[path] ? (
                        <img
                          src={signedUrls[path]}
                          alt="Imagem enviada"
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <span className="text-[10px] text-muted-foreground">Imagem</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
