import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  getVoiceAgentSettings,
  saveVoiceAgentSettings,
  listVapiPhoneNumbers,
  listElevenLabsVoices,
  previewVoice,
} from "@/lib/voice-agent.functions";

export const Route = createFileRoute("/_authenticated/settings/voice-agent")({
  component: VoiceAgentPage,
});

export function VoiceAgentPage() {
  const getFn = useServerFn(getVoiceAgentSettings);
  const saveFn = useServerFn(saveVoiceAgentSettings);
  const phonesFn = useServerFn(listVapiPhoneNumbers);
  const voicesFn = useServerFn(listElevenLabsVoices);
  const previewFn = useServerFn(previewVoice);

  type S = {
    vapi_phone_number_id?: string | null;
    default_voice_id?: string | null;
    default_voice_provider: "elevenlabs" | "vapi_default";
    llm_model: string;
    language: string;
    speed: number;
    stability: number;
    similarity_boost: number;
    first_message?: string | null;
    max_duration_seconds: number;
  };
  const [s, setS] = useState<S>({
    default_voice_provider: "elevenlabs",
    llm_model: "gpt-4o-mini",
    language: "pt-BR",
    speed: 1.0,
    stability: 0.5,
    similarity_boost: 0.75,
    max_duration_seconds: 600,
  });
  const [phones, setPhones] = useState<Array<{ id: string; number: string; name: string }>>([]);
  const [voices, setVoices] = useState<
    Array<{ id: string; name: string; category: string; accent?: string }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const cur = await getFn();
      if (cur) setS((p) => ({ ...p, ...(cur as S) }));
    })();
  }, [getFn]);

  const loadVoices = async () => {
    setBusy("voices");
    try {
      setVoices(await voicesFn({ data: { onlyPortuguese: true } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(null);
    }
  };

  // Auto-load Portuguese voices on mount
  useEffect(() => {
    loadVoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPhones = async () => {
    setBusy("phones");
    try {
      setPhones(await phonesFn());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    setLoading(true);
    try {
      await saveFn({ data: s });
      toast.success("Configurações salvas");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  };

  const testVoice = async () => {
    if (!s.default_voice_id) {
      toast.error("Selecione uma voz primeiro");
      return;
    }
    setBusy("preview");
    try {
      const out = await previewFn({
        data: {
          voice_id: s.default_voice_id,
          text: s.first_message || "Olá! Sou o agente de prospecção da sua empresa.",
        },
      });
      const audio = new Audio(`data:audio/mpeg;base64,${out.audio_base64}`);
      await audio.play();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(null);
    }
  };

  const allVoices = voices;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Agente de voz</h2>
        <p className="text-sm text-muted-foreground">
          Configure a conexão com Vapi e ElevenLabs e os parâmetros padrão do agente.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Conexão Vapi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label>Número Vapi (phone number)</Label>
              <Select
                value={s.vapi_phone_number_id ?? ""}
                onValueChange={(v) => setS((p) => ({ ...p, vapi_phone_number_id: v || null }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um número" />
                </SelectTrigger>
                <SelectContent>
                  {phones.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.number || p.name || p.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={loadPhones} disabled={busy === "phones"}>
              {busy === "phones" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Importe seu número Twilio no dashboard do Vapi (Phone Numbers → Import from Twilio) e
            depois clique no botão de atualizar.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Voz padrão</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label>Voz (ElevenLabs)</Label>
              <Select
                value={s.default_voice_id ?? ""}
                onValueChange={(v) => setS((p) => ({ ...p, default_voice_id: v || null }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma voz" />
                </SelectTrigger>
                <SelectContent>
                  {allVoices.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name} {v.accent ? `· ${v.accent}` : `· ${v.category}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              onClick={loadVoices}
              disabled={busy === "voices"}
              title="Sincronizar minhas vozes"
            >
              {busy === "voices" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
            <Button variant="outline" onClick={testVoice} disabled={busy === "preview"}>
              {busy === "preview" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}{" "}
              Testar
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Velocidade</Label>
              <Input
                type="number"
                step="0.05"
                min={0.5}
                max={2}
                value={s.speed}
                onChange={(e) => setS((p) => ({ ...p, speed: parseFloat(e.target.value) || 1 }))}
              />
            </div>
            <div>
              <Label>Estabilidade</Label>
              <Input
                type="number"
                step="0.05"
                min={0}
                max={1}
                value={s.stability}
                onChange={(e) =>
                  setS((p) => ({ ...p, stability: parseFloat(e.target.value) || 0.5 }))
                }
              />
            </div>
            <div>
              <Label>Similaridade</Label>
              <Input
                type="number"
                step="0.05"
                min={0}
                max={1}
                value={s.similarity_boost}
                onChange={(e) =>
                  setS((p) => ({ ...p, similarity_boost: parseFloat(e.target.value) || 0.75 }))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Modelo LLM</Label>
              <Input
                value={s.llm_model}
                onChange={(e) => setS((p) => ({ ...p, llm_model: e.target.value }))}
              />
            </div>
            <div>
              <Label>Idioma</Label>
              <Input
                value={s.language}
                onChange={(e) => setS((p) => ({ ...p, language: e.target.value }))}
              />
            </div>
            <div>
              <Label>Duração máxima (segundos)</Label>
              <Input
                type="number"
                min={30}
                max={3600}
                value={s.max_duration_seconds}
                onChange={(e) =>
                  setS((p) => ({ ...p, max_duration_seconds: parseInt(e.target.value, 10) || 600 }))
                }
              />
            </div>
          </div>
          <div>
            <Label>Mensagem de abertura padrão</Label>
            <Textarea
              rows={3}
              value={s.first_message ?? ""}
              onChange={(e) => setS((p) => ({ ...p, first_message: e.target.value }))}
              placeholder="Oi {{lead.name}}, aqui é a Sara da..."
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Salvar
        </Button>
      </div>
    </div>
  );
}
