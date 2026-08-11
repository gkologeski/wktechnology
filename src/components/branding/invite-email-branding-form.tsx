// Editor de branding do e-mail de convite (textos, assunto, botão, notas).
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getInviteSettings, saveInviteSettings } from "@/lib/workspace-invite-settings.functions";

type Settings = {
  subject: string | null;
  greeting: string | null;
  body_intro: string | null;
  cta_label: string | null;
  footer_note: string | null;
  expires_note: string | null;
  product_name: string | null;
};

const DEFAULTS: Settings = {
  subject: "Convite para o {{workspace}} — {{product}}",
  greeting: "Olá {{email}},",
  body_intro:
    "{{inviter}} convidou você para acessar o workspace {{workspace}} do {{product}} como {{role}}. Ao aceitar, você criará sua senha e poderá entrar imediatamente.",
  cta_label: "Aceitar convite",
  expires_note: "Este convite expira em {{expiresAt}}.",
  footer_note: "Se você não esperava este e-mail, pode ignorá-lo com segurança.",
  product_name: "TechERP",
};

export function InviteEmailBrandingForm() {
  const qc = useQueryClient();
  const getFn = useServerFn(getInviteSettings);
  const saveFn = useServerFn(saveInviteSettings);
  const { data, isLoading } = useQuery({
    queryKey: ["invite-settings"],
    queryFn: () => getFn(),
  });

  const [form, setForm] = useState<Settings>(DEFAULTS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.settings) {
      setForm({
        subject: data.settings.subject ?? DEFAULTS.subject,
        greeting: data.settings.greeting ?? DEFAULTS.greeting,
        body_intro: data.settings.body_intro ?? DEFAULTS.body_intro,
        cta_label: data.settings.cta_label ?? DEFAULTS.cta_label,
        footer_note: data.settings.footer_note ?? DEFAULTS.footer_note,
        expires_note: data.settings.expires_note ?? DEFAULTS.expires_note,
        product_name: data.settings.product_name ?? DEFAULTS.product_name,
      });
    }
  }, [data]);

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async () => {
    setSaving(true);
    try {
      await saveFn({ data: form });
      await qc.invalidateQueries({ queryKey: ["invite-settings"] });
      toast.success("Configuração de convite salva.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = () => setForm(DEFAULTS);

  return (
    <Card>
      <CardHeader>
        <CardTitle>E-mail de convite</CardTitle>
        <CardDescription>
          Personalize o texto e o botão do e-mail enviado ao convidar novos usuários. Variáveis
          disponíveis:{" "}
          <code className="text-xs">
            {"{{email}} {{inviter}} {{workspace}} {{role}} {{product}} {{expiresAt}}"}
          </code>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ib-product">Nome do sistema/produto</Label>
                <Input
                  id="ib-product"
                  value={form.product_name ?? ""}
                  placeholder="TechERP"
                  onChange={(e) => set("product_name", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ib-cta">Rótulo do botão</Label>
                <Input
                  id="ib-cta"
                  value={form.cta_label ?? ""}
                  placeholder="Aceitar convite"
                  onChange={(e) => set("cta_label", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ib-subject">Assunto do e-mail</Label>
              <Input
                id="ib-subject"
                value={form.subject ?? ""}
                onChange={(e) => set("subject", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ib-greet">Saudação</Label>
              <Input
                id="ib-greet"
                value={form.greeting ?? ""}
                onChange={(e) => set("greeting", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ib-intro">Texto principal</Label>
              <Textarea
                id="ib-intro"
                rows={4}
                value={form.body_intro ?? ""}
                onChange={(e) => set("body_intro", e.target.value)}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ib-exp">Aviso de expiração</Label>
                <Input
                  id="ib-exp"
                  value={form.expires_note ?? ""}
                  onChange={(e) => set("expires_note", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ib-foot">Rodapé</Label>
                <Input
                  id="ib-foot"
                  value={form.footer_note ?? ""}
                  onChange={(e) => set("footer_note", e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={resetDefaults} disabled={saving}>
                Restaurar padrão
              </Button>
              <Button onClick={submit} disabled={saving}>
                {saving ? "Salvando…" : "Salvar"}
              </Button>
            </div>

            <div className="rounded-md border p-4 bg-muted/30">
              <p className="text-xs font-medium mb-2 text-muted-foreground">Preview</p>
              <div className="text-sm space-y-2">
                <p>
                  <strong>Assunto:</strong>{" "}
                  {(form.subject || DEFAULTS.subject || "")
                    .replace(/\{\{workspace\}\}/g, "WK Technology")
                    .replace(/\{\{product\}\}/g, form.product_name || "TechERP")}
                </p>
                <p>{(form.greeting || "").replace(/\{\{email\}\}/g, "convidado@empresa.com")}</p>
                <p className="text-muted-foreground">
                  {(form.body_intro || "")
                    .replace(/\{\{inviter\}\}/g, "Maria")
                    .replace(/\{\{workspace\}\}/g, "WK Technology")
                    .replace(/\{\{role\}\}/g, "Membro")
                    .replace(/\{\{product\}\}/g, form.product_name || "TechERP")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(form.expires_note || "").replace(/\{\{expiresAt\}\}/g, "31/12/2026")}{" "}
                  {form.footer_note}
                </p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
