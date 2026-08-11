import { useState } from "react";
import { Sun, Moon, Search, Plus, Bell, Inbox } from "lucide-react";
import { readableForeground } from "@/lib/color-utils";
import { defaultThemeColors, type BrandTheme } from "@/lib/branding/tokens";

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

export function LivePreview({ settings }: { settings: PreviewSettings }) {
  const [dark, setDark] = useState(false);
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
        className="flex-1 rounded-xl border shadow-2xl overflow-hidden flex flex-col"
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
          className="h-12 flex items-center justify-between px-4 border-b"
          style={{ borderColor: border, background: surface }}
        >
          <div className="flex items-center gap-3">
            {logo ? (
              <img src={logo} alt="" className="h-6 w-6 rounded object-contain" />
            ) : (
              <div className="h-6 w-6 rounded" style={{ background: primary }} />
            )}
            <span
              className="text-sm font-bold truncate max-w-[160px]"
              style={{ fontFamily: headingFont, color: text }}
            >
              {brandName || "Sua marca"}
            </span>
          </div>
          <div className="flex items-center gap-3" style={{ color: muted }}>
            <Search style={{ width: iconSize, height: iconSize, strokeWidth: iconStroke }} />
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
            className="w-36 border-r p-2 space-y-1 shrink-0"
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
                className="px-3 py-2 text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm transition-transform active:scale-95"
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
                  className="p-3 border shadow-sm space-y-2"
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
                    className="inline-block px-2 py-0.5 text-[10px] font-bold"
                    style={{ background: card.badgeBg, color: card.badgeFg, borderRadius: radius }}
                  >
                    {card.badge}
                  </span>
                </div>
              ))}
            </div>

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
              className="border p-3 space-y-3"
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
                    className="px-2 py-0.5 text-[10px] font-bold"
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
                <label className="block text-[10px] font-semibold" style={{ color: text }}>
                  Nome da empresa
                </label>
                <div
                  className="h-8 px-2 flex items-center text-[11px] border"
                  style={{ borderRadius: radius, borderColor: c("input"), color: muted }}
                >
                  Acme Ltda.
                </div>
                <button
                  type="button"
                  className="w-full py-1.5 text-[11px] font-semibold"
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
                    src={theme.assets.empty_illustration}
                    alt=""
                    className="h-12 object-contain"
                  />
                ) : (
                  <Inbox style={{ width: 28, height: 28, strokeWidth: iconStroke, color: muted }} />
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
              <div style={{ fontFamily: headingFont, color: text }} className="text-base font-bold">
                Heading — {headingFont.split(",")[0].replace(/['"]/g, "")}
              </div>
              <div
                style={{ fontFamily: bodyFont, color: muted }}
                className="text-xs leading-relaxed"
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
