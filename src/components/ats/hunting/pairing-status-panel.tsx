// Painel de status de pareamento — ouve a status-bridge da extensão.
import { useEffect, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, Loader2, Link2, RefreshCw, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type PairState = "checking" | "not_installed" | "pending" | "paired" | "failed";

type StatusMsg = {
  source?: string;
  ok?: boolean;
  paired?: boolean;
  apiBase?: string | null;
  lastError?: string | null;
};

export function PairingStatusPanel() {
  const [state, setState] = useState<PairState>("checking");
  const [apiBase, setApiBase] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastCheck, setLastCheck] = useState<number | null>(null);

  const requestStatus = useCallback(() => {
    window.postMessage({ source: "techhire-extension-status-request" }, window.location.origin);
  }, []);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== window) return;
      const data = event.data as StatusMsg;
      if (!data?.source) return;
      if (
        data.source === "techhire-extension-status-ready" ||
        data.source === "techhire-extension-status"
      ) {
        setLastCheck(Date.now());
        setApiBase(data.apiBase ?? null);
        setLastError(data.lastError ?? null);
        if (data.lastError) setState("failed");
        else if (data.paired) setState("paired");
        else setState("pending");
      }
    }

    window.addEventListener("message", onMessage);
    requestStatus();

    // Fallback robusto: o content script marca o <html> assim que carrega.
    // Checa por até 3s antes de declarar "not_installed".
    const start = Date.now();
    const probe = setInterval(() => {
      const installed =
        document.documentElement.getAttribute("data-techhire-hunter") === "installed";
      if (installed) {
        setState((prev) => (prev === "checking" || prev === "not_installed" ? "pending" : prev));
        requestStatus();
        clearInterval(probe);
      } else if (Date.now() - start > 3000) {
        setState((prev) => (prev === "checking" ? "not_installed" : prev));
        clearInterval(probe);
      }
    }, 200);

    // Polling de estado pareado.
    const intervalId = setInterval(requestStatus, 2000);

    return () => {
      window.removeEventListener("message", onMessage);
      clearInterval(intervalId);
      clearInterval(probe);
    };
  }, [requestStatus]);

  const cfg = STATE_CFG[state];

  return (
    <Card className={cfg.border}>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <cfg.icon className={`h-4 w-4 ${cfg.iconCls}`} />
            <p className="text-sm font-semibold">Status do pareamento</p>
          </div>
          <Badge variant="outline" className={cfg.badgeCls}>
            {cfg.label}
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground">{cfg.description}</p>

        {state === "paired" && apiBase && (
          <div className="rounded-md border bg-surface-sunken px-2.5 py-1.5 text-[11px] text-text-secondary">
            <span className="text-text-tertiary">Conectado a:</span>{" "}
            <code className="break-all">{apiBase}</code>
          </div>
        )}

        {state === "failed" && lastError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive">
            Último erro: <code>{lastError}</code>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
            Próximo passo
          </p>
          <p className="text-xs text-text-secondary">{cfg.nextStep}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            {cfg.primary && (
              <Button asChild size="sm" variant="default">
                <a href={cfg.primary.href}>
                  {cfg.primary.icon ? <cfg.primary.icon className="mr-1 h-3.5 w-3.5" /> : null}
                  {cfg.primary.label}
                </a>
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setState("checking");
                requestStatus();
                setTimeout(() => {
                  setState((prev) => (prev === "checking" ? "not_installed" : prev));
                }, 1500);
              }}
            >
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
              Verificar novamente
            </Button>
          </div>
        </div>

        {lastCheck && (
          <p className="text-[10px] text-text-tertiary">
            Atualizado às {new Date(lastCheck).toLocaleTimeString("pt-BR")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

const STATE_CFG: Record<
  PairState,
  {
    label: string;
    description: string;
    nextStep: string;
    icon: typeof CheckCircle2;
    iconCls: string;
    border: string;
    badgeCls: string;
    primary?: { href: string; label: string; icon?: typeof Link2 };
  }
> = {
  checking: {
    label: "Verificando",
    description: "Procurando a extensão neste navegador…",
    nextStep: "Aguarde alguns segundos. Se nada acontecer, instale a extensão.",
    icon: Loader2,
    iconCls: "animate-spin text-text-tertiary",
    border: "",
    badgeCls: "border-border-subtle text-text-secondary",
  },
  not_installed: {
    label: "Não instalada",
    description: "Não detectamos a extensão TechHire Hunter neste navegador.",
    nextStep:
      "Baixe o pacote .zip, descompacte e carregue em chrome://extensions com 'Modo do desenvolvedor' ativo.",
    icon: AlertCircle,
    iconCls: "text-amber-600",
    border: "border-amber-500/30",
    badgeCls: "border-amber-500/30 bg-amber-500/10 text-amber-700",
    primary: { href: "#download", label: "Baixar extensão", icon: Download },
  },
  pending: {
    label: "Pendente",
    description: "Extensão instalada, mas sem API key configurada.",
    nextStep:
      "Gere uma API key em Configurações · API keys e use a página de pareamento pra enviá-la direto pra extensão.",
    icon: AlertCircle,
    iconCls: "text-primary",
    border: "border-primary/30",
    badgeCls: "border-primary/30 bg-primary/10 text-primary",
    primary: { href: "/auth/extension-link", label: "Parear agora", icon: Link2 },
  },
  paired: {
    label: "Pareado",
    description: "Tudo pronto. A extensão está autenticada no TechHire.",
    nextStep:
      "Abra qualquer perfil em linkedin.com/in/... e use a sidebar pra capturar candidatos.",
    icon: CheckCircle2,
    iconCls: "text-status-open",
    border: "border-status-open/30",
    badgeCls: "border-status-open/30 bg-status-open/10 text-status-open",
    primary: {
      href: "https://www.linkedin.com/",
      label: "Abrir LinkedIn",
      icon: Link2,
    },
  },
  failed: {
    label: "Falhou",
    description: "A última tentativa de pareamento não foi concluída.",
    nextStep: "Gere uma nova API key e tente novamente. Confira se a chave foi colada inteira.",
    icon: AlertCircle,
    iconCls: "text-destructive",
    border: "border-destructive/30",
    badgeCls: "border-destructive/30 bg-destructive/10 text-destructive",
    primary: { href: "/auth/extension-link", label: "Tentar novamente", icon: Link2 },
  },
};
