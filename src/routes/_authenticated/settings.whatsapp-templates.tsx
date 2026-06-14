import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, RefreshCw, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listWabas,
  listTemplates,
  syncTemplates,
  submitTemplate,
} from "@/lib/whatsapp-meta.functions";

export const Route = createFileRoute("/_authenticated/settings/whatsapp-templates")({
  component: TemplatesPage,
});

const CATEGORIES = ["MARKETING", "UTILITY", "AUTHENTICATION"] as const;
const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive"> = {
  APPROVED: "default",
  PENDING: "secondary",
  REJECTED: "destructive",
};

function TemplatesPage() {
  const fetchWabas = useServerFn(listWabas);
  const fetchTpls = useServerFn(listTemplates);
  const sync = useServerFn(syncTemplates);
  const submit = useServerFn(submitTemplate);

  const [wabas, setWabas] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New template form
  const [wabaId, setWabaId] = useState("");
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("pt_BR");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("UTILITY");
  const [bodyText, setBodyText] = useState("");
  const [headerText, setHeaderText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const [w, t] = await Promise.all([fetchWabas(), fetchTpls()]);
      setWabas(w as any[]);
      setTemplates(t as any[]);
      if (!wabaId && (w as any[]).length) setWabaId((w as any[])[0].id);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  async function onSync(rowId: string) {
    await sync({ data: { waba_row_id: rowId } });
    toast.success("Templates sincronizados");
    refresh();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!wabaId || !name || !bodyText) return;
    setSubmitting(true);
    try {
      const components: any[] = [{ type: "BODY", text: bodyText }];
      if (headerText) components.unshift({ type: "HEADER", format: "TEXT", text: headerText });
      if (footerText) components.push({ type: "FOOTER", text: footerText });
      await submit({ data: { waba_row_id: wabaId, name, language, category, components } });
      toast.success("Template enviado para aprovação");
      setName("");
      setBodyText("");
      setHeaderText("");
      setFooterText("");
      refresh();
    } catch (err: any) {
      toast.error(err?.message || "Falha ao submeter");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container mx-auto max-w-5xl py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Templates WhatsApp (HSM)</h1>
        <p className="text-muted-foreground text-sm">
          Modelos aprovados pela Meta para envio fora da janela de 24h.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="size-4" /> Novo template
          </CardTitle>
          <CardDescription>
            O nome precisa ser único, snake_case (a-z, 0-9, _). A aprovação leva 1–24h.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>WABA</Label>
              <Select value={wabaId} onValueChange={setWabaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha…" />
                </SelectTrigger>
                <SelectContent>
                  {wabas.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.business_name || w.waba_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={(v: any) => setCategory(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                placeholder="lembrete_reuniao"
              />
            </div>
            <div className="space-y-1">
              <Label>Idioma</Label>
              <Input
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder="pt_BR"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Header (opcional, texto)</Label>
              <Input
                value={headerText}
                onChange={(e) => setHeaderText(e.target.value)}
                placeholder="Confirmação de reunião"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Body *</Label>
              <Textarea
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                rows={4}
                placeholder="Olá {{1}}, sua reunião está confirmada para {{2}}."
              />
              <p className="text-xs text-muted-foreground">
                Use {`{{1}}`}, {`{{2}}`} para variáveis posicionais.
              </p>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Footer (opcional)</Label>
              <Input
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                placeholder="Equipe Atendimento"
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={submitting || !wabaId || !name || !bodyText}>
                {submitting ? (
                  <Loader2 className="size-4 animate-spin mr-2" />
                ) : (
                  <Send className="size-4 mr-2" />
                )}
                Enviar para aprovação
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Templates</CardTitle>
          {wabaId && (
            <Button variant="outline" size="sm" onClick={() => onSync(wabaId)}>
              <RefreshCw className="size-4 mr-1" /> Sincronizar com Meta
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum template ainda.</p>
          ) : (
            <div className="space-y-2">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className="border rounded-lg p-3 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium font-mono text-sm">{t.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {t.language} · {t.category}
                    </div>
                    {t.rejection_reason && (
                      <div className="text-xs text-destructive mt-1">
                        Recusa: {t.rejection_reason}
                      </div>
                    )}
                  </div>
                  <Badge variant={STATUS_COLORS[t.status] || "secondary"}>{t.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
