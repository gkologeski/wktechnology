import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  getModuleBranding,
  saveModuleBranding,
} from "@/lib/modules/module-branding.functions";
import { MODULES, type ModuleId } from "@/lib/modules/registry";

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
  const save = useServerFn(saveModuleBranding);
  const def = MODULES[moduleId];
  const [form, setForm] = useState<Form>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const r = await load({ data: { moduleId } });
        const b = r.branding as Partial<Form> | null;
        if (!cancelled) {
          setForm({
            product_name: b?.product_name ?? "",
            logo_url: b?.logo_url ?? "",
            favicon_url: b?.favicon_url ?? "",
            primary_color: b?.primary_color ?? "",
            secondary_color: b?.secondary_color ?? "",
            custom_domain: b?.custom_domain ?? "",
          });
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
  }, [moduleId, load]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setBusy(true);
    try {
      await save({ data: { moduleId, ...form } });
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
          <span
            className="h-5 w-5 rounded-full border"
            style={{ background: effectiveColor }}
          />
          Branding do {def.name} — {effectiveName}
        </CardTitle>
        <CardDescription>
          Personalize o nome do produto, cores e logotipo deste módulo. Valores
          em branco herdam do branding padrão do workspace.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Nome do produto</Label>
          <Input
            placeholder={def.productName}
            value={form.product_name}
            onChange={(e) => set("product_name", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Domínio customizado</Label>
          <Input
            placeholder={`${def.hostSuffix}.suaempresa.com.br`}
            value={form.custom_domain}
            onChange={(e) => set("custom_domain", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Cor primária</Label>
          <div className="flex items-center gap-2">
            <Input
              type="color"
              className="h-10 w-14 p-1"
              value={form.primary_color || def.defaultColor}
              onChange={(e) => set("primary_color", e.target.value)}
            />
            <Input
              placeholder={def.defaultColor}
              value={form.primary_color}
              onChange={(e) => set("primary_color", e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Cor secundária</Label>
          <div className="flex items-center gap-2">
            <Input
              type="color"
              className="h-10 w-14 p-1"
              value={form.secondary_color || "#64748b"}
              onChange={(e) => set("secondary_color", e.target.value)}
            />
            <Input
              placeholder="#64748b"
              value={form.secondary_color}
              onChange={(e) => set("secondary_color", e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Logotipo (URL)</Label>
          <Input
            placeholder="https://…/logo.svg"
            value={form.logo_url}
            onChange={(e) => set("logo_url", e.target.value)}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Favicon (URL)</Label>
          <Input
            placeholder="https://…/favicon.png"
            value={form.favicon_url}
            onChange={(e) => set("favicon_url", e.target.value)}
          />
        </div>
        <div className="md:col-span-2 flex justify-end">
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar branding do {def.name}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
