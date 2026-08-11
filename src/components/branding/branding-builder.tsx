import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Palette } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getBranding, saveBranding } from "@/lib/branding.functions";
import { anyToHex } from "@/lib/color-utils";
import { sanitizeTheme, EMPTY_THEME, type BrandTheme } from "@/lib/branding/tokens";
import { ControlsPanel, type BuilderForm } from "./controls-panel";
import { ThemeEditor } from "./theme-editor";
import { LivePreview } from "./live-preview";

const DEFAULT_FORM: BuilderForm = {
  brand_name: "",
  logo_url: "",
  favicon_url: "",
  primary_color: "#4f46e5",
  accent_color: "#22d3ee",
  radius: "8px",
  density: "cozy",
  heading_font: "Inter, ui-sans-serif, system-ui",
  body_font: "Inter, ui-sans-serif, system-ui",
  custom_domain: "",
  support_email: "",
  footer_text: "",
};

type State = { form: BuilderForm; theme: BrandTheme };

export function BrandingBuilder() {
  const load = useServerFn(getBranding);
  const save = useServerFn(saveBranding);
  const [state, setState] = useState<State>({ form: DEFAULT_FORM, theme: EMPTY_THEME });
  const [saved, setSaved] = useState<State>({ form: DEFAULT_FORM, theme: EMPTY_THEME });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await load({});
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const b = r.branding as any;
        if (b) {
          const next: State = {
            form: {
              brand_name: b.brand_name ?? "",
              logo_url: b.logo_url ?? "",
              favicon_url: b.favicon_url ?? "",
              primary_color: anyToHex(b.primary_color) || DEFAULT_FORM.primary_color,
              accent_color: anyToHex(b.accent_color) || DEFAULT_FORM.accent_color,
              radius: b.radius ?? DEFAULT_FORM.radius,
              density: (b.density as BuilderForm["density"]) ?? "cozy",
              heading_font: b.heading_font ?? DEFAULT_FORM.heading_font,
              body_font: b.body_font ?? DEFAULT_FORM.body_font,
              custom_domain: b.custom_domain ?? "",
              support_email: b.support_email ?? "",
              footer_text: b.footer_text ?? "",
            },
            theme: sanitizeTheme(b.theme as BrandTheme | null),
          };
          setState(next);
          setSaved(next);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const form = state.form;
  const theme = state.theme;

  const set = <K extends keyof BuilderForm>(k: K, v: BuilderForm[K]) =>
    setState((s) => ({ ...s, form: { ...s.form, [k]: v } }));

  const setTheme = (next: BrandTheme) => setState((s) => ({ ...s, theme: next }));

  const dirty = useMemo(() => JSON.stringify(state) !== JSON.stringify(saved), [state, saved]);

  const submit = async () => {
    setBusy(true);
    try {
      const payload = {
        ...form,
        brand_name: form.brand_name || null,
        logo_url: form.logo_url || null,
        favicon_url: form.favicon_url || null,
        custom_domain: form.custom_domain || null,
        support_email: form.support_email || null,
        footer_text: form.footer_text || null,
        theme: sanitizeTheme(theme),
      };
      await save({ data: payload as never });
      setSaved(state);
      toast.success("Marca salva. Recarregue para aplicar em toda a plataforma.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const discard = () => setState(saved);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Carregando…
      </div>
    );
  }

  return (
    <div className="bg-card border rounded-2xl shadow-sm overflow-hidden flex flex-col h-[calc(100vh-180px)] min-h-[600px]">
      {/* Header */}
      <header className="h-14 border-b px-5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Palette className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-bold uppercase tracking-tight">Construtor de marca</h1>
            <p className="text-[11px] text-muted-foreground">
              {form.brand_name
                ? `Workspace: ${form.brand_name}`
                : "Personalize tema, cores, ícones e tipografia"}
            </p>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex min-h-0">
        <aside className="w-80 border-r overflow-y-auto bg-muted/30 shrink-0">
          <Tabs defaultValue="basics" className="w-full">
            <div className="px-4 pt-4">
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="basics">Marca</TabsTrigger>
                <TabsTrigger value="theme">Tema</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="basics" className="mt-0">
              <ControlsPanel form={form} set={set} />
            </TabsContent>
            <TabsContent value="theme" className="mt-0 p-5">
              <ThemeEditor theme={theme} onChange={setTheme} />
            </TabsContent>
          </Tabs>
        </aside>
        <main className="flex-1 bg-muted/40 p-6 min-w-0">
          <LivePreview
            settings={{
              primary: form.primary_color,
              accent: form.accent_color,
              radius: parseInt(form.radius || "8", 10) || 8,
              headingFont: form.heading_font,
              bodyFont: form.body_font,
              density: form.density,
              logoUrl: form.logo_url,
              brandName: form.brand_name,
              theme,
            }}
          />
        </main>
      </div>

      {/* Footer */}
      <footer className="h-16 border-t px-5 flex items-center justify-between shrink-0 bg-card">
        <div className="flex items-center gap-4">
          {dirty ? (
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-warning" />
              </span>
              <span className="text-[11px] font-bold text-foreground">
                Alterações não aplicadas
              </span>
            </div>
          ) : (
            <span className="text-[11px] font-medium text-muted-foreground">Tudo salvo</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" disabled={!dirty || busy} onClick={discard}>
            Descartar
          </Button>
          <Button disabled={!dirty || busy} onClick={submit}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar alterações
          </Button>
        </div>
      </footer>
    </div>
  );
}
