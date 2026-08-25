// Checklist de onboarding por módulo. Marca-se passos por workspace/usuário no
// localStorage (rápido e sem migration adicional).
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useActiveModuleDefinition } from "@/lib/modules/active-module";
import { useAuth } from "@/lib/auth";

type Step = { id: string; title: string; href: string; description: string };

const STEPS: Record<string, Step[]> = {
  crm: [
    {
      id: "crm.first_lead",
      title: "Criar seu primeiro lead",
      href: "/leads",
      description: "Comece capturando um lead manual ou via formulário.",
    },
    {
      id: "crm.first_deal",
      title: "Criar um negócio",
      href: "/deals",
      description: "Transforme um lead qualificado em oportunidade.",
    },
    {
      id: "crm.connect_email",
      title: "Conectar caixa de e-mail",
      href: "/settings/email",
      description: "Integre Gmail/Outlook para sincronizar mensagens.",
    },
    {
      id: "crm.invite_team",
      title: "Convidar equipe",
      href: "/settings/teams",
      description: "Adicione vendedores ao workspace.",
    },
  ],
  ats: [
    {
      id: "ats.first_job",
      title: "Publicar 1ª vaga",
      href: "/jobs",
      description: "Crie uma vaga e marque como publicada.",
    },
    {
      id: "ats.first_candidate",
      title: "Cadastrar candidato",
      href: "/candidates",
      description: "Cadastre manualmente ou faça parsing de CV com IA.",
    },
    {
      id: "ats.stage_emails",
      title: "Configurar e-mails por etapa",
      href: "/stage-emails",
      description: "Automatize comunicações com candidatos.",
    },
    {
      id: "ats.scorecard",
      title: "Criar scorecard de entrevista",
      href: "/scorecards",
      description: "Padronize avaliação de candidatos.",
    },
    {
      id: "ats.public_page",
      title: "Conectar domínio público",
      href: "/settings/branding",
      description: "Configure o domínio das páginas de carreira.",
    },
  ],
};

function storageKey(uid: string | null | undefined, moduleId: string) {
  return `onboarding:${uid ?? "anon"}:${moduleId}`;
}

export function OnboardingChecklist() {
  const { id: moduleId, name } = useActiveModuleDefinition();
  const { user } = useAuth();
  const steps = STEPS[moduleId] ?? [];

  const key = storageKey(user?.id, moduleId);
  const completed = useMemo(() => {
    if (typeof window === "undefined") return new Set<string>();
    try {
      return new Set<string>(JSON.parse(localStorage.getItem(key) || "[]"));
    } catch {
      return new Set<string>();
    }
  }, [key]);

  const toggle = (id: string) => {
    if (typeof window === "undefined") return;
    const next = new Set(completed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    localStorage.setItem(key, JSON.stringify(Array.from(next)));
    // força re-render simples
    window.dispatchEvent(new Event("storage"));
  };

  if (steps.length === 0) return null;
  const doneCount = steps.filter((s) => completed.has(s.id)).length;
  if (doneCount === steps.length) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Primeiros passos no {name}</span>
          <span className="text-xs text-muted-foreground font-normal">
            {doneCount}/{steps.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {steps.map((s) => {
          const done = completed.has(s.id);
          return (
            <div
              key={s.id}
              className="flex items-start gap-3 rounded-md border p-3 hover:border-primary/40"
            >
              <button onClick={() => toggle(s.id)} className="mt-0.5" aria-label="toggle">
                {done ? (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <div
                  className={`text-sm font-medium ${done ? "line-through text-muted-foreground" : ""}`}
                >
                  {s.title}
                </div>
                <div className="text-xs text-muted-foreground">{s.description}</div>
              </div>
              <Link to={s.href as string}>
                <Button size="sm" variant="ghost">
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
