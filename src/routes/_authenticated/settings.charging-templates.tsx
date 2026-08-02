import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Trash2, Mail, MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  listChargingTemplates,
  upsertChargingTemplate,
  deleteChargingTemplate,
} from "@/lib/charging-templates.functions";

export const Route = createFileRoute("/_authenticated/settings/charging-templates")({
  component: ChargingTemplatesPage,
});

type Channel = "email" | "whatsapp";
type TemplateRow = {
  id: string;
  name: string;
  channel: Channel;
  subject: string | null;
  body: string;
  active: boolean;
};

const TOKENS = [
  "{invoice_number}",
  "{amount}",
  "{currency}",
  "{due_date}",
  "{days_overdue}",
  "{customer_name}",
];

function ChargingTemplatesPage() {
  const list = useServerFn(listChargingTemplates);
  const upsert = useServerFn(upsertChargingTemplate);
  const del = useServerFn(deleteChargingTemplate);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["charging-templates"],
    queryFn: () => list(),
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<Channel>("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  function reset() {
    setEditingId(null);
    setName("");
    setChannel("email");
    setSubject("");
    setBody("");
    setActive(true);
  }

  function load(t: TemplateRow) {
    setEditingId(t.id);
    setName(t.name);
    setChannel(t.channel);
    setSubject(t.subject ?? "");
    setBody(t.body);
    setActive(t.active);
  }

  async function save() {
    if (!name || !body) {
      toast.error("Preencha nome e corpo");
      return;
    }
    setSaving(true);
    try {
      await upsert({
        data: {
          id: editingId ?? undefined,
          name,
          channel,
          subject: channel === "email" ? subject || null : null,
          body,
          active,
        },
      });
      toast.success("Template salvo");
      qc.invalidateQueries({ queryKey: ["charging-templates"] });
      qc.invalidateQueries({ queryKey: ["charging-templates-by-channel"] });
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!(await confirmDialog("Excluir template?"))) return;
    try {
      await del({ data: { id } });
      qc.invalidateQueries({ queryKey: ["charging-templates"] });
      if (editingId === id) reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  }

  function insertToken(t: string) {
    setBody((prev) => `${prev}${t}`);
  }

  return (
    <div className="space-y-4 p-6 max-w-5xl">
      <PageHeader
        title="Templates de cobrança"
        description="Modelos reutilizáveis de e-mail e WhatsApp usados pela régua de cobrança."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Templates</CardTitle>
            <Button size="sm" variant="outline" onClick={reset}>
              <Plus className="mr-1 h-4 w-4" /> Novo
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : !data?.templates?.length ? (
              <p className="text-sm text-muted-foreground">Nenhum template cadastrado.</p>
            ) : (
              <ul className="space-y-1">
                {(data.templates as TemplateRow[]).map((t) => (
                  <li
                    key={t.id}
                    className={`flex items-center justify-between rounded border p-2 ${editingId === t.id ? "bg-muted/50" : ""}`}
                  >
                    <button className="flex-1 text-left text-sm" onClick={() => load(t)}>
                      <div className="flex items-center gap-2">
                        {t.channel === "email" ? (
                          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        <span className="font-medium">{t.name}</span>
                        {!t.active && (
                          <Badge variant="outline" className="text-xs">
                            inativo
                          </Badge>
                        )}
                      </div>
                      {t.subject && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {t.subject}
                        </p>
                      )}
                    </button>
                    <Button variant="ghost" size="icon" onClick={() => remove(t.id)}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {editingId ? "Editar template" : "Novo template"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name">Nome</Label>
              <Input
                id="tpl-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Lembrete D+1"
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Canal</Label>
                <Select value={channel} onValueChange={(v) => setChannel(v as Channel)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between pt-6">
                <Label htmlFor="tpl-active">Ativo</Label>
                <Switch id="tpl-active" checked={active} onCheckedChange={setActive} />
              </div>
            </div>
            {channel === "email" && (
              <div className="space-y-1.5">
                <Label htmlFor="tpl-subject">Assunto</Label>
                <Input
                  id="tpl-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Fatura {invoice_number} — lembrete"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="tpl-body">Mensagem</Label>
              <Textarea
                id="tpl-body"
                rows={7}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Olá {customer_name}, sua fatura {invoice_number} de {amount} vence em {due_date}."
              />
              <div className="flex flex-wrap gap-1 pt-1">
                {TOKENS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => insertToken(t)}
                    className="rounded-full border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={save} disabled={saving} className="w-full">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar template
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
