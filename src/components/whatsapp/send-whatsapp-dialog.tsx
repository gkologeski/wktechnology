import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Send, MessageCircle, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import {
  sendWhatsAppMessage,
  listWhatsAppTemplates,
  applyTemplate,
} from "@/lib/whatsapp.functions";
import { uploadWhatsAppMedia } from "@/lib/whatsapp-media";
import { WhatsAppMediaBubble } from "@/components/whatsapp/whatsapp-media-bubble";
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
import { SmartComposeMenu } from "@/components/ai/smart-compose-menu";
import { TokenPills } from "@/components/ui/token-pills";
import { WHATSAPP_TOKENS } from "@/lib/message-tokens-catalog";
import { useTokenInserter } from "@/lib/token-insert";


type Props = {
  defaultTo?: string;
  contactId?: string;
  contactName?: string;
  trigger?: ReactNode;
  onSent?: (conversationId: string) => void;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
};

export function SendWhatsAppDialog({
  defaultTo = "",
  contactId,
  contactName,
  trigger,
  onSent,
  open: openProp,
  onOpenChange,
}: Props) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = onOpenChange ?? setOpenState;

  const [to, setTo] = useState(defaultTo);
  const [body, setBody] = useState("");
  const [templateName, setTemplateName] = useState<string>("");
  const [vars, setVars] = useState<string[]>([]);
  const [media, setMedia] = useState<{ url: string; contentType: string; name: string } | null>(
    null,
  );
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bodyInserter = useTokenInserter<HTMLTextAreaElement>(() => body, setBody);


  async function handlePickFile(file: File) {
    setUploading(true);
    try {
      const res = await uploadWhatsAppMedia(file);
      setMedia({ url: res.url, contentType: res.contentType, name: file.name });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  const listTpl = useServerFn(listWhatsAppTemplates);
  const sendFn = useServerFn(sendWhatsAppMessage);
  const tplQ = useQuery({ queryKey: ["wa", "templates"], queryFn: () => listTpl(), enabled: open });

  useEffect(() => {
    if (open) setTo(defaultTo);
  }, [open, defaultTo]);

  const templates = tplQ.data ?? [];
  const selectedTpl = templates.find((t) => t.name === templateName);
  const placeholderCount = selectedTpl
    ? Array.from(selectedTpl.body.matchAll(/\{\{(\d+)\}\}/g))
        .map((m) => Number(m[1]))
        .reduce((a, b) => Math.max(a, b), 0)
    : 0;
  const varCount = Math.max(placeholderCount, selectedTpl?.variableCount ?? 0);

  const previewBody = selectedTpl ? applyTemplate(selectedTpl.body, vars) : body;
  const isOfficialHsm = !!selectedTpl?.contentSid;

  const sendMut = useMutation({
    mutationFn: () => {
      const contentVariables =
        isOfficialHsm && varCount > 0
          ? Object.fromEntries(
              Array.from({ length: varCount }, (_, i) => [String(i + 1), vars[i] ?? ""]),
            )
          : undefined;
      return sendFn({
        data: {
          to,
          body: isOfficialHsm ? "" : previewBody,
          contactId,
          templateName: templateName || undefined,
          contentSid: isOfficialHsm ? selectedTpl!.contentSid : undefined,
          contentVariables,
          mediaUrl: isOfficialHsm ? undefined : media?.url,
          mediaContentType: isOfficialHsm ? undefined : media?.contentType,
        },
      });
    },
    onSuccess: (res) => {
      toast.success("Mensagem enviada");
      setOpen(false);
      setBody("");
      setTemplateName("");
      setVars([]);
      setMedia(null);
      onSent?.(res.conversationId);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== undefined ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : openProp === undefined ? (
        <DialogTrigger asChild>
          <Button size="sm" variant="outline">
            <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
          </Button>
        </DialogTrigger>
      ) : null}

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
                    {t.contentSid ? "  · HSM oficial" : ""}
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
                <Label>Preview {isOfficialHsm ? "(HSM oficial)" : ""}</Label>
                <div className="rounded-md border bg-muted/40 p-2 text-sm whitespace-pre-wrap">
                  {previewBody || "—"}
                </div>
                {isOfficialHsm && (
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Será enviado via ContentSid {selectedTpl!.contentSid} — Twilio renderiza o corpo
                    aprovado. Mídia/texto livre são ignorados.
                  </p>
                )}
              </div>
            </>
          ) : (
            <div>
              <div className="flex items-center justify-between">
                <Label>Mensagem</Label>
                <SmartComposeMenu
                  channel="whatsapp"
                  currentText={body}
                  contactName={contactName}
                  onApply={setBody}
                />
              </div>
              <Textarea
                ref={bodyInserter.ref}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
              />
              <TokenPills
                className="mt-2"
                tokens={WHATSAPP_TOKENS}
                onInsert={bodyInserter.insert}
              />

            </div>
          )}

          <div>
            <Label>Mídia (opcional)</Label>
            <input
              ref={fileRef}
              type="file"
              hidden
              accept="image/*,audio/*,video/*,application/pdf"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handlePickFile(f);
                e.target.value = "";
              }}
            />
            {media ? (
              <div className="flex items-start gap-2 rounded-md border p-2">
                <WhatsAppMediaBubble url={media.url} contentType={media.contentType} />
                <div className="flex-1 min-w-0">
                  <div className="truncate text-xs">{media.name}</div>
                  <div className="text-[10px] text-muted-foreground">{media.contentType}</div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => setMedia(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                <Paperclip className="mr-2 h-4 w-4" />
                {uploading ? "Enviando…" : "Anexar imagem, áudio ou PDF"}
              </Button>
            )}
            <p className="mt-1 text-[10px] text-muted-foreground">
              Máx 16MB. Formatos suportados pelo WhatsApp.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => sendMut.mutate()}
            disabled={
              !to ||
              (!isOfficialHsm && !previewBody.trim() && !media) ||
              sendMut.isPending ||
              uploading ||
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
