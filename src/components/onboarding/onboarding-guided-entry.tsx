// Botão discreto que aparece dentro de diálogos de criação (lead, empresa,
// contato) quando existe um template ativo de onboarding para a entidade.
// Navega para o wizard /onboarding/$entity fechando o diálogo atual.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pickOnbTemplate, type OnbEntityType } from "@/lib/onboarding/onboarding.functions";

const ENTITY_TO_ROUTE: Record<OnbEntityType, "leads" | "companies" | "contacts"> = {
  lead: "leads",
  company: "companies",
  contact: "contacts",
};

export function OnboardingGuidedEntry({
  entity,
  onNavigate,
}: {
  entity: OnbEntityType;
  /** Callback opcional para fechar o diálogo antes de navegar. */
  onNavigate?: () => void;
}) {
  const pickFn = useServerFn(pickOnbTemplate);
  const q = useQuery({
    queryKey: ["onboarding-guided-entry", entity],
    queryFn: () => pickFn({ data: { entity_type: entity } }),
    staleTime: 60_000,
  });

  if (!q.data?.template) return null;

  return (
    <div className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-sm flex items-center gap-2">
      <Sparkles className="h-4 w-4 text-primary shrink-0" aria-hidden />
      <span className="text-muted-foreground">
        Prefere um cadastro guiado? Use o modelo{" "}
        <strong className="text-foreground">{q.data.template.name}</strong>.
      </span>
      <Button
        asChild
        size="sm"
        variant="outline"
        className="ml-auto"
        onClick={() => onNavigate?.()}
      >
        <Link to="/onboarding/$entity" params={{ entity: ENTITY_TO_ROUTE[entity] }}>
          Usar onboarding guiado
        </Link>
      </Button>
    </div>
  );
}
