import { getPublicAppUrl } from "@/lib/app-url";
import { useState } from "react";
import { Video, Loader2, Copy, ExternalLink } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { createMeeting } from "@/lib/meetings.functions";

interface StartVideoButtonProps {
  entity?: "contact" | "lead" | "deal" | "ticket";
  entityId?: string;
  defaultTitle?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  onCreated?: () => void;
  renderTrigger?: (open: () => void) => React.ReactNode;
}

export function StartVideoButton({
  entity,
  entityId,
  defaultTitle = "Reunião",
  variant = "outline",
  size = "sm",
  className,
  onCreated,
  renderTrigger,
}: StartVideoButtonProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(defaultTitle);
  const [consent, setConsent] = useState(true);
  const [loading, setLoading] = useState(false);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const fn = useServerFn(createMeeting);

  async function start() {
    setLoading(true);
    try {
      const { meeting } = await fn({
        data: {
          title,
          entity,
          entity_id: entityId,
          recording_consent: consent,
        },
      });
      const origin = getPublicAppUrl();
      const publicLink = `${origin}/meet/${meeting.public_token}`;
      const jitsi = `https://meet.jit.si/${meeting.room_name}#userInfo.displayName=%22Host%22${consent ? "&config.fileRecordingsEnabled=true" : ""}`;
      setCreatedLink(publicLink);
      setRoomUrl(jitsi);
      window.open(jitsi, "_blank", "noopener,noreferrer");
      onCreated?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao criar sala");
    } finally {
      setLoading(false);
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Link copiado");
  }

  const openDialog = () => {
    setCreatedLink(null);
    setRoomUrl(null);
    setOpen(true);
  };

  return (
    <>
      {renderTrigger ? (
        renderTrigger(openDialog)
      ) : (
        <Button variant={variant} size={size} className={className} onClick={openDialog}>
          <Video className="mr-2 h-4 w-4" />
          Vídeo
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Iniciar reunião por vídeo</DialogTitle>
          </DialogHeader>

          {!createdLink ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="meeting-title">Título</Label>
                <Input
                  id="meeting-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Reunião"
                />
              </div>
              <div className="flex items-start gap-2">
                <Checkbox id="consent" checked={consent} onCheckedChange={(v) => setConsent(!!v)} />
                <div className="space-y-1">
                  <Label htmlFor="consent" className="cursor-pointer">
                    Permitir gravação
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    O Jitsi solicitará consentimento dos participantes ao iniciar a gravação.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={start} disabled={loading}>
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Video className="mr-2 h-4 w-4" />
                  )}
                  Criar e abrir sala
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Sala criada. Compartilhe o link público abaixo com o convidado.
              </p>
              <div className="flex gap-2">
                <Input readOnly value={createdLink} />
                <Button variant="outline" size="icon" onClick={() => copy(createdLink)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              {roomUrl && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.open(roomUrl, "_blank")}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Abrir minha sala (anfitrião)
                </Button>
              )}
              <DialogFooter>
                <Button onClick={() => setOpen(false)}>Fechar</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
