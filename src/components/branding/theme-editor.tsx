// Editor de tokens de tema (white-label): cores claro/escuro, ícones e imagens.
import { useState } from "react";
import { AlertTriangle, RotateCcw, Sparkles, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ImageInput } from "@/components/ui/image-input";
import { ColorControl } from "./color-control";
import {
  BRAND_TOKEN_GROUPS,
  DEFAULT_ICONS,
  defaultThemeColors,
  tokensByGroup,
  type BrandTheme,
} from "@/lib/branding/tokens";
import { contrastIssues, deriveDarkFromLight } from "@/lib/branding/derive";
import {
  LOGO_MIMES,
  FAVICON_MIMES,
  MAX_LOGO_BYTES,
  MAX_ILLUSTRATION_BYTES,
} from "@/lib/branding/asset-rules";

type Props = {
  theme: BrandTheme;
  onChange: (next: BrandTheme) => void;
  /** Tema herdado (workspace) — usado no editor de módulo para mostrar o valor base. */
  inherited?: BrandTheme | null;
};

const ASSET_FIELDS: Array<{
  key: keyof NonNullable<BrandTheme["assets"]>;
  label: string;
  helper: string;
  maxBytes: number;
  allowedMimes: string[];
  aspectHint?: "square" | "wide";
}> = [
  {
    key: "logo_light",
    label: "Logo (tema claro)",
    helper: "PNG, JPG, WEBP, SVG ou AVIF horizontal, até 2 MB.",
    maxBytes: MAX_LOGO_BYTES,
    allowedMimes: LOGO_MIMES,
  },
  {
    key: "logo_dark",
    label: "Logo (tema escuro)",
    helper: "Versão para fundos escuros, até 2 MB.",
    maxBytes: MAX_LOGO_BYTES,
    allowedMimes: LOGO_MIMES,
  },
  {
    key: "logo_mark",
    label: "Símbolo reduzido",
    helper: "Usado na barra lateral recolhida. Prefira formato quadrado.",
    maxBytes: MAX_LOGO_BYTES,
    allowedMimes: FAVICON_MIMES.concat(LOGO_MIMES),
    aspectHint: "wide",
  },
  {
    key: "login_image",
    label: "Arte da tela de login",
    helper: "Imagem das telas públicas, até 5 MB.",
    maxBytes: MAX_ILLUSTRATION_BYTES,
    allowedMimes: LOGO_MIMES,
  },
  {
    key: "empty_illustration",
    label: "Ilustração de estado vazio",
    helper: "Exibida quando não há registros, até 5 MB.",
    maxBytes: MAX_ILLUSTRATION_BYTES,
    allowedMimes: LOGO_MIMES,
  },
];

