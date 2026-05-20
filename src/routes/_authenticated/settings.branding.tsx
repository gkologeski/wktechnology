import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getBranding, saveBranding } from "@/lib/branding.functions";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/branding")({
  component: BrandingPage,
});

type Form = {
  brand_name: string; logo_url: string; favicon_url: string;
  primary_color: string; accent_color: string;
  custom_domain: string; support_email: string; footer_text: string;
};

const EMPTY: Form = {
  brand_name: "", logo_url: "", favicon_url: "",
  primary_color: "", accent_color: "",
  custom_domain: "", support_email: "", footer_text: "",
};

function BrandingPage() {
  const load = useServerFn(getBranding);
  const save = useServerFn(saveBranding);
  const [form, setForm] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await load({});
      const b = r.branding as Partial<Form> | null;
      if (b) setForm({ ...EMPTY, ...Object.fromEntries(Object.entries(b).map(([k,v]) => [k, v ?? ""])) as Form });
    })();
  }, []);

  const submit = async () => {
    setBusy(true);
    try {
      const payload = Object.fromEntries(Object.entries(form).map(([k,v]) => [k, v === "" ? null : v]));
      await save({ data: payload as never });
      toast.success("Branding salvo");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">White-label</h1>
        <p className="text-sm text-muted-foreground">Personalize a marca do seu CRM.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Identidade</CardTitle><CardDescription>Nome, logo e favicon.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Nome da marca</Label><Input value={form.brand_name} onChange={(e) => set("brand_name", e.target.value)} /></div>
          <div><Label>Logo URL</Label><Input value={form.logo_url} onChange={(e) => set("logo_url", e.target.value)} placeholder="https://" /></div>
          <div><Label>Favicon URL</Label><Input value={form.favicon_url} onChange={(e) => set("favicon_url", e.target.value)} placeholder="https://" /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Cores</CardTitle><CardDescription>Use formato HSL (ex: 220 90% 56%) ou OKLCH.</CardDescription></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <div><Label>Primária</Label><Input value={form.primary_color} onChange={(e) => set("primary_color", e.target.value)} placeholder="220 90% 56%" /></div>
          <div><Label>Accent</Label><Input value={form.accent_color} onChange={(e) => set("accent_color", e.target.value)} placeholder="..." /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Contato & domínio</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Domínio customizado</Label><Input value={form.custom_domain} onChange={(e) => set("custom_domain", e.target.value)} placeholder="crm.suaempresa.com" /></div>
          <div><Label>Email de suporte</Label><Input value={form.support_email} onChange={(e) => set("support_email", e.target.value)} /></div>
          <div><Label>Rodapé</Label><Textarea rows={3} value={form.footer_text} onChange={(e) => set("footer_text", e.target.value)} /></div>
        </CardContent>
      </Card>

      <Button onClick={submit} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar branding</Button>
    </div>
  );
}
