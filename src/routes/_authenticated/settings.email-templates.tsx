import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RichHtmlEditor, htmlToPlain } from "@/components/rich-html-editor";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  listEmailTemplates,
  upsertEmailTemplate,
  deleteEmailTemplate,
  listEmailSnippets,
  upsertEmailSnippet,
  deleteEmailSnippet,
} from "@/lib/email-templates.functions";
import { TokenPills } from "@/components/ui/token-pills";
import { EMAIL_TOKENS } from "@/lib/message-tokens-catalog";

export const Route = createFileRoute("/_authenticated/settings/email-templates")({
  component: EmailTemplatesPage,
});

type Template = {
  id: string;
  name: string;
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
};
type Snippet = { id: string; shortcut: string; body: string };

function EmailTemplatesPage() {
  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Templates & snippets de email</h1>
        <p className="text-sm text-muted-foreground">
          Tokens disponíveis: <code>{"{{first_name}}"}</code>, <code>{"{{last_name}}"}</code>,{" "}
          <code>{"{{full_name}}"}</code>, <code>{"{{email}}"}</code>, <code>{"{{company}}"}</code>.
        </p>
      </div>
      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="snippets">Snippets</TabsTrigger>
        </TabsList>
        <TabsContent value="templates" className="mt-4">
          <TemplatesSection />
        </TabsContent>
        <TabsContent value="snippets" className="mt-4">
          <SnippetsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TemplatesSection() {
  const qc = useQueryClient();
  const listFn = useServerFn(listEmailTemplates);
  const upsertFn = useServerFn(upsertEmailTemplate);
  const deleteFn = useServerFn(deleteEmailTemplate);
  const q = useQuery({ queryKey: ["email_templates"], queryFn: () => listFn() });
  const [editing, setEditing] = useState<Partial<Template> | null>(null);

  const save = useMutation({
    mutationFn: () => {
      const html = editing?.body_html ?? "";
      return upsertFn({
        data: {
          id: editing?.id,
          name: editing?.name ?? "",
          subject: editing?.subject ?? "",
          body_html: html,
          body_text: htmlToPlain(html),
        },
      });
    },
    onSuccess: () => {
      toast.success("Template salvo");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["email_templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Template excluído");
      qc.invalidateQueries({ queryKey: ["email_templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Lista</CardTitle>
          <Button size="sm" onClick={() => setEditing({ name: "", subject: "", body_text: "" })}>
            <Plus className="mr-1 h-4 w-4" /> Novo
          </Button>
        </CardHeader>
        <CardContent className="space-y-1">
          {q.data?.items.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum template ainda.</p>
          )}
          {q.data?.items.map((t) => (
            <button
              key={t.id}
              onClick={() => setEditing(t as Template)}
              className={`w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted ${
                editing?.id === t.id ? "bg-muted" : ""
              }`}
            >
              <div className="font-medium">{t.name}</div>
              <div className="truncate text-xs text-muted-foreground">{t.subject}</div>
            </button>
          ))}
        </CardContent>
      </Card>

      {editing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{editing.id ? "Editar" : "Novo"} template</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input
                value={editing.name ?? ""}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Assunto</Label>
              <Input
                value={editing.subject ?? ""}
                onChange={(e) => setEditing({ ...editing, subject: e.target.value })}
                placeholder="Olá {{first_name}}"
              />
              <TokenPills
                className="mt-2"
                tokens={EMAIL_TOKENS}
                onInsert={(t) =>
                  setEditing((prev) => ({ ...(prev ?? {}), subject: (prev?.subject ?? "") + t }))
                }
              />
            </div>
            <div>
              <Label>Mensagem</Label>
              <RichHtmlEditor
                value={editing.body_html ?? editing.body_text ?? ""}
                onChange={(html) => setEditing({ ...editing, body_html: html })}
                minHeight={260}
                placeholder="Escreva a mensagem do template…"
              />
              <TokenPills
                className="mt-2"
                tokens={EMAIL_TOKENS}
                onInsert={(t) => {
                  const active = typeof document !== "undefined" ? document.activeElement : null;
                  if (active && (active as HTMLElement).isContentEditable) {
                    try {
                      document.execCommand("insertText", false, t);
                      return;
                    } catch {
                      /* fallback */
                    }
                  }
                  setEditing((prev) => ({
                    ...(prev ?? {}),
                    body_html: (prev?.body_html ?? prev?.body_text ?? "") + t,
                  }));
                }}
              />
            </div>

            <div className="flex justify-between gap-2">
              {editing.id ? (
                <Button variant="destructive" size="sm" onClick={() => del.mutate(editing.id!)}>
                  <Trash2 className="mr-1 h-4 w-4" /> Excluir
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setEditing(null)}>
                  Cancelar
                </Button>
                <Button onClick={() => save.mutate()} disabled={save.isPending || !editing.name}>
                  <Save className="mr-1 h-4 w-4" /> Salvar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SnippetsSection() {
  const qc = useQueryClient();
  const listFn = useServerFn(listEmailSnippets);
  const upsertFn = useServerFn(upsertEmailSnippet);
  const deleteFn = useServerFn(deleteEmailSnippet);
  const q = useQuery({ queryKey: ["email_snippets"], queryFn: () => listFn() });
  const [editing, setEditing] = useState<Partial<Snippet> | null>(null);

  const save = useMutation({
    mutationFn: () =>
      upsertFn({
        data: { id: editing?.id, shortcut: editing?.shortcut ?? "", body: editing?.body ?? "" },
      }),
    onSuccess: () => {
      toast.success("Snippet salvo");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["email_snippets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Snippet excluído");
      qc.invalidateQueries({ queryKey: ["email_snippets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Lista</CardTitle>
          <Button size="sm" onClick={() => setEditing({ shortcut: "", body: "" })}>
            <Plus className="mr-1 h-4 w-4" /> Novo
          </Button>
        </CardHeader>
        <CardContent className="space-y-1">
          {q.data?.items.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhum snippet ainda. Use <code>/atalho</code> no corpo.
            </p>
          )}
          {q.data?.items.map((s) => (
            <button
              key={s.id}
              onClick={() => setEditing(s as Snippet)}
              className={`w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted ${
                editing?.id === s.id ? "bg-muted" : ""
              }`}
            >
              <div className="font-mono text-xs">/{s.shortcut}</div>
              <div className="truncate text-xs text-muted-foreground">{s.body}</div>
            </button>
          ))}
        </CardContent>
      </Card>

      {editing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{editing.id ? "Editar" : "Novo"} snippet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Atalho (sem barra)</Label>
              <Input
                value={editing.shortcut ?? ""}
                onChange={(e) => setEditing({ ...editing, shortcut: e.target.value })}
                placeholder="assinatura"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Digite <code>/{editing.shortcut || "atalho"}</code> no corpo do email para expandir.
              </p>
            </div>
            <div>
              <Label>Conteúdo</Label>
              <Textarea
                value={editing.body ?? ""}
                onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                rows={8}
              />
              <TokenPills
                className="mt-2"
                tokens={EMAIL_TOKENS}
                onInsert={(t) =>
                  setEditing((prev) => ({ ...(prev ?? {}), body: (prev?.body ?? "") + t }))
                }
              />
            </div>

            <div className="flex justify-between gap-2">
              {editing.id ? (
                <Button variant="destructive" size="sm" onClick={() => del.mutate(editing.id!)}>
                  <Trash2 className="mr-1 h-4 w-4" /> Excluir
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setEditing(null)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => save.mutate()}
                  disabled={save.isPending || !editing.shortcut || !editing.body}
                >
                  <Save className="mr-1 h-4 w-4" /> Salvar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
