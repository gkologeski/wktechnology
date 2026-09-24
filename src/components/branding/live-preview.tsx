import { useState } from "react";
import { Sun, Moon, Search, Plus, Bell, Inbox } from "lucide-react";
import { readableForeground } from "@/lib/color-utils";
import { defaultThemeColors, type BrandTheme } from "@/lib/branding/tokens";
import { previewTarget, type PreviewMode, type PreviewTarget } from "./preview-targets";

export type PreviewSettings = {
  primary: string;
  accent: string;
  radius: number;
  headingFont: string;
  bodyFont: string;
  density: "compact" | "cozy" | "comfortable";
  logoUrl: string;
  brandName: string;
  theme?: BrandTheme;
};

type Props = {
  settings: PreviewSettings;
  mode?: PreviewMode;
  onModeChange?: (mode: PreviewMode) => void;
  selectedTargetId?: string | null;
  onSelectTarget?: (target: PreviewTarget) => void;
};

export function LivePreview({
  settings,
  mode: controlledMode,
  onModeChange,
  selectedTargetId,
  onSelectTarget,
}: Props) {
  const [internalDark, setInternalDark] = useState(false);
  const dark = controlledMode ? controlledMode === "dark" : internalDark;
  const setDark = (next: boolean) => {
    setInternalDark(next);
    onModeChange?.(next ? "dark" : "light");
  };
  const { radius, headingFont, bodyFont, brandName, logoUrl, theme } = settings;

  const defaults = defaultThemeColors(dark ? "dark" : "light");
  const overrides = (dark ? theme?.dark : theme?.light) ?? {};
  const c = (key: string, fallback?: string) => overrides[key] ?? fallback ?? defaults[key];

  const primary = c("primary", dark ? undefined : settings.primary);
  const accent = c("accent", dark ? undefined : settings.accent);
  const primaryFg = c("primary-foreground") || readableForeground(primary);
  const accentFg = c("accent-foreground") || readableForeground(accent);

  const bg = c("background");
  const surface = c("card");
  const surface2 = c("surface-3");
  const text = c("foreground");
  const muted = c("muted-foreground");
  const border = c("border");
  const sidebar = c("sidebar");
  const sidebarFg = c("sidebar-foreground");

  const iconStroke = theme?.icons?.stroke ?? 2;
  const iconSize = theme?.icons?.size ?? 16;
  const logo = (dark ? theme?.assets?.logo_dark : theme?.assets?.logo_light) || logoUrl;

  const pad =
    settings.density === "compact" ? "p-3" : settings.density === "comfortable" ? "p-6" : "p-4";

  const stages = [
    { label: "Aplicado", color: c("hs-stage-1") },
    { label: "Triagem", color: c("hs-stage-2") },
    { label: "Proposta", color: c("hs-stage-4") },
    { label: "Ganho", color: c("hs-stage-won") },
    { label: "Perdido", color: c("hs-stage-lost") },
  ];
  const statuses = [
    { label: "Sucesso", color: c("success") },
    { label: "Aviso", color: c("warning") },
    { label: "Erro", color: c("destructive") },
    { label: "Info", color: c("dei-accent") },
  ];

  const op = {
    canvas: c("product-canvas"),
    header: c("product-header"),
    toolbar: c("product-toolbar"),
    panel: c("product-panel"),
    muted: c("product-panel-muted"),
    divider: c("product-divider"),
  };

  const selectable = (id: string, related?: string[]) => {
    const target = previewTarget(id, related);
    return {
      role: "button" as const,
      tabIndex: 0,
      "aria-label": `Editar ${target.label}`,
      "aria-pressed": selectedTargetId === id,
      "data-preview-target": id,
      onClick: (event: React.MouseEvent) => {
        event.stopPropagation();
        onSelectTarget?.(target);
      },
      onKeyDown: (event: React.KeyboardEvent) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        onSelectTarget?.(target);
      },
      className:
        "preview-editable focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action-accent " +
        (selectedTargetId === id ? "preview-editable-selected" : ""),
    };
  };

  const operationalScene = (
    <section
      {...selectable("product-canvas")}
      className={`${selectable("product-canvas").className} rounded-md border overflow-hidden text-[11px]`}
      style={{ background: op.canvas, borderColor: op.divider }}
    >
      <div {...selectable("product-header", ["heading_font", "product-divider"])} className={`${selectable("product-header").className} px-3 py-2 border-b font-bold`} style={{ background: op.header, borderColor: op.divider, fontFamily: headingFont }}>
        Negócios
      </div>
      <div {...selectable("product-toolbar", ["product-divider", "muted-foreground"])} className={`${selectable("product-toolbar").className} px-3 py-1.5 border-b flex gap-2`} style={{ background: op.toolbar, borderColor: op.divider, color: muted }}>
        <span>Filtros</span>
        <span className="font-semibold" style={{ color: text, borderBottom: `2px solid ${accent}` }}>Tabela</span>
        <span>Quadro</span>
      </div>
      <div className="p-2">
        <div {...selectable("product-panel", ["product-divider"])} className={`${selectable("product-panel").className} rounded border`} style={{ background: op.panel, borderColor: op.divider }}>
          <div {...selectable("product-panel-muted", ["product-divider"])} className={`${selectable("product-panel-muted").className} px-2 py-1 border-b font-semibold`} style={{ background: op.muted, borderColor: op.divider }}>
            Nome · Etapa · Valor
          </div>
          {["Projeto Alfa", "Outsourcing Beta"].map((n) => (
              <div key={n} {...selectable("product-divider")} className={`${selectable("product-divider").className} px-2 py-1 border-b last:border-b-0`} style={{ borderColor: op.divider }}>
              {n}
            </div>
          ))}
        </div>
      </div>
    </section>
  );


  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-card rounded-full shadow-sm border">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Visualização em tempo real
          </span>
        </div>
        <div className="flex items-center gap-1 bg-card p-1 rounded-lg border">
          <button
            type="button"
            aria-label="Prévia no tema claro"
            aria-pressed={!dark}
            onClick={() => setDark(false)}
            className={`p-1.5 rounded ${!dark ? "bg-foreground text-background" : "text-muted-foreground"}`}
          >
            <Sun className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Prévia no tema escuro"
            aria-pressed={dark}
            onClick={() => setDark(true)}
            className={`p-1.5 rounded ${dark ? "bg-foreground text-background" : "text-muted-foreground"}`}
          >
            <Moon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        {...selectable("background", ["foreground", "border"])}
        className={`${selectable("background").className} flex-1 rounded-xl border shadow-2xl overflow-hidden flex flex-col`}
        style={{
          background: bg,
          color: text,
          fontFamily: bodyFont,
          borderColor: border,
          ["--icon-stroke" as string]: String(iconStroke),
          ["--icon-size" as string]: `${iconSize}px`,
        }}
      >
        {/* Top bar */}
        <div
          {...selectable("card", ["border"])}
          className={`${selectable("card").className} h-12 flex items-center justify-between px-4 border-b`}
          style={{ borderColor: border, background: surface }}
        >
          <div className="flex items-center gap-3">
            {logo ? (
              <img {...selectable(dark ? "logo_dark" : "logo_light")} src={logo} alt="" className={`${selectable(dark ? "logo_dark" : "logo_light").className} h-6 w-6 rounded object-contain`} />
            ) : (
              <div {...selectable("primary")} className={`${selectable("primary").className} h-6 w-6 rounded`} style={{ background: primary }} />
            )}
            <span
              {...selectable("brand_name", ["heading_font", "foreground"])}
              className={`${selectable("brand_name").className} text-sm font-bold truncate max-w-[160px]`}
              style={{ fontFamily: headingFont, color: text }}
            >
              {brandName || "Sua marca"}
            </span>
          </div>
          <div className="flex items-center gap-3" style={{ color: muted }}>
            <Search {...selectable("icon-size", ["icon-stroke", "muted-foreground"])} style={{ width: iconSize, height: iconSize, strokeWidth: iconStroke }} />
            <Bell style={{ width: iconSize, height: iconSize, strokeWidth: iconStroke }} />
            <span
              className="h-6 w-6 rounded-full text-[10px] font-bold flex items-center justify-center"
              style={{ background: primary, color: primaryFg }}
            >
              WK
            </span>
          </div>
        </div>

        <div className="flex-1 flex min-h-0">
          {/* Sidebar */}
          <aside
            {...selectable("sidebar", ["sidebar-foreground", "border"])}
            className={`${selectable("sidebar").className} w-36 border-r p-2 space-y-1 shrink-0`}
            style={{ borderColor: border, background: sidebar }}
          >
            {["Painel", "Negócios", "Contatos", "Contratos"].map((item, i) => (
              <div
                key={item}
                className="flex items-center gap-2 px-2 py-1.5 text-[11px] font-medium"
                style={{
                  borderRadius: radius,
                  background: i === 0 ? accent : "transparent",
                  color: i === 0 ? accentFg : sidebarFg,
                }}
              >
                <span
                  className="h-2 w-2 rounded-sm"
                  style={{ background: i === 0 ? primary : muted }}
                />
                {item}
              </div>
            ))}
          </aside>

          {/* Main */}
          <main className={`flex-1 ${pad} space-y-4 overflow-auto`}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ fontFamily: headingFont, color: text }}>
                Painel de vendas
              </h2>
              <button
                type="button"
                {...selectable("primary", ["primary-foreground", "radius"])}
                className={`${selectable("primary").className} px-3 py-2 text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm transition-transform active:scale-95`}
                style={{ background: primary, color: primaryFg, borderRadius: radius }}
              >
                <Plus style={{ width: iconSize, height: iconSize, strokeWidth: iconStroke }} /> Novo
                lead
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  label: "Conversão",
                  value: "24,8%",
                  badge: "+12%",
                  badgeBg: accent,
                  badgeFg: accentFg,
                },
                {
                  label: "Pipeline",
                  value: "R$ 142k",
                  badge: "Ativo",
                  badgeBg: primary,
                  badgeFg: primaryFg,
                },
                {
                  label: "Tarefas",
                  value: "38",
                  badge: "Hoje",
                  badgeBg: surface2,
                  badgeFg: text,
                },
              ].map((card) => (
                <div
                  key={card.label}
                  {...selectable("card", ["border", "radius"])}
                  className={`${selectable("card").className} p-3 border shadow-sm space-y-2`}
                  style={{ borderRadius: radius, background: surface, borderColor: border }}
                >
                  <div
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: muted }}
                  >
                    {card.label}
                  </div>
                  <div
                    className="text-xl font-bold"
                    style={{ fontFamily: headingFont, color: text }}
                  >
                    {card.value}
                  </div>
                  <span
                    {...selectable(card.label === "Conversão" ? "accent" : card.label === "Pipeline" ? "primary" : "surface-3")}
                    className={`${selectable(card.label === "Conversão" ? "accent" : card.label === "Pipeline" ? "primary" : "surface-3").className} inline-block px-2 py-0.5 text-[10px] font-bold`}
                    style={{ background: card.badgeBg, color: card.badgeFg, borderRadius: radius }}
                  >
                    {card.badge}
                  </span>
                </div>
              ))}
            </div>

            {/* Lista operacional */}
            {operationalScene}

            {/* Tabela */}
            <div
              className="border overflow-hidden"
              style={{ borderRadius: radius, background: surface, borderColor: border }}
            >
              <div
                className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider border-b"
                style={{ color: muted, borderColor: border, background: surface2 }}
              >
                Negócios recentes
              </div>
              {["Acme — R$ 24k", "Globex — R$ 12k", "Umbrella — R$ 8k"].map((row, i) => (
                <div
                  key={row}
                  className="px-3 py-2 text-xs flex items-center justify-between border-b last:border-b-0"
                  style={{ borderColor: border, color: text }}
                >
                  <span>{row}</span>
                  <span
                    className="px-1.5 py-0.5 text-[10px] font-bold"
                    style={{
                      borderRadius: radius,
                      background: stages[i]?.color,
                      color: readableForeground(stages[i]?.color ?? primary),
                    }}
                  >
                    {stages[i]?.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Badges */}
            <div
              {...selectable("card", ["border", "radius"])}
              className={`${selectable("card").className} border p-3 space-y-3`}
              style={{ borderRadius: radius, background: surface, borderColor: border }}
            >
              <div
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: muted }}
              >
                Status e etapas
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[...statuses, ...stages].map((s) => (
                  <span
                    key={s.label}
                    {...selectable(s.label === "Sucesso" ? "success" : s.label === "Aviso" ? "warning" : s.label === "Erro" ? "destructive" : s.label === "Info" ? "dei-accent" : stages.findIndex((stage) => stage.label === s.label) === 0 ? "hs-stage-1" : stages.findIndex((stage) => stage.label === s.label) === 1 ? "hs-stage-2" : stages.findIndex((stage) => stage.label === s.label) === 2 ? "hs-stage-4" : s.label === "Ganho" ? "hs-stage-won" : "hs-stage-lost")}
                    className={`${selectable(s.label === "Sucesso" ? "success" : s.label === "Aviso" ? "warning" : s.label === "Erro" ? "destructive" : s.label === "Info" ? "dei-accent" : stages.findIndex((stage) => stage.label === s.label) === 0 ? "hs-stage-1" : stages.findIndex((stage) => stage.label === s.label) === 1 ? "hs-stage-2" : stages.findIndex((stage) => stage.label === s.label) === 2 ? "hs-stage-4" : s.label === "Ganho" ? "hs-stage-won" : "hs-stage-lost").className} px-2 py-0.5 text-[10px] font-bold`}
                    style={{
                      borderRadius: radius,
                      background: s.color,
                      color: readableForeground(s.color),
                    }}
                  >
                    {s.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Formulário + estado vazio */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                className="border p-3 space-y-2"
                style={{ borderRadius: radius, background: surface, borderColor: border }}
              >
                <div
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: muted }}
                >
                  Formulário
                </div>
                <label {...selectable("foreground")} className={`${selectable("foreground").className} block text-[10px] font-semibold`} style={{ color: text }}>
                  Nome da empresa
                </label>
                <div
                  {...selectable("input", ["radius", "muted-foreground"])}
                  className={`${selectable("input").className} h-8 px-2 flex items-center text-[11px] border`}
                  style={{ borderRadius: radius, borderColor: c("input"), color: muted }}
                >
                  Acme Ltda.
                </div>
                <button
                  type="button"
                  {...selectable("primary", ["primary-foreground", "radius"])}
                  className={`${selectable("primary").className} w-full py-1.5 text-[11px] font-semibold`}
                  style={{ background: primary, color: primaryFg, borderRadius: radius }}
                >
                  Salvar
                </button>
              </div>

              <div
                className="border p-3 flex flex-col items-center justify-center text-center gap-2"
                style={{ borderRadius: radius, background: surface, borderColor: border }}
              >
                {theme?.assets?.empty_illustration ? (
                  <img
                    {...selectable("empty_illustration")}
                    src={theme.assets.empty_illustration}
                    alt=""
                    className={`${selectable("empty_illustration").className} h-12 object-contain`}
                  />
                ) : (
                  <Inbox {...selectable("icon-stroke", ["icon-size", "muted-foreground"])} style={{ width: 28, height: 28, strokeWidth: iconStroke, color: muted }} />
                )}
                <div className="text-[11px] font-bold" style={{ color: text }}>
                  Nenhum registro
                </div>
                <div className="text-[10px]" style={{ color: muted }}>
                  Crie o primeiro para começar.
                </div>
              </div>
            </div>

            {/* Tipografia */}
            <div
              className="border p-3 space-y-2"
              style={{ borderRadius: radius, background: surface, borderColor: border }}
            >
              <div
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: muted }}
              >
                Tipografia
              </div>
              <div {...selectable("heading_font", ["foreground"])} style={{ fontFamily: headingFont, color: text }} className={`${selectable("heading_font").className} text-base font-bold`}>
                Heading — {headingFont.split(",")[0].replace(/['"]/g, "")}
              </div>
              <div
                {...selectable("body_font", ["muted-foreground"])}
                style={{ fontFamily: bodyFont, color: muted }}
                className={`${selectable("body_font").className} text-xs leading-relaxed`}
              >
                O texto corrido aparece neste estilo. Inclui números 1234567890 e acentos: ação,
                coração, gestão.
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
