import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, PhoneCall, Save } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  dialLeadNow,
  listCallFollowupSenders,
  saveCampaignCallFollowup,
  type Campaign,
  type LeadAudit,
} from "@/lib/prospecting-campaigns.functions";
import type { ProspectingScript } from "@/lib/prospecting-scripts.functions";

const DEFAULT_SENDER = "__default__";

export function CampaignCallFollowup({
  campaign,
  scripts,
  leads,
  onChanged,
}: {
  campaign: Campaign;
  scripts: ProspectingScript[];
  leads: LeadAudit[];
  onChanged: () => void;
}) {
  const saveFn = useServerFn(saveCampaignCallFollowup);
  const sendersFn = useServerFn(listCallFollowupSenders);
  const dialFn = useServerFn(dialLeadNow);
  const [senders, setSenders] = useState<Array<{ id: string; label: string }>>([]);
  const [enabled, setEnabled] = useState(!!campaign.followup_enabled);
  const [sender, setSender] = useState(campaign.followup_sender_phone_number_id ?? DEFAULT_SENDER);
  const [template, setTemplate] = useState(campaign.followup_template_name ?? "");
  const [answered, setAnswered] = useState(campaign.followup_answered_text ?? "");
  const [saving, setSaving] = useState(false);
  const [testLead, setTestLead] = useState("");
  const [testScript, setTestScript] = useState("");
  const [dialing, setDialing] = useState(false);

  useEffect(() => {
    sendersFn().then(setSenders).catch(() => setSenders([]));
  }, [sendersFn]);
  useEffect(() => {
    if (!testScript && scripts[0]) setTestScript(scripts[0].id);
    if (!testLead && leads[0]) setTestLead(leads[0].lead_id);
  }, [scripts, leads, testScript, testLead]);

  const save = async () => {
    setSaving(true);
    try {
      await saveFn({
        data: {
          id: campaign.id,
          followup_enabled: enabled,
          followup_sender_phone_number_id: sender === DEFAULT_SENDER ? null : sender,
          followup_template_name: template.trim() || null,
          followup_template_language: campaign.followup_template_language ?? "pt_BR",
          followup_answered_text: answered.trim() || null,
        },
      });
      toast.success("WhatsApp pós-ligação salvo");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar");
    } finally {
      setSaving(false);
    }
  };

  const dial = async () => {
    setDialing(true);
    try {
      const out = await dialFn({
        data: { lead_id: testLead, script_id: testScript, followup_campaign_id: campaign.id },
      });
      if (out.ok) toast.success("Ligação iniciada. Atenda o celular.");
      else toast.error(out.error ?? "A ligação não foi iniciada");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "A ligação não foi iniciada");
    } finally {
      setDialing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>WhatsApp após a ligação</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Switch id="followup-enabled" checked={enabled} onCheckedChange={setEnabled} />
          <Label htmlFor="followup-enabled">
            Enviar WhatsApp automático quando a ligação terminar
          </Label>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Remetente</Label>
            <Select value={sender} onValueChange={setSender}>
              <SelectTrigger aria-label="Remetente do WhatsApp">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DEFAULT_SENDER}>Número padrão (Lia)</SelectItem>
                {senders.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="followup-template">Modelo aprovado (não atendeu)</Label>
            <Input
              id="followup-template"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              placeholder="prospeccao002"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="followup-answered">Mensagem quando atender (texto livre)</Label>
          <Textarea
            id="followup-answered"
            rows={3}
            value={answered}
            onChange={(e) => setAnswered(e.target.value)}
            placeholder="Oi {{lead.name}}, obrigada pela conversa! Te mando aqui os horários."
          />
          <p className="text-xs text-muted-foreground">
            Texto livre só sai se o cliente escreveu nas últimas 24 h; senão vai o modelo aprovado.
          </p>
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar WhatsApp pós-ligação
          </Button>
        </div>

        <div className="space-y-3 border-t pt-4">
          <p className="text-sm font-medium">Ligação de teste</p>
          <p className="text-xs text-muted-foreground">
            Liga agora para um lead desta campanha, sem iniciar a campanha.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Lead</Label>
              <Select value={testLead} onValueChange={setTestLead}>
                <SelectTrigger aria-label="Lead da ligação de teste">
                  <SelectValue placeholder="Adicione um lead ao público" />
                </SelectTrigger>
                <SelectContent>
                  {leads.map((l) => (
                    <SelectItem key={l.lead_id} value={l.lead_id}>
                      {l.lead_name} · {l.phone ?? "sem telefone"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Roteiro</Label>
              <Select value={testScript} onValueChange={setTestScript}>
                <SelectTrigger aria-label="Roteiro da ligação de teste">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {scripts.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={dial} disabled={dialing || !testLead || !testScript}>
            {dialing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PhoneCall className="mr-2 h-4 w-4" />
            )}
            Ligar para teste agora
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
