import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Send, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import {
  sendWhatsAppMessage,
  listWhatsAppTemplates,
  applyTemplate,
} from "@/lib/whatsapp.functions";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

type Props = {
  defaultTo?: string;
  contactId?: string;
  contactName?: string;
  trigger?: ReactNode;
  onSent?: (conversationId: string) => void;
};

export function SendWhatsAppDialog({
  defaultTo = "",
  contactId,
  contactName,
  trigger,
  onSent,
}: Props) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(defaultTo);
  const [body, setBody] = useState("");
  const [templateName, setTemplateName] = useState<string>("");
  const [vars, setVars] = useState<string[]>([]);

  const listTpl = useServerFn(listWhatsAppTemplates);
  const sendFn = useServerFn(sendWhatsAppMessage);
  const tplQ = useQuery({ queryKey: ["wa", "templates"], queryFn: () => listTpl(), enabled: open });

  useEffect(() => {
    if (open) setTo(defaultTo);
  }, [open, defaultTo]);

  const templates = tplQ.data ?? [];
  const selectedTpl = templates.find((t) => t.name === templateName);
  const varCount = selectedTpl
    ? Array.from(selectedTpl.body.matchAll(/\{\{(\d+)\}\}/g))
        .map((m) => Number(m[1]))
        .reduce((a, b) => Math.max(a, b), 0)
    : 0;

  const previewBody = selectedTpl ? applyTemplate(selectedTpl.body, vars) : body;

  const sendMut = useMutation({
    mutationFn: () =>
      sendFn({
        data: {
          to,
          body: previewBody,
          contactId,
          templateName: templateName || undefined,
        },
      }),
    onSuccess: (res) => {
      toast.success("Mensagem enviada");
      setOpen(false);
      setBody("");
      setTemplateName("");
      setVars([]);
      onSent?.(res.conversationId);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline">
            <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar WhatsApp</DialogTitle>
          <DialogDescription>
            {contactName ? `Para ${contactName}` : "Envie uma mensagem via Twilio"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Para (E.164)</Label>
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="+5511999999999"
            />
          </div>

          <div>
            <Label>Template (opcional)</Label>
            <Select
              value={templateName || "_none"}
              onValueChange={(v) => {
                const next = v === "_none" ? "" : v;
                setTemplateName(next);
                setVars([]);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Mensagem livre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Mensagem livre</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t.name} value={t.name}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedTpl ? (
            <>
              {Array.from({ length: varCount }).map((_, i) => (
                <div key={i}>
                  <Label>Variável {`{{${i + 1}}}`}</Label>
                  <Input
                    value={vars[i] ?? ""}
                    onChange={(e) =>
                      setVars((prev) => {
                        const next = [...prev];
                        next[i] = e.target.value;
                        return next;
                      })
                    }
                  />
                </div>
              ))}
              <div>
                <Label>Preview</Label>
                <div className="rounded-md border bg-muted/40 p-2 text-sm whitespace-pre-wrap">
                  {previewBody || "—"}
                </div>
              </div>
            </>
          ) : (
            <div>
              <Label>Mensagem</Label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            onClick={() => sendMut.mutate()}
            disabled={
              !to ||
              !previewBody.trim() ||
              sendMut.isPending ||
              (!!selectedTpl && vars.slice(0, varCount).some((v) => !v))
            }
          >
            <Send className="mr-2 h-4 w-4" /> Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
