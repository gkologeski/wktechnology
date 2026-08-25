import { Briefcase } from "lucide-react";
import { AtsSectionHeader, EmptyState } from "@/components/ats/ui";

export function JobOverviewPanel({
  description,
  requirements,
}: {
  description: string | null;
  requirements: string | null;
}) {
  return (
    <div className="space-y-4">
      {description || requirements ? (
        <section className="rounded-lg border border-border-subtle bg-surface-1 shadow-xs">
          <div className="grid md:grid-cols-2 gap-6 p-5 text-sm">
            {description && (
              <div>
                <AtsSectionHeader title="Descrição" />
                <p className="mt-2 text-text-secondary whitespace-pre-wrap leading-relaxed">
                  {description}
                </p>
              </div>
            )}
            {requirements && (
              <div>
                <AtsSectionHeader title="Requisitos" />
                <p className="mt-2 text-text-secondary whitespace-pre-wrap leading-relaxed">
                  {requirements}
                </p>
              </div>
            )}
          </div>
        </section>
      ) : (
        <EmptyState
          icon={Briefcase}
          title="Sem descrição"
          description="Edite a vaga no painel à esquerda para adicionar descrição e requisitos."
        />
      )}
    </div>
  );
}
