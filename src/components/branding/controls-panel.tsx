import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageInput } from "@/components/ui/image-input";
import { LOGO_MIMES, FAVICON_MIMES, MAX_LOGO_BYTES } from "@/lib/branding/asset-rules";

import { ColorControl } from "./color-control";
import { PalettePresets } from "./palette-presets";

export type BuilderForm = {
  brand_name: string;
  logo_url: string;
  favicon_url: string;
  primary_color: string;
  accent_color: string;
  radius: string;
  density: "compact" | "cozy" | "comfortable";
  heading_font: string;
  body_font: string;
  custom_domain: string;
  support_email: string;
  footer_text: string;
};

const FONTS = [
  { value: "Inter, ui-sans-serif, system-ui", label: "Inter" },
  { value: "'Outfit', ui-sans-serif, system-ui", label: "Outfit" },
  { value: "'Plus Jakarta Sans', ui-sans-serif, system-ui", label: "Plus Jakarta Sans" },
  { value: "'Space Grotesk', ui-sans-serif, system-ui", label: "Space Grotesk" },
  { value: "'DM Sans', ui-sans-serif, system-ui", label: "DM Sans" },
];

const DENSITIES: Array<{ value: BuilderForm["density"]; label: string }> = [
  { value: "compact", label: "Compacto" },
  { value: "cozy", label: "Confortável" },
  { value: "comfortable", label: "Espaçoso" },
];

type Props = {
  form: BuilderForm;
  set: <K extends keyof BuilderForm>(k: K, v: BuilderForm[K]) => void;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
        {title}
      </h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function ControlsPanel({ form, set }: Props) {
  const radiusPx = parseInt(form.radius || "8", 10) || 8;

  return (
    <div className="p-5 space-y-7">
      <Section title="Identidade visual">
        <div className="space-y-2">
          <Label className="text-[11px] font-bold uppercase tracking-wide">Nome da marca</Label>
          <Input value={form.brand_name} onChange={(e) => set("brand_name", e.target.value)} />
        </div>
        <ImageInput
          label="Logo"
          value={form.logo_url}
          onChange={(v) => set("logo_url", v ?? "")}
          helperText="PNG, JPG, WEBP, SVG ou AVIF, até 2 MB."
          maxBytes={MAX_LOGO_BYTES}
          allowedMimes={LOGO_MIMES}
          folder="branding"
        />
        <ImageInput
          label="Favicon"
          value={form.favicon_url}
          onChange={(v) => set("favicon_url", v ?? "")}
          accept="image/png,image/x-icon,image/svg+xml,image/vnd.microsoft.icon"
          helperText="ICO, PNG ou SVG quadrado (32x32 recomendado), até 2 MB."
          maxBytes={MAX_LOGO_BYTES}
          allowedMimes={FAVICON_MIMES}
          aspectHint="square"
          folder="branding"
        />
      </Section>

      <Section title="Sistema de cores">
        <ColorControl
          label="Primária"
          value={form.primary_color}
          onChange={(v) => set("primary_color", v)}
        />
        <ColorControl
          label="Destaque (accent)"
          value={form.accent_color}
          onChange={(v) => set("accent_color", v)}
        />
        <PalettePresets
          activePrimary={form.primary_color}
          onPick={(p, a) => {
            set("primary_color", p);
            set("accent_color", a);
          }}
        />
      </Section>

      <Section title="Estilo & formas">
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label className="text-[11px] font-bold uppercase tracking-wide">Raio da borda</Label>
            <span className="text-[10px] font-mono text-muted-foreground">{radiusPx}px</span>
          </div>
          <input
            type="range"
            min={0}
            max={20}
            value={radiusPx}
            onChange={(e) => set("radius", `${e.target.value}px`)}
            className="w-full accent-primary"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-[11px] font-bold uppercase tracking-wide">Densidade</Label>
          <div className="grid grid-cols-3 gap-1 p-1 bg-muted rounded-md">
            {DENSITIES.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => set("density", d.value)}
                className={`py-1.5 text-[10px] font-bold rounded transition-colors ${
                  form.density === d.value
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-[11px] font-bold uppercase tracking-wide">Fonte de títulos</Label>
          <select
            value={form.heading_font}
            onChange={(e) => set("heading_font", e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
          >
            {FONTS.map((f) => (
              <option key={f.label} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label className="text-[11px] font-bold uppercase tracking-wide">Fonte de texto</Label>
          <select
            value={form.body_font}
            onChange={(e) => set("body_font", e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
          >
            {FONTS.map((f) => (
              <option key={f.label} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </Section>

      <Section title="Contato & domínio">
        <div className="space-y-2">
          <Label className="text-[11px] font-bold uppercase tracking-wide">
            Domínio customizado
          </Label>
          <Input
            value={form.custom_domain}
            onChange={(e) => set("custom_domain", e.target.value)}
            placeholder="crm.suaempresa.com"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-[11px] font-bold uppercase tracking-wide">Email de suporte</Label>
          <Input
            value={form.support_email}
            onChange={(e) => set("support_email", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-[11px] font-bold uppercase tracking-wide">Rodapé</Label>
          <Textarea
            rows={3}
            value={form.footer_text}
            onChange={(e) => set("footer_text", e.target.value)}
          />
        </div>
      </Section>
    </div>
  );
}
