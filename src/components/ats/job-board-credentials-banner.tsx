// Banner informativo para providers em modo MOCK (Onda 5 / Slice 5.4).
import { AlertTriangle, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Provider = {
  slug: string;
  name: string;
  isMock: boolean;
  envVars: string[];
  docs?: string;
};

const PROVIDERS: Provider[] = [
  {
    slug: "linkedin",
    name: "LinkedIn Jobs",
    isMock: true,
    envVars: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET", "LINKEDIN_ORG_URN"],
    docs: "https://learn.microsoft.com/linkedin/talent",
  },
  {
    slug: "indeed",
    name: "Indeed",
    isMock: true,
    envVars: ["INDEED_PUBLISHER_ID", "INDEED_API_KEY"],
    docs: "https://docs.indeed.com",
  },
  {
    slug: "vagas_com",
    name: "Vagas.com",
    isMock: true,
    envVars: ["VAGAS_COM_API_KEY", "VAGAS_COM_COMPANY_ID"],
  },
];

export function JobBoardCredentialsBanner() {
  return (
    <Card className="border-amber-300/40 bg-amber-50/30 dark:bg-amber-950/10">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          Job boards em modo simulado
        </div>
        <p className="text-xs text-muted-foreground">
          As publicações são persistidas mas nenhum job board recebe a vaga enquanto as credenciais
          não estiverem configuradas. Cada provider exige o seu próprio app/contrato — abaixo o que
          falta para sair do modo simulado.
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {PROVIDERS.map((p) => (
            <div key={p.slug} className="rounded-md border border-border/60 bg-background/60 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{p.name}</span>
                <Badge variant="outline" className="text-[10px]">
                  {p.isMock ? "Simulado" : "Ativo"}
                </Badge>
              </div>
              <ul className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                {p.envVars.map((v) => (
                  <li key={v} className="font-mono">
                    {v}
                  </li>
                ))}
              </ul>
              {p.docs && (
                <a
                  href={p.docs}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  Documentação
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
