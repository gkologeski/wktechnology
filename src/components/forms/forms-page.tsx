import { getPublicAppUrl } from "@/lib/app-url";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Save, Copy, ExternalLink, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { listForms, upsertForm, deleteForm, listFormSubmissions } from "@/lib/forms.functions";
import { confirmDialog } from "@/components/ui/confirm-dialog";

type FieldType = "text" | "email" | "tel" | "textarea" | "select" | "number";
type FormField = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
};
type DisplayMode = "inline" | "popup" | "slidein";
type PopupConfig = {
  trigger?: "load" | "time" | "scroll" | "exit_intent";
  delay_seconds?: number;
  scroll_percent?: number;
  frequency_days?: number;
  position?: "center" | "bottom-right" | "bottom-left";
  title?: string;
  description?: string;
};
type FormRow = {
  id: string;
  name: string;
  slug: string;
  target: "lead" | "contact";
  fields: FormField[];
  success_message: string;
  redirect_url: string | null;
  active: boolean;
  submit_count: number;
  display_mode: DisplayMode;
  popup_config: PopupConfig;
};

const EMPTY_FIELDS: FormField[] = [
  { key: "name", label: "Nome", type: "text", required: true },
  { key: "email", label: "Email", type: "email", required: true },
  { key: "phone", label: "Telefone", type: "tel" },
  { key: "message", label: "Mensagem", type: "textarea" },
];

const DEFAULT_POPUP: PopupConfig = {
  trigger: "time",
  delay_seconds: 5,
  scroll_percent: 50,
  frequency_days: 7,
  position: "center",
};

