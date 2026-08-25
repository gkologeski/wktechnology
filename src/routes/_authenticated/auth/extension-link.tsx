// Ponte de pareamento entre o TechHire e a extensão Chrome.
// O usuário cola uma API key (gerada em /settings/api-keys); a página
// posta via window.postMessage. Um content script da extensão escuta,
// salva em chrome.storage e responde com ack.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Link2, Loader2 } from "lucide-react";
import { AtsPageHeader, FormSection } from "@/components/ats/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/auth/extension-link")({
  component: ExtensionLinkPage,
});

type Status = "idle" | "sending" | "ok" | "err" | "no-extension";

function ExtensionLinkPage() {
  const [apiBase, setApiBase] = useState(
    typeof window !== "undefined" ? window.location.origin : "",
  );
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [extensionDetected, setExtensionDetected] = useState(false);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== window) return;
      const data = event.data as { source?: string; ok?: boolean; error?: string };
      if (data?.source === "techhire-extension-link-ready") {
        setExtensionDetected(true);
        return;
      }
      if (data?.source === "techhire-extension-link-ack") {
        if (data.ok) {
          setStatus("ok");
        } else {
          setStatus("err");
          setErrorMsg(data.error ?? "Falha ao parear");
        }
      }
    }
    window.addEventListener("message", onMessage);
    // Se em 1.5s não detectamos a extensão, marcamos como ausente.
    const t = setTimeout(() => {
      setExtensionDetected((prev) => prev);
    }, 1500);
    return () => {
      window.removeEventListener("message", onMessage);
      clearTimeout(t);
    };
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg(null);
    if (!extensionDetected) {
      setStatus("no-extension");
      return;
    }
    window.postMessage(
      {
        source: "techhire-extension-link",
        type: "PAIR",
        apiBase: apiBase.trim().replace(/\/$/, ""),
        apiKey: apiKey.trim(),
      },
      window.location.origin,
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-10">
      <AtsPageHeader
        eyebrow="ATS · Hunting"
        title="Parear extensão TechHire Hunter"
        description="Cole uma API key gerada em Configurações · API keys. A chave é enviada direto pra extensão instalada neste navegador."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <FormSection
              title="Credenciais de pareamento"
              description="A chave fica salva apenas no chrome.storage local da extensão. Nada é enviado a outros servidores."
            >
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="apiBase">URL do TechHire</Label>
                  <Input
                    id="apiBase"
                    value={apiBase}
                    onChange={(e) => setApiBase(e.target.value)}
                    placeholder="https://ats.wktechnology.com.br"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="apiKey">API key</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="lvb_..."
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Gere em{" "}
                    <a className="underline" href="/settings/api-keys">
                      Configurações · API keys
                    </a>
                    .
                  </p>
                </div>

                <Button type="submit" disabled={status === "sending"}>
                  {status === "sending" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Link2 className="mr-2 h-4 w-4" />
                  )}
                  Parear com a extensão
                </Button>

                {status === "ok" && (
                  <div className="flex items-start gap-2 rounded-md border border-status-open/30 bg-status-open/10 p-3 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-status-open" />
                    <div>
                      <p className="font-medium">Pareado com sucesso.</p>
                      <p className="text-xs text-muted-foreground">
                        Abra um perfil em linkedin.com/in/... — a sidebar já vai usar essa chave.
                      </p>
                    </div>
                  </div>
                )}

                {status === "err" && (
                  <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
                    <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
                    <div>
                      <p className="font-medium">Não foi possível parear.</p>
                      <p className="text-xs text-muted-foreground">{errorMsg}</p>
                    </div>
                  </div>
                )}

                {status === "no-extension" && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                    <AlertCircle className="mt-0.5 h-4 w-4 text-amber-600" />
                    <div>
                      <p className="font-medium">Extensão não detectada.</p>
                      <p className="text-xs text-muted-foreground">
                        Instale a extensão primeiro em{" "}
                        <a className="underline" href="/hunting/install">
                          Hunting · Instalar
                        </a>
                        , recarregue esta página e tente de novo.
                      </p>
                    </div>
                  </div>
                )}
              </form>
            </FormSection>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-5">
            <p className="text-sm font-semibold">Status da extensão</p>
            <p className="text-xs text-muted-foreground">
              {extensionDetected
                ? "Detectada neste navegador."
                : "Não detectada. Instale e recarregue esta página."}
            </p>
            <div className="pt-2">
              <Button asChild size="sm" variant="outline">
                <a href="/hunting/install">Instruções de instalação</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
