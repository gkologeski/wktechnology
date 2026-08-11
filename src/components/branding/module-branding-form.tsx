import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageInput } from "@/components/ui/image-input";
import { LOGO_MIMES, FAVICON_MIMES } from "@/lib/branding/asset-rules";

import { getModuleBranding, saveModuleBranding } from "@/lib/modules/module-branding.functions";
import { getBranding } from "@/lib/branding.functions";
import { MODULES, type ModuleId } from "@/lib/modules/registry";
import { sanitizeTheme, EMPTY_THEME, mergeThemes, type BrandTheme } from "@/lib/branding/tokens";
import { ThemeEditor } from "./theme-editor";
import { LivePreview } from "./live-preview";

type Form = {
  product_name: string;
  logo_url: string;
  favicon_url: string;
  primary_color: string;
  secondary_color: string;
  custom_domain: string;
};

const EMPTY: Form = {
  product_name: "",
  logo_url: "",
  favicon_url: "",
  primary_color: "",
  secondary_color: "",
  custom_domain: "",
};

export function ModuleBrandingForm({ moduleId }: { moduleId: ModuleId }) {
  const load = useServerFn(getModuleBranding);
  const loadWorkspace = useServerFn(getBranding);
  const save = useServerFn(saveModuleBranding);
  const def = MODULES[moduleId];
  const [form, setForm] = useState<Form>(EMPTY);
  const [theme, setTheme] = useState<BrandTheme>(EMPTY_THEME);
  const [inherited, setInherited] = useState<BrandTheme>(EMPTY_THEME);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [r, ws] = await Promise.all([load({ data: { moduleId } }), loadWorkspace({})]);
        const b = r.branding as (Partial<Form> & { theme?: BrandTheme | null }) | null;
        if (!cancelled) {
          setForm({
            product_name: b?.product_name ?? "",
            logo_url: b?.logo_url ?? "",
            favicon_url: b?.favicon_url ?? "",
            primary_color: b?.primary_color ?? "",
            secondary_color: b?.secondary_color ?? "",
            custom_domain: b?.custom_domain ?? "",
          });
          setTheme(sanitizeTheme(b?.theme ?? null));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setInherited(sanitizeTheme((ws.branding as any)?.theme ?? null));
        }
      } catch (e) {
        if (!cancelled) toast.error((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [moduleId, load, loadWorkspace]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const previewTheme = useMemo(() => mergeThemes(inherited, theme), [inherited, theme]);

  const submit = async () => {
    setBusy(true);
    try {
      await save({ data: { moduleId, ...form, theme: sanitizeTheme(theme) } });
      toast.success("Branding do módulo salvo. Recarregue para aplicar.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center text-sm text-muted-foreground p-8">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Carregando…
      </div>
    );
  }

  const effectiveColor = form.primary_color || def.defaultColor;
  const effectiveName = form.product_name || def.productName;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="h-5 w-5 rounded-full border" style={{ background: effectiveColor }} />
          Branding do {def.name} — {effectiveName}
        </CardTitle>
        <CardDescription>
          Personalize o nome do produto, cores, ícones e imagens deste módulo. Tokens em branco
          herdam do branding do workspace.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="identity">
          <TabsList>
            <TabsTrigger value="identity">Identidade</TabsTrigger>
            <TabsTrigger value="theme">Tema do módulo</TabsTrigger>
          </TabsList>

          <TabsContent value="identity" className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`mb-name-${moduleId}`}>Nome do produto</Label>
              <Input
                id={`mb-name-${moduleId}`}
                placeholder={def.productName}
                value={form.product_name}
                onChange={(e) => set("product_name", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`mb-domain-${moduleId}`}>Domínio customizado</Label>
              <Input
                id={`mb-domain-${moduleId}`}
                placeholder={`${def.hostSuffix}.suaempresa.com.br`}
                value={form.custom_domain}
                onChange={(e) => set("custom_domain", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`mb-primary-${moduleId}`}>Cor primária</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  aria-label="Selecionar cor primária"
                  className="h-10 w-14 p-1"
                  value={form.primary_color || def.defaultColor}
                  onChange={(e) => set("primary_color", e.target.value)}
                />
                <Input
                  id={`mb-primary-${moduleId}`}
                  placeholder={def.defaultColor}
                  value={form.primary_color}
                  onChange={(e) => set("primary_color", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`mb-secondary-${moduleId}`}>Cor secundária</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  aria-label="Selecionar cor secundária"
                  className="h-10 w-14 p-1"
                  value={form.secondary_color || "#64748b"}
                  onChange={(e) => set("secondary_color", e.target.value)}
                />
                <Input
                  id={`mb-secondary-${moduleId}`}
                  placeholder="#64748b"
                  value={form.secondary_color}
                  onChange={(e) => set("secondary_color", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <ImageInput
                label="Logotipo"
                helperText="PNG, JPG, WEBP, SVG ou AVIF, até 2 MB."
                value={form.logo_url}
                onChange={(v) => set("logo_url", v ?? "")}
                maxBytes={2 * 1024 * 1024}
                allowedMimes={LOGO_MIMES}
                folder="branding"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <ImageInput
                label="Favicon"
                helperText="PNG, SVG ou ICO quadrado, até 2 MB."
                value={form.favicon_url}
                onChange={(v) => set("favicon_url", v ?? "")}
                maxBytes={2 * 1024 * 1024}
                allowedMimes={FAVICON_MIMES}
                aspectHint="square"
                folder="branding"
              />
            </div>

          </TabsContent>

          <TabsContent value="theme" className="mt-4">
            <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
              <div className="max-h-[70vh] overflow-y-auto pr-1">
                <ThemeEditor theme={theme} onChange={setTheme} inherited={inherited} />
              </div>
              <div className="min-w-0 h-[70vh] bg-muted/40 rounded-xl p-4">
                <LivePreview
                  settings={{
                    primary: form.primary_color || def.defaultColor,
                    accent: form.secondary_color || "#64748b",
                    radius: 8,
                    headingFont: "Inter, ui-sans-serif, system-ui",
                    bodyFont: "Inter, ui-sans-serif, system-ui",
                    density: "cozy",
                    logoUrl: form.logo_url,
                    brandName: effectiveName,
                    theme: previewTheme,
                  }}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end pt-4">
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar branding do {def.name}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
