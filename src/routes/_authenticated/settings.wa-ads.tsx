import { getPublicAppUrl } from "@/lib/app-url";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Trash2, Copy, ExternalLink, MousePointerClick } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  listAdSlugs,
  upsertAdSlug,
  deleteAdSlug,
  listPhoneNumbers,
} from "@/lib/whatsapp-meta.functions";

export const Route = createFileRoute("/_authenticated/settings/wa-ads")({
  component: WaAdsPage,
});

function WaAdsPage() {
  const fetchSlugs = useServerFn(listAdSlugs);
  const fetchNumbers = useServerFn(listPhoneNumbers);
  const upsert = useServerFn(upsertAdSlug);
  const remove = useServerFn(deleteAdSlug);

  const [slugs, setSlugs] = useState<any[]>([]);
  const [numbers, setNumbers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [slug, setSlug] = useState("");
  const [display, setDisplay] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [prefill, setPrefill] = useState("");
  const [utmSource, setUtmSource] = useState("");
  const [utmMedium, setUtmMedium] = useState("");
  const [utmCampaign, setUtmCampaign] = useState("");
  const [saving, setSaving] = useState(false);

  const baseUrl = getPublicAppUrl();

  async function refresh() {
    setLoading(true);
    try {
      const [s, n] = await Promise.all([fetchSlugs(), fetchNumbers()]);
      setSlugs(s as any[]);
      setNumbers(n as any[]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!slug || !display) return;
    setSaving(true);
    try {
      await upsert({
        data: {
          slug,
          display_phone_number: display,
          phone_number_id: phoneNumberId || undefined,
          prefill_message: prefill || undefined,
          utm_source: utmSource || undefined,
          utm_medium: utmMedium || undefined,
          utm_campaign: utmCampaign || undefined,
        },
      });
      toast.success("Slug criado");
      setSlug("");
      setDisplay("");
      setPhoneNumberId("");
      setPrefill("");
      setUtmSource("");
      setUtmMedium("");
      setUtmCampaign("");
      refresh();
    } catch (err: any) {
      toast.error(err?.message || "Falha");
    } finally {
      setSaving(false);
    }
  }

  function copyLink(s: string) {
    const url = `${baseUrl}/wa/${s}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  }

  return (
    <div className="container mx-auto max-w-5xl py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Click-to-WhatsApp (Ads)</h1>
        <p className="text-muted-foreground text-sm">
          Crie links curtos <code>/wa/$slug</code> para usar em anúncios. O CRM contabiliza cliques
          e atribui as conversas geradas.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="size-4" /> Novo slug
          </CardTitle>
          <CardDescription>O slug compõe a URL pública /wa/&lt;slug&gt;.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Slug *</Label>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                placeholder="black-friday"
              />
            </div>
            <div className="space-y-1">
              <Label>Número (display) *</Label>
              <Input
                value={display}
                onChange={(e) => setDisplay(e.target.value)}
                placeholder="+55 11 99999-0000"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>phone_number_id (opcional, para atribuição)</Label>
              <select
                className="border rounded h-9 px-2 w-full bg-background"
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
              >
                <option value="">—</option>
                {numbers.map((n) => (
                  <option key={n.id} value={n.phone_number_id}>
                    {n.display_phone_number} ({n.phone_number_id})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Mensagem pré-preenchida</Label>
              <Textarea
                value={prefill}
                onChange={(e) => setPrefill(e.target.value)}
                rows={2}
                placeholder="Olá! Vi o anúncio e quero saber mais."
              />
            </div>
            <div className="space-y-1">
              <Label>utm_source</Label>
              <Input
                value={utmSource}
                onChange={(e) => setUtmSource(e.target.value)}
                placeholder="facebook"
              />
            </div>
            <div className="space-y-1">
              <Label>utm_medium</Label>
              <Input
                value={utmMedium}
                onChange={(e) => setUtmMedium(e.target.value)}
                placeholder="cpc"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>utm_campaign</Label>
              <Input
                value={utmCampaign}
                onChange={(e) => setUtmCampaign(e.target.value)}
                placeholder="bf2025"
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <Loader2 className="size-4 animate-spin mr-2" />
                ) : (
                  <Plus className="size-4 mr-2" />
                )}
                Criar slug
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Slugs ativos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : slugs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum slug ainda.</p>
          ) : (
            slugs.map((s) => (
              <div
                key={s.id}
                className="border rounded-lg p-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-medium font-mono text-sm truncate">/wa/{s.slug}</div>
                    {!s.is_active && <Badge variant="secondary">inativo</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    → {s.display_phone_number}
                    {s.utm_campaign ? ` · ${s.utm_campaign}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    <MousePointerClick className="size-3 mr-1" /> {s.click_count}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyLink(s.slug)}
                    title="Copiar"
                  >
                    <Copy className="size-4" />
                  </Button>
                  <a href={`${baseUrl}/wa/${s.slug}`} target="_blank" rel="noreferrer">
                    <Button variant="ghost" size="icon" title="Abrir">
                      <ExternalLink className="size-4" />
                    </Button>
                  </a>
                  <Switch
                    checked={s.is_active}
                    onCheckedChange={async (v) => {
                      await upsert({
                        data: {
                          id: s.id,
                          slug: s.slug,
                          display_phone_number: s.display_phone_number,
                          phone_number_id: s.phone_number_id ?? undefined,
                          is_active: v,
                        },
                      });
                      refresh();
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      if (!(await confirmDialog("Apagar este slug?"))) return;
                      await remove({ data: { id: s.id } });
                      refresh();
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
