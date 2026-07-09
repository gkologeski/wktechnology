import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mail, Send, FileText, Paperclip, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { sendGmailEmail } from "@/lib/email-send.functions";
import { listEmailAccounts } from "@/lib/email-accounts.functions";
import { listEmailTemplates, listEmailSnippets } from "@/lib/email-templates.functions";
import { renderTokens, expandSnippets, type TokenContext } from "@/lib/email-tokens";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isEmail } from "@/lib/validators";
import { RichHtmlEditor, htmlToPlain } from "@/components/rich-html-editor";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { SmartComposeMenu } from "@/components/ai/smart-compose-menu";
import { TokenPills } from "@/components/ui/token-pills";
import { EMAIL_TOKENS } from "@/lib/message-tokens-catalog";
import { useTokenInserter } from "@/lib/token-insert";


type Props = {
  defaultTo?: string;
  contactId?: string;
  leadId?: string;
  dealId?: string;
  companyId?: string;
  contactName?: string;
  tokenContext?: TokenContext;
  trigger?: ReactNode;
  onSent?: (threadId: string) => void;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
};

export function SendEmailDialog({
  defaultTo = "",
  contactId,
  leadId,
  dealId,
  companyId,
  contactName,
  tokenContext,
  trigger,
  onSent,
  open: openProp,
  onOpenChange,
}: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = onOpenChange ?? setOpenState;

  const [to, setTo] = useState(defaultTo);
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  type Attachment = { path: string; filename: string; content_type: string; size: number };
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_TOTAL = 25 * 1024 * 1024;
  const MAX_FILES = 10;

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || !files.length || !user) return;
    const currentBytes = attachments.reduce((s, a) => s + a.size, 0);
    const newFiles = Array.from(files);
    if (attachments.length + newFiles.length > MAX_FILES) {
      toast.error(`Máximo de ${MAX_FILES} anexos.`);
      return;
    }
    const addBytes = newFiles.reduce((s, f) => s + f.size, 0);
    if (currentBytes + addBytes > MAX_TOTAL) {
      toast.error("Total de anexos excede 25 MB.");
      return;
    }
    setUploading(true);
    try {
      const uploaded: Attachment[] = [];
      for (const f of newFiles) {
        const safeName = f.name.replace(/[^\w.\-]+/g, "_");
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
        const { error } = await supabase.storage
          .from("email-attachments")
          .upload(path, f, { contentType: f.type || "application/octet-stream", upsert: false });
        if (error) throw new Error(`${f.name}: ${error.message}`);
        uploaded.push({
          path,
          filename: f.name,
          content_type: f.type || "application/octet-stream",
          size: f.size,
        });
      }
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar anexo");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachment = async (idx: number) => {
    const a = attachments[idx];
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
    await supabase.storage.from("email-attachments").remove([a.path]).catch(() => {});
  };

  const subjectInserter = useTokenInserter<HTMLInputElement>(() => subject, setSubject);
  const insertBodyToken = (token: string) => {
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    const active = typeof document !== "undefined" ? document.activeElement : null;
    if (active && (active as HTMLElement).isContentEditable && sel && sel.rangeCount > 0) {
      try {
        document.execCommand("insertText", false, token);
        return;
      } catch {
        /* fallback below */
      }
    }
    setBody((prev) => (prev ?? "") + token);
  };


  const listAccounts = useServerFn(listEmailAccounts);
  const listTemplates = useServerFn(listEmailTemplates);
  const listSnippets = useServerFn(listEmailSnippets);
  const sendFn = useServerFn(sendGmailEmail);

  const accountsQ = useQuery({
    queryKey: ["email_accounts"],
    queryFn: () => listAccounts(),
    enabled: open,
  });
  const templatesQ = useQuery({
    queryKey: ["email_templates"],
    queryFn: () => listTemplates(),
    enabled: open,
  });
  const snippetsQ = useQuery({
    queryKey: ["email_snippets"],
    queryFn: () => listSnippets(),
    enabled: open,
  });

  useEffect(() => {
    if (open) setTo(defaultTo);
  }, [open, defaultTo]);

  const account = accountsQ.data?.items?.find((a) => a.status === "connected");

  const ctx = useMemo<TokenContext>(
    () => ({
      first_name: tokenContext?.first_name ?? contactName?.split(" ")[0] ?? "",
      last_name: tokenContext?.last_name ?? "",
      full_name: tokenContext?.full_name ?? contactName ?? "",
      email: tokenContext?.email ?? defaultTo,
      company: tokenContext?.company ?? "",
    }),
    [tokenContext, contactName, defaultTo],
  );

  const applyTemplate = (id: string) => {
    const t = templatesQ.data?.items.find((x) => x.id === id);
    if (!t) return;
    setSubject(renderTokens(t.subject ?? "", ctx));
    const tplBody = (t.body_html && t.body_html.trim()) ? t.body_html : (t.body_text ?? "");
    setBody(renderTokens(tplBody, ctx));
    toast.success(`Template "${t.name}" aplicado`);
  };

  const finalBody = useMemo(() => {
    const snips = snippetsQ.data?.items ?? [];
    return expandSnippets(renderTokens(body, ctx), snips);
  }, [body, ctx, snippetsQ.data]);

  const finalSubject = useMemo(() => renderTokens(subject, ctx), [subject, ctx]);
  const finalBodyText = useMemo(() => htmlToPlain(finalBody), [finalBody]);

  const sendMut = useMutation({
    mutationFn: () =>
      sendFn({
        data: {
          to,
          cc: cc.trim() ? cc : undefined,
          subject: finalSubject,
          body_text: finalBodyText,
          body_html: finalBody,
          contact_id: contactId,
          lead_id: leadId,
          deal_id: dealId,
          company_id: companyId,
          attachments: attachments.length ? attachments : undefined,
        },
      }),
    onSuccess: (res) => {
      toast.success("Email enviado");
      setOpen(false);
      setSubject("");
      setBody("");
      setCc("");
      setAttachments([]);
      qc.invalidateQueries({ queryKey: ["email_threads"] });
      onSent?.(res.thread_id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const formatSize = (n: number) => {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== undefined ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : openProp === undefined ? (
        <DialogTrigger asChild>
          <Button size="sm" variant="outline">
            <Mail className="mr-2 h-4 w-4" /> Email
          </Button>
        </DialogTrigger>
      ) : null}

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo email</DialogTitle>
          <DialogDescription>
            {contactName ? `Para ${contactName}` : "Enviar email via Gmail"}
            {account ? ` · de ${account.email}` : ""}
          </DialogDescription>
        </DialogHeader>

        {accountsQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando contas…</p>
        ) : !account ? (
          <div className="rounded-md border border-dashed p-4 text-sm">
            Nenhuma conta Gmail conectada.{" "}
            <Link to="/settings/email" className="underline">
              Conectar agora
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost" disabled={!templatesQ.data?.items.length}>
                    <FileText className="mr-2 h-4 w-4" />
                    {templatesQ.data?.items.length ? "Usar template" : "Sem templates"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {templatesQ.data?.items.map((t) => (
                    <DropdownMenuItem key={t.id} onSelect={() => applyTemplate(t.id)}>
                      {t.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Link
                to="/settings/email-templates"
                className="text-xs underline text-muted-foreground"
              >
                Gerenciar
              </Link>
            </div>
            <div>
              <Label>Para</Label>
              <Input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="alguem@email.com, outro@email.com"
              />
            </div>
            <div>
              <Label>Cc (opcional)</Label>
              <Input value={cc} onChange={(e) => setCc(e.target.value)} />
            </div>
            <div>
              <Label>Assunto</Label>
              <Input
                ref={subjectInserter.ref}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
              <TokenPills
                className="mt-2"
                tokens={EMAIL_TOKENS}
                onInsert={subjectInserter.insert}
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label>
                  Mensagem{" "}
                  <span className="text-xs text-muted-foreground">
                    · tokens <code>{"{{first_name}}"}</code> · snippets <code>/atalho</code>
                  </span>
                </Label>
                <SmartComposeMenu
                  channel="email"
                  currentText={body}
                  contactName={contactName}
                  onApply={setBody}
                />
              </div>
              <RichHtmlEditor value={body} onChange={setBody} minHeight={220} placeholder="Escreva sua mensagem…" />
              <TokenPills className="mt-2" tokens={EMAIL_TOKENS} onInsert={insertBodyToken} />

            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label>Anexos</Label>
                <span className="text-xs text-muted-foreground">
                  {attachments.length}/{MAX_FILES} · máx. 25 MB no total
                </span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleFilesSelected(e.target.files)}
              />
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || attachments.length >= MAX_FILES}
                >
                  {uploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Paperclip className="mr-2 h-4 w-4" />
                  )}
                  {uploading ? "Enviando…" : "Anexar arquivo"}
                </Button>
                {attachments.map((a, i) => (
                  <div
                    key={a.path}
                    className="flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 text-xs"
                  >
                    <Paperclip className="h-3 w-3" />
                    <span className="max-w-[180px] truncate" title={a.filename}>
                      {a.filename}
                    </span>
                    <span className="text-muted-foreground">({formatSize(a.size)})</span>
                    <button
                      type="button"
                      className="ml-1 rounded p-0.5 hover:bg-background"
                      onClick={() => removeAttachment(i)}
                      aria-label={`Remover ${a.filename}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            onClick={() => {
              const split = (s: string) =>
                s
                  .split(/[,;]/)
                  .map((x) => x.trim())
                  .filter(Boolean);
              const toList = split(to);
              const ccList = split(cc);
              if (toList.length === 0) {
                toast.error("Informe ao menos um destinatário.");
                return;
              }
              const bad = [...toList, ...ccList].find((e) => !isEmail(e));
              if (bad) {
                toast.error(`Email inválido: ${bad}`);
                return;
              }
              sendMut.mutate();
            }}
            disabled={
              !account ||
              !to ||
              !finalSubject.trim() ||
              !finalBodyText.trim() ||
              sendMut.isPending ||
              uploading
            }
          >
            <Send className="mr-2 h-4 w-4" />
            {sendMut.isPending ? "Enviando…" : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

