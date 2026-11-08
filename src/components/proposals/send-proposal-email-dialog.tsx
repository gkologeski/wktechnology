// Janela "Enviar ao cliente aprovar por e-mail": envia pela conta Gmail do
// usuário logado e, só depois do e-mail sair, sela a proposta (status Enviada).
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Loader2, Mail } from "lucide-react";
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
import { listEmailAccounts } from "@/lib/email-accounts.functions";
import { sendGmailEmail } from "@/lib/email-send.functions";
import { getSalesPublicToken } from "@/lib/access-control/sales-sharing.functions";
import { sendProposal } from "@/lib/proposals.functions";
import { getPublicAppUrl } from "@/lib/app-url";
import { parseEmailList } from "@/lib/email-address";
import {
  buildProposalEmail,
  defaultProposalMessage,
  defaultProposalSubject,
} from "@/lib/proposals/proposal-email";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  proposalId: string;
  title: string;
  dealId: string | null;
  company: string | null;
  contact: string | null;
  contactEmail: string | null;
  onSent: () => void;
};

export function SendProposalEmailDialog(props: Props) {
  const listAccounts = useServerFn(listEmailAccounts);
  const sendMail = useServerFn(sendGmailEmail);
  const share = useServerFn(getSalesPublicToken);
  const seal = useServerFn(sendProposal);
  const accountsQ = useQuery({
    queryKey: ["email-accounts", "mine"],
    queryFn: () => listAccounts(),
    enabled: props.open,
  });
  const accounts = (accountsQ.data?.items ?? []).filter(
    (a) => a.provider === "gmail" && a.status !== "disconnected",
  );
  const [accountId, setAccountId] = useState("");
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!props.open) return;
    setTo(props.contactEmail ?? "");
    setCc("");
    setSubject(defaultProposalSubject(props.title, props.company));
    setMessage(defaultProposalMessage(props.contact));
  }, [props.open, props.contactEmail, props.title, props.company, props.contact]);

  useEffect(() => {
    if (!accountId && accounts[0]) setAccountId(accounts[0].id);
  }, [accounts, accountId]);

  const submit = async () => {
    let toList: string[];
    let ccList: string[] = [];
    try {
      toList = parseEmailList(to);
      if (cc.trim()) ccList = parseEmailList(cc);
    } catch {
      toast.error("Verifique os e-mails informados.");
      return;
    }
    if (!toList.length) return toast.error("Informe ao menos um destinatário.");
    setBusy(true);
    try {
      const token = await share({ data: { table: "proposals", id: props.proposalId } });
      const link = `${getPublicAppUrl()}/proposal/${token}`;
      const body = buildProposalEmail({
        title: props.title,
        company: props.company,
        contact: props.contact,
        link,
        message,
      });
      await sendMail({
        data: {
          account_id: accountId || undefined,
          to: toList,
          cc: ccList.length ? ccList : undefined,
          subject,
          body_html: body.html,
          body_text: body.text,
          deal_id: props.dealId ?? undefined,
        },
      });
      try {
        await seal({ data: { id: props.proposalId } });
      } catch (e) {
        toast.error(
          `E-mail enviado, mas a proposta não foi marcada como enviada: ${(e as Error).message}. Use "Copiar link para cliente aprovar" para concluir.`,
        );
        props.onSent();
        props.onOpenChange(false);
        return;
      }
      toast.success("Proposta enviada ao cliente por e-mail.");
      props.onSent();
      props.onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const noAccount = accountsQ.isSuccess && accounts.length === 0;

  return (
    <Dialog open={props.open} onOpenChange={(v) => !busy && props.onOpenChange(v)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar ao cliente aprovar por e-mail</DialogTitle>
          <DialogDescription>
            O e-mail sai pela sua conta conectada com o link para o cliente aprovar ou recusar.
          </DialogDescription>
        </DialogHeader>
        {accountsQ.isLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Carregando sua conta de
            e-mail…
          </div>
        ) : accountsQ.isError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
            Não foi possível carregar suas contas de e-mail.{" "}
            <button className="underline" onClick={() => void accountsQ.refetch()}>
              Tentar novamente
            </button>
          </div>
        ) : noAccount ? (
          <div className="rounded-md border p-3 text-sm">
            Você não tem uma conta de e-mail conectada.{" "}
            <Link to="/settings/email" className="font-medium underline">
              Conectar e-mail
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="pe-from">Remetente</Label>
              {accounts.length > 1 ? (
                <select
                  id="pe-from"
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.email}
                    </option>
                  ))}
                </select>
              ) : (
                <Input id="pe-from" value={accounts[0]?.email ?? ""} disabled />
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="pe-to">Para</Label>
              <EmailInput id="pe-to" value={to} onChange={setTo} multiple />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pe-cc">Cc (opcional)</Label>
              <EmailInput id="pe-cc" value={cc} onChange={setCc} multiple />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pe-subject">Assunto</Label>
              <Input id="pe-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pe-msg">Mensagem</Label>
              <Textarea
                id="pe-msg"
                rows={7}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                O botão “Ver e aprovar proposta” é adicionado automaticamente ao final.
              </p>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => props.onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={busy || noAccount || !accounts.length || !subject.trim() || !to.trim()}
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
