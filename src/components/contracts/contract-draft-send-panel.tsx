// ACEITE-MINUTA Entrega 3: envio da minuta aprovada ao cliente (e-mail ou link).
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link as LinkIcon, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmailInput } from "@/components/ui/email-input";
import { useCurrentUserId } from "@/hooks/use-current-user-id";
import { listEmailAccounts } from "@/lib/email-accounts.functions";
import { sendGmailEmail } from "@/lib/email-send.functions";
import {
  issueContractDraftLink,
  markContractDraftSent,
} from "@/lib/contracts/contract-drafts.functions";
import { getPublicAppUrl } from "@/lib/app-url";
import { parseEmailList } from "@/lib/email-address";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function ContractDraftSendPanel(props: {
  draftId: string;
  title: string;
  dealId: string | null;
  sent: boolean;
  onDone: () => void;
}) {
  const issue = useServerFn(issueContractDraftLink);
  const mark = useServerFn(markContractDraftSent);
  const listAccounts = useServerFn(listEmailAccounts);
  const sendMail = useServerFn(sendGmailEmail);
  const userId = useCurrentUserId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const accountsQ = useQuery({
    queryKey: ["email-accounts", "mine"],
    queryFn: () => listAccounts(),
    enabled: open,
  });
  const accounts = (accountsQ.data?.items ?? []).filter(
    (a) => a.provider === "gmail" && a.status !== "disconnected" && a.owner_id === userId,
  );
  useEffect(() => {
    if (!accountId && accounts[0]) setAccountId(accounts[0].id);
  }, [accounts, accountId]);
  useEffect(() => {
    if (!open) return;
    setSubject(`Minuta de contrato — ${props.title}`);
    setMessage(
      "Olá,\n\nSegue a minuta do contrato para sua análise. Pelo link abaixo você pode aceitar a minuta ou pedir ajustes.",
    );
  }, [open, props.title]);

  const linkFor = async () => {
    const { token } = await issue({ data: { id: props.draftId } });
    return `${getPublicAppUrl()}/minuta/${token}`;
  };

  const copy = async () => {
    setBusy(true);
    try {
      const link = await linkFor();
      await navigator.clipboard.writeText(link);
      await mark({ data: { id: props.draftId, to: null, channel: "link" } });
      toast.success("Link copiado. A minuta foi marcada como enviada.");
      props.onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    let list: string[];
    try {
      list = parseEmailList(to);
    } catch {
      return toast.error("Verifique os e-mails informados.");
    }
    if (!list.length) return toast.error("Informe ao menos um destinatário.");
    setBusy(true);
    try {
      const link = await linkFor();
      const paragraphs = message
        .split(/\n{2,}/)
        .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
        .join("");
      await sendMail({
        data: {
          account_id: accountId || undefined,
          to: list,
          subject,
          body_html: `${paragraphs}<p><a href="${esc(link)}">Abrir a minuta do contrato</a></p>`,
          body_text: `${message}\n\nAbrir a minuta: ${link}`,
          deal_id: props.dealId ?? undefined,
        },
      });
      try {
        await mark({ data: { id: props.draftId, to: list.join(", "), channel: "email" } });
      } catch (e) {
        toast.error(
          `E-mail enviado, mas a minuta não foi marcada como enviada: ${(e as Error).message}`,
        );
        return;
      }
      toast.success("Minuta enviada ao cliente por e-mail.");
      setOpen(false);
      props.onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const noAccount = accountsQ.isSuccess && accounts.length === 0;

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => setOpen(true)} disabled={busy}>
        <Mail className="mr-2 h-4 w-4" />
        {props.sent ? "Reenviar ao cliente por e-mail" : "Enviar ao cliente por e-mail"}
      </Button>
      <Button variant="outline" onClick={copy} disabled={busy}>
        {busy ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <LinkIcon className="mr-2 h-4 w-4" />
        )}
        Copiar link para o cliente
      </Button>
      <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Enviar minuta ao cliente</DialogTitle>
            <DialogDescription>
              O cliente recebe um link para aceitar a minuta ou pedir ajustes.
            </DialogDescription>
          </DialogHeader>
          {noAccount ? (
            <p className="text-sm text-muted-foreground" role="alert">
              Conecte sua conta Gmail em Configurações → Canais de atendimento para enviar por
              e-mail, ou use "Copiar link para o cliente".
            </p>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="draft-from">Remetente</Label>
                <select
                  id="draft-from"
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.email}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="draft-to">Para</Label>
                <EmailInput id="draft-to" value={to} onChange={setTo} multiple />
              </div>
              <div className="space-y-1">
                <Label htmlFor="draft-subject">Assunto</Label>
                <Input
                  id="draft-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="draft-msg">Mensagem</Label>
                <Textarea
                  id="draft-msg"
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={busy || noAccount || !subject.trim()}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
