import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Circle, X } from "lucide-react";

const DISMISS_KEY = "wk_onboarding_dismissed";

export function OnboardingChecklist() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["onboarding-checklist"],
    queryFn: async () => {
      const [contacts, deals, pipelines, members, invites, integrations] = await Promise.all([
        supabase.from("contacts").select("id", { head: true, count: "exact" }),
        supabase.from("deals").select("id", { head: true, count: "exact" }),
        supabase.from("pipelines").select("id", { head: true, count: "exact" }),
        supabase.from("workspace_members").select("id", { head: true, count: "exact" }),
        supabase.from("workspace_invites").select("id", { head: true, count: "exact" }),
        supabase.from("integrations").select("id", { head: true, count: "exact" }),
      ]);
      return {
        contacts: (contacts.count ?? 0) > 0,
        deals: (deals.count ?? 0) > 0,
        pipelines: (pipelines.count ?? 0) > 0,
        team: (members.count ?? 0) > 1 || (invites.count ?? 0) > 0,
        integrations: (integrations.count ?? 0) > 0,
      };
    },
    enabled: !dismissed,
    staleTime: 60_000,
  });

  if (dismissed || isLoading || !data) return null;

  const steps = [
    {
      done: data.pipelines,
      label: "Configure seu pipeline de vendas",
      to: "/settings/pipelines" as const,
    },
    {
      done: data.contacts,
      label: "Importe ou cadastre seu primeiro contato",
      to: "/contacts" as const,
    },
    { done: data.deals, label: "Crie sua primeira oportunidade", to: "/deals" as const },
    {
      done: data.integrations,
      label: "Conecte uma integração (Google, WhatsApp, etc.)",
      to: "/settings/integrations" as const,
    },
    {
      done: data.team,
      label: "Convide um membro do seu time",
      to: "/settings/teams" as const,
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  if (completed === steps.length) return null;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base">
            Configure seu CRM ({completed}/{steps.length})
          </CardTitle>
          <CardDescription>Conclua os passos para tirar o máximo da plataforma.</CardDescription>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, "1");
            setDismissed(true);
          }}
          aria-label="Dispensar"
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {steps.map((s) => (
            <li key={s.label} className="flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2">
                {s.done ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                <span className={s.done ? "text-muted-foreground line-through" : ""}>
                  {s.label}
                </span>
              </div>
              {!s.done && (
                <Button asChild size="sm" variant="outline">
                  <Link to={s.to}>Configurar</Link>
                </Button>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
