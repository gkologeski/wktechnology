// Hunting · Instalar extensão — instruções de instalação e pareamento.
import { createFileRoute } from "@tanstack/react-router";
import { Download, Chrome, ShieldCheck, Link2 } from "lucide-react";
import { AtsPageHeader, FormSection } from "@/components/ats/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PairingStatusPanel } from "@/components/ats/hunting/pairing-status-panel";

export const Route = createFileRoute("/_authenticated/(ats)/hunting/install")({
  component: HuntingInstallPage,
});

function HuntingInstallPage() {
  return (
    <div className="flex flex-col gap-6 pb-10">
      <AtsPageHeader
        eyebrow="ATS · Hunting"
        title="Instalar a extensão TechHire Hunter"
        description="A extensão adiciona uma sidebar nos perfis e listas do LinkedIn pra capturar candidatos direto pro TechHire."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <FormSection
              title="Passo a passo"
              description="A extensão fica em beta privado. Use o pacote .zip abaixo e instale em modo desenvolvedor."
            >
              <ol className="ml-4 list-decimal space-y-3 text-sm text-text-secondary">
                <li>
                  <span className="font-medium text-text-primary">Baixe o pacote</span> da extensão
                  (.zip) e descompacte numa pasta local.
                  <div className="mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        fetch("/techhire-hunter.zip")
                          .then((r) => {
                            if (!r.ok) throw new Error(`HTTP ${r.status}`);
                            return r.blob();
                          })
                          .then((blob) => {
                            const a = document.createElement("a");
                            a.href = URL.createObjectURL(blob);
                            a.download = "techhire-hunter.zip";
                            a.click();
                            URL.revokeObjectURL(a.href);
                          })
                          .catch((e) => alert(`Download falhou: ${e.message}`));
                      }}
                    >
                      <Download className="mr-1 h-3.5 w-3.5" />
                      techhire-hunter.zip
                    </Button>
                  </div>
                </li>
                <li>
                  Após instalar, abra{" "}
                  <a className="underline" href="/auth/extension-link">
                    /auth/extension-link
                  </a>{" "}
                  pra parear a extensão automaticamente (sem copy-paste no popup).
                </li>
                <li>
                  Abra o Chrome/Edge em{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">chrome://extensions</code>{" "}
                  e ative o <span className="font-medium">Modo do desenvolvedor</span>.
                </li>
                <li>
                  Clique em <span className="font-medium">"Carregar sem compactação"</span> e
                  selecione a pasta descompactada.
                </li>
                <li>
                  Fixe a extensão na barra do navegador. Abra qualquer perfil em{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">linkedin.com/in/...</code>{" "}
                  — a sidebar aparece à direita.
                </li>
                <li>
                  Clique em <span className="font-medium">"Parear com TechHire"</span> na sidebar.
                  Você será levado pra esta janela pra autorizar.
                </li>
                <li>
                  Pronto. Em cada perfil, use{" "}
                  <span className="font-medium">"Salvar candidato"</span>, vincule a uma vaga e
                  dispare a mensagem direto do template.
                </li>
              </ol>
            </FormSection>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <PairingStatusPanel />
          <Card>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center gap-2">
                <Chrome className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">Compatibilidade</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline">Chrome 120+</Badge>
                <Badge variant="outline">Edge 120+</Badge>
                <Badge variant="outline">Brave</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Manifest V3. Não usa APIs oficiais do LinkedIn — toda captura é local, no contexto
                da sua sessão autenticada.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-status-open" />
                <p className="text-sm font-semibold">Privacidade & limites</p>
              </div>
              <ul className="ml-4 list-disc space-y-1.5 text-xs text-muted-foreground">
                <li>
                  Cada captura é registrada em <code>ats_hunting_captures</code>.
                </li>
                <li>Deduplicação por URL canônica do LinkedIn.</li>
                <li>Sem scraping em background — só quando você abre o perfil.</li>
                <li>Respeite os Termos de Uso do LinkedIn.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">Pareamento</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Após instalar, gere um token pessoal em{" "}
                <a href="/settings/api-keys" className="underline">
                  Configurações · API keys
                </a>{" "}
                e cole na sidebar da extensão.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
