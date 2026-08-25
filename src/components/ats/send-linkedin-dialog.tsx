import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Linkedin, Loader2, Send, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { sendLinkedinMessageFn, sendLinkedinInviteFn } from "@/lib/unipile/messaging.functions";
import { formatErrorMessage, handleForceReload } from "@/lib/errors/format";
import { TokenPills } from "@/components/ui/token-pills";
import { LINKEDIN_TOKENS } from "@/lib/message-tokens-catalog";
import { useTokenInserter } from "@/lib/token-insert";

interface Props {
  candidateId?: string;
  linkedinUrl?: string | null;
  candidateName?: string | null;
  trigger?: React.ReactNode;
}

export function SendLinkedinDialog({ candidateId, linkedinUrl, candidateName, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"message" | "invite">("message");
  const [text, setText] = useState("");
  const [inviteMsg, setInviteMsg] = useState("");

  const msgInserter = useTokenInserter<HTMLTextAreaElement>(() => text, setText);
  const inviteInserter = useTokenInserter<HTMLTextAreaElement>(() => inviteMsg, setInviteMsg);

  const send = useServerFn(sendLinkedinMessageFn);
  const invite = useServerFn(sendLinkedinInviteFn);

  const sendMut = useMutation({
    mutationFn: async () =>
      send({
        data: { candidateId, linkedinUrl: linkedinUrl ?? undefined, text },
      }),
    onSuccess: (r: any) => {
      if (!r?.ok) {
        toast.error(formatErrorMessage(r?.error ?? "Falha ao enviar mensagem"));
        return;
      }
      toast.success(r.deduped ? "Mensagem já havia sido enviada" : "Mensagem enviada");
      setOpen(false);
      setText("");
    },
    onError: (e: any) => {
      if (handleForceReload(e?.message)) return;
      toast.error(formatErrorMessage(e?.message ?? "Erro inesperado"));
    },
  });

  const inviteMut = useMutation({
    mutationFn: async () =>
      invite({
        data: {
          candidateId,
          linkedinUrl: linkedinUrl ?? undefined,
          message: inviteMsg || undefined,
        },
      }),
    onSuccess: (r: any) => {
      if (!r?.ok) {
        toast.error(formatErrorMessage(r?.error ?? "Falha ao enviar convite"));
        return;
      }
      toast.success(r.deduped ? "Convite já havia sido enviado" : "Convite enviado");
      setOpen(false);
      setInviteMsg("");
    },
    onError: (e: any) => {
      if (handleForceReload(e?.message)) return;
      toast.error(formatErrorMessage(e?.message ?? "Erro inesperado"));
    },
  });

  const disabled = !linkedinUrl;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline" disabled={disabled} className="gap-2">
            <Linkedin className="h-4 w-4" />
            Contato LinkedIn
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar via LinkedIn</DialogTitle>
          <DialogDescription>
            {candidateName ? `Para ${candidateName}. ` : ""}
            Envio real via Unipile respeitando janela e budget diário.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "message" | "invite")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="message" className="gap-2">
              <Send className="h-4 w-4" />
              Mensagem
            </TabsTrigger>
            <TabsTrigger value="invite" className="gap-2">
              <UserPlus className="h-4 w-4" />
              Convite
            </TabsTrigger>
          </TabsList>

          <TabsContent value="message" className="space-y-3 pt-4">
            <div className="space-y-2">
              <Label htmlFor="dm-text">Mensagem</Label>
              <Textarea
                id="dm-text"
                ref={msgInserter.ref}
                rows={6}
                maxLength={8000}
                placeholder="Olá! Vi seu perfil e gostaria de conversar sobre uma oportunidade..."
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <TokenPills tokens={LINKEDIN_TOKENS} onInsert={msgInserter.insert} />
              <p className="text-xs text-text-tertiary">{text.length}/8000</p>
            </div>
            <DialogFooter>
              <Button
                onClick={() => sendMut.mutate()}
                disabled={sendMut.isPending || !text.trim()}
                className="gap-2"
              >
                {sendMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Enviar mensagem
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="invite" className="space-y-3 pt-4">
            <div className="space-y-2">
              <Label htmlFor="invite-msg">Mensagem do convite (opcional, máx 300)</Label>
              <Textarea
                id="invite-msg"
                ref={inviteInserter.ref}
                rows={4}
                maxLength={300}
                placeholder="Nota curta para acompanhar o convite (opcional)"
                value={inviteMsg}
                onChange={(e) => setInviteMsg(e.target.value)}
              />
              <TokenPills tokens={LINKEDIN_TOKENS} onInsert={inviteInserter.insert} />
              <p className="text-xs text-text-tertiary">{inviteMsg.length}/300</p>
            </div>
            <DialogFooter>
              <Button
                onClick={() => inviteMut.mutate()}
                disabled={inviteMut.isPending}
                className="gap-2"
              >
                {inviteMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                Enviar convite
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
