import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { smartCompose } from "@/lib/ai-compose.functions";

type Mode =
  | "draft"
  | "improve"
  | "shorter"
  | "longer"
  | "formal"
  | "casual"
  | "translate_en"
  | "translate_es"
  | "translate_pt"
  | "reply";

type Channel = "email" | "whatsapp";

const QUICK: { label: string; mode: Mode }[] = [
  { label: "Melhorar", mode: "improve" },
  { label: "Encurtar", mode: "shorter" },
  { label: "Expandir", mode: "longer" },
  { label: "Mais formal", mode: "formal" },
  { label: "Mais casual", mode: "casual" },
];

const TRANSLATE: { label: string; mode: Mode }[] = [
  { label: "Traduzir → Inglês", mode: "translate_en" },
  { label: "Traduzir → Espanhol", mode: "translate_es" },
  { label: "Traduzir → Português", mode: "translate_pt" },
];

export function SmartComposeMenu({
  channel,
  currentText,
  contactName,
  onApply,
}: {
  channel: Channel;
  currentText: string;
  contactName?: string;
  onApply: (text: string) => void;
}) {
  const compose = useServerFn(smartCompose);
  const [busy, setBusy] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const [prompt, setPrompt] = useState("");

  const run = async (mode: Mode, p?: string) => {
    setBusy(true);
    try {
      const r = (await compose({
        data: {
          channel,
          mode,
          input_text: currentText,
          prompt: p ?? "",
          contact_name: contactName ?? "",
        },
      })) as { text: string };
      onApply(r.text);
      toast.success("Texto atualizado");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      setDraftOpen(false);
      setPrompt("");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost" disabled={busy}>
          {busy ? (
            <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-1 text-primary" />
          )}
          IA
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <Popover open={draftOpen} onOpenChange={setDraftOpen}>
          <PopoverTrigger asChild>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setDraftOpen(true);
              }}
            >
              <Sparkles className="h-3.5 w-3.5 mr-2" /> Redigir do zero…
            </DropdownMenuItem>
          </PopoverTrigger>
          <PopoverContent side="left" align="start" className="w-80">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Descreva o que enviar</p>
              <Input
                placeholder="ex.: follow-up agradecendo a reunião"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && prompt.trim()) void run("draft", prompt);
                }}
              />
              <Button
                size="sm"
                className="w-full"
                disabled={!prompt.trim() || busy}
                onClick={() => void run("draft", prompt)}
              >
                Gerar
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        <DropdownMenuItem disabled={!currentText.trim()} onSelect={() => void run("reply")}>
          Sugerir resposta
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {QUICK.map((q) => (
          <DropdownMenuItem
            key={q.mode}
            disabled={!currentText.trim() || busy}
            onSelect={() => void run(q.mode)}
          >
            {q.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        {TRANSLATE.map((q) => (
          <DropdownMenuItem
            key={q.mode}
            disabled={!currentText.trim() || busy}
            onSelect={() => void run(q.mode)}
          >
            {q.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