export function ThemeEditor({ theme, onChange, inherited }: Props) {
  const [mode, setMode] = useState<"light" | "dark">("light");

  const defaults = defaultThemeColors(mode);
  const inheritedColors = (mode === "light" ? inherited?.light : inherited?.dark) ?? {};
  const colors = (mode === "light" ? theme.light : theme.dark) ?? {};

  const effective = (key: string) => colors[key] ?? inheritedColors[key] ?? defaults[key];
  const isCustom = (key: string) => Boolean(colors[key]);

  const setColor = (key: string, value: string) => {
    const nextColors = { ...colors, [key]: value };
    onChange(mode === "light" ? { ...theme, light: nextColors } : { ...theme, dark: nextColors });
  };

  const resetColor = (key: string) => {
    const nextColors = { ...colors };
    delete nextColors[key];
    onChange(mode === "light" ? { ...theme, light: nextColors } : { ...theme, dark: nextColors });
  };

  const resetGroup = (groupId: (typeof BRAND_TOKEN_GROUPS)[number]["id"]) => {
    const nextColors = { ...colors };
    for (const t of tokensByGroup(groupId)) delete nextColors[t.key];
    onChange(mode === "light" ? { ...theme, light: nextColors } : { ...theme, dark: nextColors });
  };

  const deriveDark = () => {
    const light = { ...(inherited?.light ?? {}), ...(theme.light ?? {}) };
    onChange({ ...theme, dark: deriveDarkFromLight(light, defaultThemeColors("light")) });
    setMode("dark");
  };

  const resolvedAll: Record<string, string> = {};
  for (const group of BRAND_TOKEN_GROUPS) {
    for (const t of tokensByGroup(group.id)) resolvedAll[t.key] = effective(t.key);
  }
  const issues = contrastIssues(resolvedAll);

  const icons = { ...DEFAULT_ICONS, ...(inherited?.icons ?? {}), ...(theme.icons ?? {}) };
  const assets = { ...(theme.assets ?? {}) };
  const inheritedAssets: Record<string, string> = { ...(inherited?.assets ?? {}) };

  return (
    <div className="space-y-6">
      {/* Alternador claro/escuro */}
      <div className="flex items-center justify-between gap-2">
        <div
          className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-md"
          role="group"
          aria-label="Tema em edição"
        >
          <button
            type="button"
            onClick={() => setMode("light")}
            aria-pressed={mode === "light"}
            className={`px-3 py-1.5 text-[10px] font-bold rounded inline-flex items-center gap-1.5 transition-colors ${
              mode === "light"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sun className="h-3.5 w-3.5" /> Claro
          </button>
          <button
            type="button"
            onClick={() => setMode("dark")}
            aria-pressed={mode === "dark"}
            className={`px-3 py-1.5 text-[10px] font-bold rounded inline-flex items-center gap-1.5 transition-colors ${
              mode === "dark"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Moon className="h-3.5 w-3.5" /> Escuro
          </button>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={deriveDark}>
          <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Derivar escuro
        </Button>
      </div>

      {issues.length > 0 && (
        <div
          className="rounded-md border border-warning/40 bg-warning/10 p-3 space-y-1"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-foreground">
            <AlertTriangle className="h-3.5 w-3.5 text-warning" /> Contraste abaixo de AA
          </div>
          {issues.map((i) => (
            <p key={`${i.fgKey}-${i.bgKey}`} className="text-[10px] text-muted-foreground">
              {i.label}: {i.ratio.toFixed(2)}:1 (mínimo 4,5:1)
            </p>
          ))}
        </div>
      )}

      {BRAND_TOKEN_GROUPS.map((group) => (
        <section key={group.id} className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
              {group.label}
            </h3>
            <button
              type="button"
              onClick={() => resetGroup(group.id)}
              className="text-[10px] font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RotateCcw className="h-3 w-3" /> Padrão
            </button>
          </div>
          <div className="space-y-4">
            {tokensByGroup(group.id).map((token) => (
              <div key={token.key} className="space-y-1">
                <ColorControl
                  label={token.label}
                  value={effective(token.key)}
                  onChange={(hex) => setColor(token.key, hex)}
                />
                <div className="flex items-center justify-between">
                  <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
                    {isCustom(token.key) ? "Personalizado" : inherited ? "Herdado" : "Padrão"}
                  </span>
                  {isCustom(token.key) && (
                    <button
                      type="button"
                      onClick={() => resetColor(token.key)}
                      className="text-[9px] font-semibold text-muted-foreground hover:text-foreground rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {inherited ? "Voltar a herdar" : "Restaurar"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* Ícones */}
      <section className="space-y-4">
        <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
          Ícones
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="icon-stroke" className="text-[11px] font-bold uppercase tracking-wide">
              Espessura do traço
            </Label>
            <span className="text-[10px] font-mono text-muted-foreground">{icons.stroke}</span>
          </div>
          <input
            id="icon-stroke"
            type="range"
            min={1}
            max={3}
            step={0.25}
            value={icons.stroke}
            onChange={(e) =>
              onChange({ ...theme, icons: { ...theme.icons, stroke: Number(e.target.value) } })
            }
            className="w-full accent-primary"
          />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="icon-size" className="text-[11px] font-bold uppercase tracking-wide">
              Tamanho base
            </Label>
            <span className="text-[10px] font-mono text-muted-foreground">{icons.size}px</span>
          </div>
          <input
            id="icon-size"
            type="range"
            min={12}
            max={24}
            step={1}
            value={icons.size}
            onChange={(e) =>
              onChange({ ...theme, icons: { ...theme.icons, size: Number(e.target.value) } })
            }
            className="w-full accent-primary"
          />
        </div>
      </section>

      {/* Imagens */}
      <section className="space-y-4">
        <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
          Logos e ilustrações
        </h3>
        {ASSET_FIELDS.map((field) => (
          <ImageInput
            key={field.key}
            label={field.label}
            helperText={field.helper}
            value={assets[field.key] ?? ""}
            maxBytes={field.maxBytes}
            allowedMimes={field.allowedMimes}
            aspectHint={field.aspectHint}
            folder="branding"
            inheritedValue={inheritedAssets[field.key] ?? null}
            onResetInherit={
              inheritedAssets[field.key] && assets[field.key]
                ? () => {
                    const nextAssets = { ...(theme.assets ?? {}) };
                    delete nextAssets[field.key];
                    onChange({ ...theme, assets: nextAssets });
                  }
                : undefined
            }
            onChange={(url) =>
              onChange({ ...theme, assets: { ...theme.assets, [field.key]: url ?? "" } })
            }
          />
        ))}
      </section>
    </div>
  );
}
