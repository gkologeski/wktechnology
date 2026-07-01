// Hunting · Templates — CRUD de mensagens iniciais para LinkedIn.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Mail, Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { AtsPageHeader, EmptyState, RowSkeleton, FormSection } from "@/components/ats/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { TokenPills } from "@/components/ui/token-pills";
import { HUNTING_TOKENS } from "@/lib/message-tokens-catalog";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  listHuntingTemplates,
  upsertHuntingTemplate,
  deleteHuntingTemplate,
} from "@/lib/ats/hunting.functions";

export const Route = createFileRoute("/_authenticated/(ats)/hunting/templates")({
  component: HuntingTemplatesPage,
});

const CHANNEL_LABEL: Record<string, string> = {
  linkedin_inmail: "InMail",
  linkedin_connect: "Convite",
  linkedin_message: "Mensagem",
};

type TemplateRow = {
  id: string;
  name: string;
  channel: string;
  subject: string | null;
  body: string;
  is_default: boolean | null;
};

function HuntingTemplatesPage() {
  const list = useServerFn(listHuntingTemplates);
  const upsert = useServerFn(upsertHuntingTemplate);
  const remove = useServerFn(deleteHuntingTemplate);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["hunting-templates"],
    queryFn: () => list(),
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TemplateRow | null>(null);
  const [form, setForm] = useState({
    name: "",
    channel: "linkedin_message" as "linkedin_inmail" | "linkedin_connect" | "linkedin_message",
    subject: "",
    body: "",
  });

  function openNew() {
    setEditing(null);
    setForm({ name: "", channel: "linkedin_message", subject: "", body: "" });
    setOpen(true);
  }
  function openEdit(t: TemplateRow) {
    setEditing(t);
    setForm({
      name: t.name,
      channel: t.channel as typeof form.channel,
      subject: t.subject ?? "",
      body: t.body,
    });
    setOpen(true);
  }

  const save = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          id: editing?.id,
          name: form.name.trim(),
          channel: form.channel,
          subject: form.subject.trim() || undefined,
          body: form.body,
        },
      }),
    onSuccess: () => {
      toast.success("Template salvo");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["hunting-templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Template removido");
      qc.invalidateQueries({ queryKey: ["hunting-templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const templates = (q.data?.templates ?? []) as TemplateRow[];

  return (
    <div className="flex flex-col gap-6 pb-10">
      <AtsPageHeader
        eyebrow="ATS · Hunting"
        title="Templates de mensagem"
        description="Variáveis suportadas: {{nome}}, {{primeiro_nome}}, {{empresa_atual}}, {{cargo_atual}}, {{localizacao}}, {{vaga}}, {{vaga_local}}"
        primaryAction={
          <Button size="sm" onClick={openNew}>
            <Plus className="mr-1 h-4 w-4" /> Novo template
          </Button>
        }
      />

      {q.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <RowSkeleton key={i} />)}
        </div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="Nenhum template ainda"
          description="Crie templates com variáveis pra reaproveitar mensagens iniciais no LinkedIn."
          action={
            <Button size="sm" onClick={openNew}>
              <Plus className="mr-1 h-4 w-4" /> Criar template
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{t.name}</p>
                      <Badge variant="outline" className="text-xs">
                        {CHANNEL_LABEL[t.channel] ?? t.channel}
                      </Badge>
                    </div>
                    {t.subject ? (
                      <p className="mt-1 truncate text-xs font-medium text-muted-foreground">
                        Assunto: {t.subject}
                      </p>
                    ) : null}
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {t.body}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(t)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Remover "${t.name}"?`)) del.mutate(t.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar template" : "Novo template"}</DialogTitle>
          </DialogHeader>
          <FormSection title="Conteúdo">
            <div className="grid gap-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label htmlFor="t-name">Nome</Label>
                  <Input
                    id="t-name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ex: Dev Delphi — primeiro contato"
                  />
                </div>
                <div>
                  <Label>Canal</Label>
                  <Select
                    value={form.channel}
                    onValueChange={(v) =>
                      setForm({ ...form, channel: v as typeof form.channel })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="linkedin_message">Mensagem direta</SelectItem>
                      <SelectItem value="linkedin_inmail">InMail</SelectItem>
                      <SelectItem value="linkedin_connect">Pedido de conexão</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {form.channel === "linkedin_inmail" && (
                <div>
                  <Label htmlFor="t-subject">Assunto (InMail)</Label>
                  <Input
                    id="t-subject"
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    placeholder="Oportunidade {{vaga}} na {{empresa_atual}}"
                  />
                  <TokenPills
                    className="mt-1.5"
                    tokens={HUNTING_TOKENS}
                    onInsert={(t) =>
                      setForm((f) => ({ ...f, subject: (f.subject ?? "") + t }))
                    }
                  />
                </div>
              )}
              <div>
                <Label htmlFor="t-body">Mensagem</Label>
                <Textarea
                  id="t-body"
                  rows={10}
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  placeholder={`Oi {{primeiro_nome}}, tudo bem?\n\nVi seu perfil e achei sua experiência em {{cargo_atual}} muito relevante pra uma vaga de {{vaga}} que estamos com aberta. Faz sentido conversar?`}
                />
                <TokenPills
                  className="mt-1.5"
                  tokens={HUNTING_TOKENS}
                  onInsert={(t) => setForm((f) => ({ ...f, body: (f.body ?? "") + t }))}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Limite do InMail: ~1900 caracteres. Pedido de conexão: 300.
                </p>
              </div>
            </div>
          </FormSection>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => save.mutate()}
              disabled={!form.name.trim() || !form.body.trim() || save.isPending}
            >
              {save.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
