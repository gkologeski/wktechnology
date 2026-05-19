import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { sendGmailEmail } from "@/lib/email-send.functions";
import { listEmailAccounts } from "@/lib/email-accounts.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

type Props = {
  defaultTo?: string;
  contactId?: string;
  leadId?: string;
  dealId?: string;
  companyId?: string;
  contactName?: string;
  trigger?: ReactNode;
  onSent?: (threadId: string) => void;
};

export function SendEmailDialog({
  defaultTo = "",
  contactId,
  leadId,
  dealId,
  companyId,
  contactName,
  trigger,
  onSent,
}: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(defaultTo);
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const listAccounts = useServerFn(listEmailAccounts);
  const sendFn = useServerFn(sendGmailEmail);

  const accountsQ = useQuery({
    queryKey: ["email_accounts"],
    queryFn: () => listAccounts(),
    enabled: open,
  });

  useEffect(() => {
    if (open) setTo(defaultTo);
  }, [open, defaultTo]);

  const account = accountsQ.data?.items?.find((a) => a.status === "connected");

  const sendMut = useMutation({
    mutationFn: () =>
      sendFn({
        data: {
          to,
          cc: cc.trim() ? cc : undefined,
          subject,
          body_text: body,
          body_html: `<div style="white-space:pre-wrap;font-family:system-ui,sans-serif">${escape(body)}</div>`,
          contact_id: contactId,
          lead_id: leadId,
          deal_id: dealId,
          company_id: companyId,
        },
      }),
    onSuccess: (res) => {
      toast.success("Email enviado");
      setOpen(false);
      setSubject("");
      setBody("");
      setCc("");
      qc.invalidateQueries({ queryKey: ["email_threads"] });
      onSent?.(res.thread_id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline">
            <Mail className="mr-2 h-4 w-4" /> Email
          </Button>
        )}
      </DialogTrigger>
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
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div>
              <Label>Mensagem</Label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            onClick={() => sendMut.mutate()}
            disabled={!account || !to || !subject.trim() || !body.trim() || sendMut.isPending}
          >
            <Send className="mr-2 h-4 w-4" />
            {sendMut.isPending ? "Enviando…" : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function escape(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
