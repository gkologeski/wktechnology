import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Phone, PhoneOff, Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { getVoiceAccessToken, logCallActivity } from "@/lib/twilio-voice.functions";
import type { Device as DeviceType, Call as CallType } from "@twilio/voice-sdk";

type Status = "idle" | "connecting" | "ringing" | "in-call" | "ended";

interface CallDialerProps {
  defaultTo: string;
  contactId?: string;
  leadId?: string;
  dealId?: string;
  contactName?: string;
  trigger?: React.ReactNode;
}

function normalizeE164(input: string): string {
  const digits = input.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  // Default to BR (55) when sem código de país.
  if (digits.length >= 10 && digits.length <= 11) return `+55${digits}`;
  return `+${digits}`;
}

export function CallDialer({
  defaultTo,
  contactId,
  leadId,
  dealId,
  contactName,
  trigger,
}: CallDialerProps) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(defaultTo);
  const [status, setStatus] = useState<Status>("idle");
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [notes, setNotes] = useState("");
  const [outcome, setOutcome] = useState("");
  const [showLog, setShowLog] = useState(false);

  const deviceRef = useRef<DeviceType | null>(null);
  const callRef = useRef<CallType | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const callSidRef = useRef<string | undefined>(undefined);

  const fetchToken = useServerFn(getVoiceAccessToken);
  const logCall = useServerFn(logCallActivity);

  // Timer
  useEffect(() => {
    if (status !== "in-call") return;
    const id = setInterval(() => {
      if (startedAtRef.current) setSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 500);
    return () => clearInterval(id);
  }, [status]);

  const cleanupDevice = useCallback(() => {
    try {
      callRef.current?.disconnect();
    } catch {
      // Ignore cleanup errors from an already-closed call.
    }
    try {
      deviceRef.current?.destroy();
    } catch {
      // Ignore cleanup errors from an already-destroyed device.
    }
    callRef.current = null;
    deviceRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) {
      cleanupDevice();
      setStatus("idle");
      setMuted(false);
      setSeconds(0);
      setShowLog(false);
      setNotes("");
      setOutcome("");
      startedAtRef.current = null;
      callSidRef.current = undefined;
    }
  }, [open, cleanupDevice]);

  const startCall = useCallback(async () => {
    const target = normalizeE164(to);
    if (!/^\+[1-9]\d{6,14}$/.test(target)) {
      toast.error("Número inválido. Use formato E.164 (ex.: +5511999998888).");
      return;
    }
    setStatus("connecting");
    try {
      const tokenResult = await fetchToken({});
      if (!tokenResult.ok) {
        toast.error(tokenResult.error);
        setStatus("idle");
        return;
      }
      const { Device } = await import("@twilio/voice-sdk");
      const device = new Device(tokenResult.token, {
        logLevel: 1,
        codecPreferences: ["opus", "pcmu"] as never,
      });
      deviceRef.current = device;

      device.on("error", (err) => {
        console.error("[twilio] device error", err);
        toast.error(err?.message ?? "Erro no dispositivo Twilio");
      });

      const call = await device.connect({ params: { To: target } });
      callRef.current = call;
      callSidRef.current = (
        call as unknown as { parameters?: { CallSid?: string } }
      ).parameters?.CallSid;

      setStatus("ringing");

      call.on("accept", () => {
        startedAtRef.current = Date.now();
        callSidRef.current = call.parameters.CallSid ?? callSidRef.current;
        setStatus("in-call");
      });
      call.on("disconnect", () => {
        setStatus("ended");
        setShowLog(true);
      });
      call.on("cancel", () => {
        setStatus("ended");
        setShowLog(true);
      });
      call.on("reject", () => {
        setStatus("ended");
        setShowLog(true);
      });
      call.on("error", (err) => {
        console.error("[twilio] call error", err);
        toast.error(err?.message ?? "Erro na ligação");
        setStatus("ended");
        setShowLog(true);
      });
    } catch (e) {
      console.error("[call-dialer] start failed", e);
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === "string"
            ? e
            : ((e as { message?: string; code?: string | number })?.message ?? JSON.stringify(e));
      toast.error(`Falha ao iniciar ligação: ${msg || "erro desconhecido"}`);
      setStatus("idle");
    }
  }, [fetchToken, to]);

  const hangup = useCallback(() => {
    try {
      callRef.current?.disconnect();
    } catch {
      // Ignore hangup errors when the call is already closed.
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (!callRef.current) return;
    const next = !muted;
    callRef.current.mute(next);
    setMuted(next);
  }, [muted]);

  const submitLog = useCallback(async () => {
    try {
      const dur = startedAtRef.current ? Date.now() - startedAtRef.current : 0;
      await logCall({
        data: {
          contactId,
          leadId,
          dealId,
          toNumber: normalizeE164(to),
          durationMs: dur,
          outcome: outcome || undefined,
          notes: notes || undefined,
          callSid: callSidRef.current,
        },
      });
      toast.success("Ligação registrada na timeline");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar ligação");
    }
  }, [contactId, dealId, leadId, logCall, notes, outcome, to]);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline">
            <Phone className="h-4 w-4 mr-1" /> Ligar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {contactName ? `Ligar para ${contactName}` : "Ligação"}
          </DialogTitle>
        </DialogHeader>

        {!showLog ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="to-number">Número</Label>
              <Input
                id="to-number"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="+5511999998888"
                disabled={status !== "idle"}
              />
            </div>

            <div className="flex items-center justify-between rounded-md border p-4">
              <div className="text-sm">
                <div className="font-medium capitalize">
                  {status === "idle" && "Pronto"}
                  {status === "connecting" && "Conectando…"}
                  {status === "ringing" && "Chamando…"}
                  {status === "in-call" && "Em ligação"}
                  {status === "ended" && "Encerrada"}
                </div>
                {status === "in-call" && (
                  <div className="text-muted-foreground font-mono">{fmt(seconds)}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {(status === "in-call" || status === "ringing") && (
                  <>
                    <Button size="icon" variant="outline" onClick={toggleMute} title="Mute">
                      {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </Button>
                    <Button size="icon" variant="destructive" onClick={hangup} title="Desligar">
                      <PhoneOff className="h-4 w-4" />
                    </Button>
                  </>
                )}
                {status === "idle" && (
                  <Button onClick={startCall}>
                    <Phone className="h-4 w-4 mr-1" /> Ligar
                  </Button>
                )}
                {status === "connecting" && (
                  <Button disabled>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Conectando
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Duração:{" "}
              <span className="font-mono">
                {fmt(startedAtRef.current ? Math.floor((Date.now() - startedAtRef.current) / 1000) : 0)}
              </span>
            </div>
            <div>
              <Label htmlFor="outcome">Resultado</Label>
              <Input
                id="outcome"
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                placeholder="ex.: Atendeu, agendou reunião"
              />
            </div>
            <div>
              <Label htmlFor="call-notes">Notas</Label>
              <Textarea
                id="call-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Resumo da conversa…"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Descartar
              </Button>
              <Button onClick={submitLog}>Salvar na timeline</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
