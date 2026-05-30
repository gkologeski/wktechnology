import { useState } from "react";
import { Sun, Moon, Search, Plus, Bell } from "lucide-react";
import { readableForeground } from "@/lib/color-utils";

export type PreviewSettings = {
  primary: string;
  accent: string;
  radius: number;
  headingFont: string;
  bodyFont: string;
  density: "compact" | "cozy" | "comfortable";
  logoUrl: string;
  brandName: string;
};

export function LivePreview({ settings }: { settings: PreviewSettings }) {
  const [dark, setDark] = useState(false);
  const { primary, accent, radius, headingFont, bodyFont, brandName, logoUrl } = settings;
  const primaryFg = readableForeground(primary);
  const accentFg = readableForeground(accent);

  const pad = settings.density === "compact" ? "p-3" : settings.density === "comfortable" ? "p-6" : "p-4";

  const bg = dark ? "#0b1220" : "#ffffff";
  const surface = dark ? "#111a2e" : "#ffffff";
  const surface2 = dark ? "#0e1626" : "#f8fafc";
  const text = dark ? "#e5e7eb" : "#0f172a";
  const muted = dark ? "#94a3b8" : "#64748b";
  const border = dark ? "#1f2a44" : "#e2e8f0";

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-card rounded-full shadow-sm border">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Visualização em tempo real
          </span>
        </div>
        <div className="flex items-center gap-1 bg-card p-1 rounded-lg border">
          <button
            type="button"
            onClick={() => setDark(false)}
            className={`p-1.5 rounded ${!dark ? "bg-foreground text-background" : "text-muted-foreground"}`}
          >
            <Sun className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setDark(true)}
            className={`p-1.5 rounded ${dark ? "bg-foreground text-background" : "text-muted-foreground"}`}
          >
            <Moon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        className="flex-1 rounded-xl border shadow-2xl overflow-hidden flex flex-col"
        style={{ background: bg, color: text, fontFamily: bodyFont, borderColor: border }}
      >
        {/* Top bar */}
        <div className="h-12 flex items-center justify-between px-4 border-b" style={{ borderColor: border, background: surface }}>
          <div className="flex items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="h-6 w-6 rounded object-contain" />
            ) : (
              <div className="h-6 w-6 rounded" style={{ background: primary }} />
            )}
            <span className="text-sm font-bold truncate max-w-[160px]" style={{ fontFamily: headingFont, color: text }}>
              {brandName || "Sua marca"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Search className="h-4 w-4" style={{ color: muted }} />
            <Bell className="h-4 w-4" style={{ color: muted }} />
            <div className="h-7 w-7 rounded-full" style={{ background: accent }} />
          </div>
        </div>

        <div className="flex-1 flex min-h-0">
          {/* Sidebar */}
          <aside className="w-44 border-r p-3 space-y-1 hidden sm:block" style={{ borderColor: border, background: surface2 }}>
            {["Painel", "Funil", "Contatos", "Empresas", "Tarefas"].map((item, i) => (
              <div
                key={item}
                className="px-3 py-2 text-xs font-medium flex items-center gap-2"
                style={{
                  borderRadius: radius,
                  background: i === 0 ? `${primary}1a` : "transparent",
                  color: i === 0 ? primary : muted,
                }}
              >
                <span className="h-2 w-2 rounded-sm" style={{ background: i === 0 ? primary : muted }} />
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
                <Plus className="h-3.5 w-3.5" /> Novo lead
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: "Conversão", value: "24,8%", badge: "+12%", badgeBg: accent, badgeFg: accentFg },
                { label: "Pipeline", value: "R$ 142k", badge: "Ativo", badgeBg: primary, badgeFg: primaryFg },
                { label: "Tarefas", value: "38", badge: "Hoje", badgeBg: `${primary}26`, badgeFg: primary },
              ].map((card) => (
                <div
                  key={card.label}
                  className="p-3 border shadow-sm space-y-2"
                  style={{ borderRadius: radius, background: surface, borderColor: border }}
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: muted }}>
                    {card.label}
                  </div>
                  <div className="text-xl font-bold" style={{ fontFamily: headingFont, color: text }}>
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

            <div
              className="border p-3 space-y-2"
              style={{ borderRadius: radius, background: surface, borderColor: border }}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: muted }}>
                Tipografia
              </div>
              <div style={{ fontFamily: headingFont, color: text }} className="text-base font-bold">
                Heading — {headingFont.split(",")[0].replace(/['"]/g, "")}
              </div>
              <div style={{ fontFamily: bodyFont, color: muted }} className="text-xs leading-relaxed">
                O texto corrido aparece neste estilo. Inclui números 1234567890 e acentos: ação, coração, gestão.
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