export function FormsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listForms);
  const upsertFn = useServerFn(upsertForm);
  const deleteFn = useServerFn(deleteForm);
  const q = useQuery({ queryKey: ["forms"], queryFn: () => listFn() });
  const [editing, setEditing] = useState<Partial<FormRow> | null>(null);
  const [viewing, setViewing] = useState<FormRow | null>(null);

  const save = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          id: editing?.id,
          name: editing?.name ?? "",
          slug: editing?.slug ?? "",
          target: (editing?.target as "lead" | "contact") ?? "lead",
          fields: (editing?.fields ?? []) as FormField[],
          success_message: editing?.success_message ?? "Obrigado pelo contato!",
          redirect_url: editing?.redirect_url ?? "",
          active: editing?.active ?? true,
          display_mode: (editing?.display_mode as DisplayMode) ?? "inline",
          popup_config: (editing?.popup_config as PopupConfig) ?? {},
        },
      }),
    onSuccess: () => {
      toast.success("Formulário salvo");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["forms"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Formulário excluído");
      qc.invalidateQueries({ queryKey: ["forms"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Formulários</h1>
          <p className="text-sm text-muted-foreground">
            Crie formulários públicos e incorpore no seu site. Cada envio gera um lead ou contato.
          </p>
        </div>
        <Button
          onClick={() =>
            setEditing({
              target: "lead",
              fields: EMPTY_FIELDS,
              active: true,
              success_message: "Obrigado pelo contato!",
              display_mode: "inline",
              popup_config: DEFAULT_POPUP,
            })
          }
        >
          <Plus className="mr-1 h-4 w-4" /> Novo formulário
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {q.isLoading && <p className="p-4 text-sm text-muted-foreground">Carregando...</p>}
          {q.data?.items.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">Nenhum formulário ainda.</p>
          )}
          <div className="divide-y">
            {q.data?.items.map((f) => {
              const row = f as unknown as FormRow;
              return (
                <div
                  key={row.id}
                  className="flex items-center justify-between p-3 hover:bg-[var(--row-hover)]"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{row.name}</span>
                      <Badge variant="outline">{row.target}</Badge>
                      <Badge variant="outline">
                        {row.display_mode === "popup"
                          ? "Pop-up"
                          : row.display_mode === "slidein"
                            ? "Slide-in"
                            : "Inline"}
                      </Badge>
                      {!row.active && <Badge variant="secondary">Inativo</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      /{row.slug} · {row.submit_count} envios
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setViewing(row)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(row)}>
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        if (await confirmDialog("Excluir formulário?")) del.mutate(row.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar" : "Novo"} formulário</DialogTitle>
          </DialogHeader>
          {editing && (
            <EditorBody
              editing={editing}
              setEditing={setEditing}
              onSave={() => save.mutate()}
              saving={save.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewing?.name} — envios & embed</DialogTitle>
          </DialogHeader>
          {viewing && <ViewerBody form={viewing} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditorBody({
  editing,
  setEditing,
  onSave,
  saving,
}: {
  editing: Partial<FormRow>;
  setEditing: (e: Partial<FormRow>) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const fields = (editing.fields ?? []) as FormField[];
  const update = (patch: Partial<FormRow>) => setEditing({ ...editing, ...patch });
  const updateField = (idx: number, patch: Partial<FormField>) => {
    const next = fields.slice();
    next[idx] = { ...next[idx], ...patch };
    update({ fields: next });
  };
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Nome</Label>
          <Input value={editing.name ?? ""} onChange={(e) => update({ name: e.target.value })} />
        </div>
        <div>
          <Label>Slug (URL pública)</Label>
          <Input
            value={editing.slug ?? ""}
            onChange={(e) =>
              update({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })
            }
            placeholder="contato-site"
          />
        </div>
        <div>
          <Label>Cria como</Label>
          <Select
            value={editing.target ?? "lead"}
            onValueChange={(v) => update({ target: v as "lead" | "contact" })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lead">Lead</SelectItem>
              <SelectItem value="contact">Contato</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <Switch checked={editing.active ?? true} onCheckedChange={(v) => update({ active: v })} />
          <Label>Ativo</Label>
        </div>
      </div>

      <div>
        <Label>Mensagem de sucesso</Label>
        <Input
          value={editing.success_message ?? ""}
          onChange={(e) => update({ success_message: e.target.value })}
        />
      </div>
      <div>
        <Label>URL de redirecionamento (opcional)</Label>
        <Input
          value={editing.redirect_url ?? ""}
          onChange={(e) => update({ redirect_url: e.target.value })}
          placeholder="https://..."
        />
      </div>

      <DisplaySection editing={editing} update={update} />

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label>Campos</Label>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              update({
                fields: [
                  ...fields,
                  { key: `field_${fields.length + 1}`, label: "Novo campo", type: "text" },
                ],
              })
            }
          >
            <Plus className="mr-1 h-3 w-3" /> Campo
          </Button>
        </div>
        <div className="space-y-2">
          {fields.map((f, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 rounded border p-2">
              <Input
                className="col-span-3"
                value={f.key}
                onChange={(e) =>
                  updateField(i, { key: e.target.value.replace(/[^a-zA-Z0-9_]/g, "_") })
                }
                placeholder="key"
              />
              <Input
                className="col-span-4"
                value={f.label}
                onChange={(e) => updateField(i, { label: e.target.value })}
                placeholder="Rótulo"
              />
              <Select
                value={f.type}
                onValueChange={(v) => updateField(i, { type: v as FieldType })}
              >
                <SelectTrigger className="col-span-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Texto</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="tel">Telefone</SelectItem>
                  <SelectItem value="number">Número</SelectItem>
                  <SelectItem value="textarea">Área</SelectItem>
                  <SelectItem value="select">Seleção</SelectItem>
                </SelectContent>
              </Select>
              <div className="col-span-2 flex items-center gap-1 text-xs">
                <Switch
                  checked={!!f.required}
                  onCheckedChange={(v) => updateField(i, { required: v })}
                />
                Obrig.
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="col-span-1"
                onClick={() => update({ fields: fields.filter((_, idx) => idx !== i) })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              {f.type === "select" && (
                <Textarea
                  className="col-span-12"
                  rows={2}
                  placeholder="Opções (uma por linha)"
                  value={(f.options ?? []).join("\n")}
                  onChange={(e) =>
                    updateField(i, {
                      options: e.target.value
                        .split("\n")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              )}
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Dica: use chaves <code>name</code>, <code>email</code>, <code>phone</code>,{" "}
          <code>company</code> para mapeamento automático para o lead/contato.
        </p>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={() => setEditing({})}>
          Cancelar
        </Button>
        <Button
          onClick={onSave}
          disabled={saving || !editing.name || !editing.slug || fields.length === 0}
        >
          <Save className="mr-1 h-4 w-4" /> Salvar
        </Button>
      </div>
    </div>
  );
}

function ViewerBody({ form }: { form: FormRow }) {
  const listSubs = useServerFn(listFormSubmissions);
  const q = useQuery({
    queryKey: ["form_submissions", form.id],
    queryFn: () => listSubs({ data: { form_id: form.id } }),
  });
  const origin = getPublicAppUrl();
  const publicUrl = `${origin}/api/public/forms/${form.slug}`;
  const isPopup = form.display_mode === "popup" || form.display_mode === "slidein";
  const embedHtml = isPopup
    ? `<script data-lovable-form-popup="${form.slug}" src="${origin}/api/public/forms/embed-js" async></script>`
    : `<div data-lovable-form="${form.slug}"></div>\n<script src="${origin}/api/public/forms/embed-js" async></script>`;

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copiado`));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Incorporar no seu site</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea readOnly rows={3} value={embedHtml} className="font-mono text-xs" />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => copy(embedHtml, "Embed")}>
              <Copy className="mr-1 h-4 w-4" /> Copiar embed
            </Button>
            <Button size="sm" variant="outline" onClick={() => copy(publicUrl, "URL")}>
              <Copy className="mr-1 h-4 w-4" /> Copiar URL de definição
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={publicUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1 h-4 w-4" /> Ver JSON
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Envios recentes ({q.data?.items.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {q.isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {q.data?.items.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum envio ainda.</p>
          )}
          <div className="space-y-2">
            {q.data?.items.map((s) => {
              const sub = s as unknown as {
                id: string;
                data: Record<string, string>;
                created_at: string;
                referer: string | null;
              };
              return (
                <div key={sub.id} className="rounded border p-2 text-xs">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-muted-foreground">
                      {new Date(sub.created_at).toLocaleString()}
                    </span>
                    {sub.referer && (
                      <span className="truncate text-muted-foreground" title={sub.referer}>
                        {sub.referer}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {Object.entries(sub.data).map(([k, v]) => (
                      <div key={k}>
                        <span className="font-medium">{k}:</span> {v}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DisplaySection({
  editing,
  update,
}: {
  editing: Partial<FormRow>;
  update: (patch: Partial<FormRow>) => void;
}) {
  const mode: DisplayMode = (editing.display_mode as DisplayMode) ?? "inline";
  const cfg: PopupConfig = (editing.popup_config as PopupConfig) ?? {};
  const updateCfg = (patch: Partial<PopupConfig>) => update({ popup_config: { ...cfg, ...patch } });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Exibição</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Modo</Label>
            <Select
              value={mode}
              onValueChange={(v) =>
                update({
                  display_mode: v as DisplayMode,
                  popup_config: v === "inline" ? {} : { ...DEFAULT_POPUP, ...cfg },
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inline">Inline (embed na página)</SelectItem>
                <SelectItem value="popup">Pop-up (modal)</SelectItem>
                <SelectItem value="slidein">Slide-in lateral</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mode !== "inline" && (
            <div>
              <Label>Gatilho</Label>
              <Select
                value={cfg.trigger ?? "time"}
                onValueChange={(v) => updateCfg({ trigger: v as PopupConfig["trigger"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="load">Ao carregar</SelectItem>
                  <SelectItem value="time">Após X segundos</SelectItem>
                  <SelectItem value="scroll">Após rolar X%</SelectItem>
                  <SelectItem value="exit_intent">Exit intent (sair)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {mode !== "inline" && (
          <>
            <div className="grid grid-cols-3 gap-3">
              {cfg.trigger === "time" && (
                <div>
                  <Label>Atraso (s)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={600}
                    value={cfg.delay_seconds ?? 5}
                    onChange={(e) => updateCfg({ delay_seconds: Number(e.target.value) })}
                  />
                </div>
              )}
              {cfg.trigger === "scroll" && (
                <div>
                  <Label>Scroll (%)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={cfg.scroll_percent ?? 50}
                    onChange={(e) => updateCfg({ scroll_percent: Number(e.target.value) })}
                  />
                </div>
              )}
              <div>
                <Label>Frequência (dias)</Label>
                <Input
                  type="number"
                  min={0}
                  max={365}
                  value={cfg.frequency_days ?? 7}
                  onChange={(e) => updateCfg({ frequency_days: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Posição</Label>
                <Select
                  value={cfg.position ?? "center"}
                  onValueChange={(v) => updateCfg({ position: v as PopupConfig["position"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="center">Centro</SelectItem>
                    <SelectItem value="bottom-right">Canto inferior direito</SelectItem>
                    <SelectItem value="bottom-left">Canto inferior esquerdo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Título do pop-up (opcional)</Label>
                <Input
                  value={cfg.title ?? ""}
                  onChange={(e) => updateCfg({ title: e.target.value })}
                  placeholder="Receba nosso material"
                />
              </div>
              <div>
                <Label>Descrição (opcional)</Label>
                <Input
                  value={cfg.description ?? ""}
                  onChange={(e) => updateCfg({ description: e.target.value })}
                  placeholder="Deixe seu email..."
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Frequência 0 = mostrar uma única vez por navegador. Exit intent só funciona em
              desktop; em mobile, há fallback de 60s.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
