import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Megaphone, Play, Pause, X, Plus } from "lucide-react";
import {
  createWhatsAppCampaign,
  listWhatsAppCampaigns,
  setWhatsAppCampaignStatus,
} from "@/lib/whatsapp-campaigns.functions";
import { listWhatsAppTemplates } from "@/lib/whatsapp.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/campaigns/whatsapp")({
  component: CampaignsPage,
});

function parseRecipients(raw: string): { phone: string; variables: Record<string, string> }[] {
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const parts = l.split(/[,;\t]/).map((p) => p.trim());
      const phone = parts[0];
      const variables: Record<string, string> = {};
      parts.slice(1).forEach((v, i) => {
        variables[String(i + 1)] = v;
      });
      return { phone, variables };
    });
}

function CampaignsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listWhatsAppCampaigns);
  const tmplFn = useServerFn(listWhatsAppTemplates);
  const createFn = useServerFn(createWhatsAppCampaign);
  const statusFn = useServerFn(setWhatsAppCampaignStatus);

  const { data: items = [] } = useQuery({
    queryKey: ["wa-campaigns"],
    queryFn: () => listFn(),
    refetchInterval: 5000,
  });
  const { data: templates = [] } = useQuery({
    queryKey: ["wa-templates"],
    queryFn: () => tmplFn(),
  });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [templateName, setTemplateName] = useState<string>("__none__");
  const [rate, setRate] = useState(10);
  const [recipientsRaw, setRecipientsRaw] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");

  const selectedTpl = templates.find((t) => t.name === templateName);
  const isHsm = !!selectedTpl?.contentSid;

  const create = useMutation({
    mutationFn: async () => {
      const recipients = parseRecipients(recipientsRaw);
      if (recipients.length === 0) throw new Error("Adicione pelo menos um destinatário");

      // Para HSM monta content_variables_template a partir de {{1}}..{{N}}
      let content_variables_template: Record<string, string> | undefined;
      if (isHsm && selectedTpl?.variableCount) {
        content_variables_template = {};
        for (let i = 1; i <= selectedTpl.variableCount; i++) {
          content_variables_template[String(i)] = `{{${i}}}`;
        }
      }

      return createFn({
        data: {
          name,
          body_template: selectedTpl?.body ?? body,
          template_name: templateName !== "__none__" ? templateName : undefined,
          content_sid: selectedTpl?.contentSid || undefined,
          content_variables_template,
          media_url: mediaUrl || undefined,
          rate_per_minute: rate,
          recipients,
        },
      });
    },
    onSuccess: () => {
      toast.success("Campanha criada como rascunho");
      setOpen(false);
      setName("");
      setBody("");
      setRecipientsRaw("");
      setMediaUrl("");
      qc.invalidateQueries({ queryKey: ["wa-campaigns"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeStatus = useMutation({
    mutationFn: (vars: { id: string; status: "running" | "paused" | "canceled" }) =>
      statusFn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wa-campaigns"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Megaphone className="h-6 w-6" /> Campanhas WhatsApp
          </h1>
          <p className="text-sm text-muted-foreground">
            Disparos em massa com fila e limite de mensagens por minuto.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" /> Nova campanha
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Nova campanha</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Nome</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Black Friday Outubro"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Template</label>
                  <Select value={templateName} onValueChange={setTemplateName}>
                    <SelectTrigger>
                      <SelectValue placeholder="Nenhum (texto livre)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nenhum (texto livre)</SelectItem>
                      {templates.map((t) => (
                        <SelectItem key={t.name} value={t.name}>
                          {t.name} {t.contentSid ? "· HSM oficial" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Msgs por minuto</label>
                  <Input
                    type="number"
                    min={1}
                    max={120}
                    value={rate}
                    onChange={(e) => setRate(Number(e.target.value))}
                  />
                </div>
              </div>
              {!isHsm && (
                <div>
                  <label className="text-xs text-muted-foreground">
                    Mensagem (use {`{{1}}, {{2}}`} para variáveis)
                  </label>
                  <Textarea
                    rows={3}
                    value={selectedTpl?.body ?? body}
                    onChange={(e) => setBody(e.target.value)}
                    disabled={!!selectedTpl}
                  />
                </div>
              )}
              {isHsm && (
                <p className="text-xs text-muted-foreground">
                  Template HSM oficial — corpo aprovado pela Meta. Use as colunas após o telefone
                  para as {selectedTpl?.variableCount ?? 0} variáveis.
                </p>
              )}
              <div>
                <label className="text-xs text-muted-foreground">URL de mídia (opcional)</label>
                <Input
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">
                  Destinatários (um por linha: telefone,var1,var2…)
                </label>
                <Textarea
                  rows={8}
                  value={recipientsRaw}
                  onChange={(e) => setRecipientsRaw(e.target.value)}
                  placeholder={"+5511999999999,João,14h\n+5511888888888,Maria,16h"}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {parseRecipients(recipientsRaw).length} destinatário(s)
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => create.mutate()} disabled={create.isPending || !name}>
                Criar rascunho
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="divide-y">
        {items.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma campanha ainda.
          </div>
        )}
        {items.map((c) => (
          <div key={c.id} className="p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Link to="/campaigns/whatsapp" className="font-medium truncate hover:underline">
                  {c.name}
                </Link>
                <Badge variant={c.status === "running" ? "default" : "secondary"}>{c.status}</Badge>
                <Badge variant="outline">{c.rate_per_minute}/min</Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {c.sent}/{c.total} enviadas · {c.failed} falhas
                {c.started_at ? ` · iniciou ${formatDateTime(c.started_at)}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {c.status !== "running" && c.status !== "completed" && c.status !== "canceled" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => changeStatus.mutate({ id: c.id, status: "running" })}
                >
                  <Play className="h-4 w-4 mr-1" /> Iniciar
                </Button>
              )}
              {c.status === "running" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => changeStatus.mutate({ id: c.id, status: "paused" })}
                >
                  <Pause className="h-4 w-4 mr-1" /> Pausar
                </Button>
              )}
              {(c.status === "running" || c.status === "paused" || c.status === "draft") && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => changeStatus.mutate({ id: c.id, status: "canceled" })}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
