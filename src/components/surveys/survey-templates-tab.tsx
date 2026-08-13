import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CrudSettings, type CrudField } from "@/components/crud-settings";
import { Button } from "@/components/ui/button";
import { ListChecks } from "lucide-react";
import { SurveyQuestionsDialog } from "@/components/surveys/survey-questions-dialog";

export type SurveyTemplateKind = "csat" | "nps" | "form";

const COPY: Record<SurveyTemplateKind, { title: string; description: string }> = {
  csat: {
    title: "Pesquisas CSAT",
    description: "Satisfação (0–5). Configure pergunta, canal e disparo automático.",
  },
  nps: {
    title: "Pesquisas NPS",
    description: "Recomendação (0–10). Configure pergunta, canal e disparo automático.",
  },
  form: {
    title: "Pesquisas livres",
    description:
      "Formulários abertos, montados com os campos padrão de pesquisa. Use em atividades de qualquer entidade.",
  },
};

/** Lista e edita modelos de pesquisa de um tipo específico (CSAT, NPS ou Livre). */
export function SurveyTemplatesTab({ kind = "csat" }: { kind?: SurveyTemplateKind }) {
  const [ctx, setCtx] = useState<{ userId: string; workspaceId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [questionsFor, setQuestionsFor] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id;
      if (!userId) {
        setError("Sessão não encontrada.");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("active_workspace_id")
        .eq("id", userId)
        .maybeSingle();
      let workspaceId =
        (profile as { active_workspace_id: string | null } | null)?.active_workspace_id ?? null;
      if (!workspaceId) {
        const { data: m } = await supabase
          .from("workspace_members")
          .select("workspace_id")
          .eq("user_id", userId)
          .limit(1)
          .maybeSingle();
        workspaceId = (m?.workspace_id as string | undefined) ?? null;
      }
      if (!workspaceId) {
        setError("Nenhum workspace ativo.");
        return;
      }
      setCtx({ userId, workspaceId });
    })();
  }, []);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!ctx) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  const isForm = kind === "form";

  const fields: CrudField[] = isForm
    ? [
        { name: "name", label: "Nome", required: true },
        { name: "description", label: "Descrição", type: "textarea" },
        { name: "is_active", label: "Ativa", type: "switch" },
      ]
    : [
        { name: "name", label: "Nome", required: true },
        { name: "description", label: "Descrição", type: "textarea" },
        {
          name: "question",
          label: "Pergunta exibida ao respondente",
          type: "textarea",
          required: true,
        },
        { name: "invite_subject", label: "Assunto do convite" },
        { name: "invite_body", label: "Corpo do convite", type: "textarea" },
        { name: "channel", label: "Canal (email, whatsapp, both)", placeholder: "email" },
        {
          name: "trigger_event",
          label: "Disparo (ticket_resolved, ticket_closed, manual)",
          placeholder: "ticket_resolved",
        },
        { name: "delay_minutes", label: "Atraso (minutos)", type: "number" },
        { name: "is_active", label: "Ativa", type: "switch" },
        { name: "is_default", label: "Padrão", type: "switch" },
      ];

  return (
    <>
      <CrudSettings<{ id: string; name: string }>
        table="survey_templates"
        title={COPY[kind].title}
        description={COPY[kind].description}
        filter={{ kind }}
        defaults={{
          channel: "email",
          trigger_event: isForm ? "manual" : "ticket_resolved",
          delay_minutes: 0,
          is_active: true,
          is_default: false,
        }}
        extraInsert={{
          owner_id: ctx.userId,
          workspace_id: ctx.workspaceId,
          scope: isForm ? "activity" : "ticket",
        }}
        fields={fields}
        rowActions={(row) => (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setQuestionsFor({ id: row.id, name: row.name })}
          >
            <ListChecks className="h-3.5 w-3.5" aria-hidden /> Perguntas
          </Button>
        )}
        columns={
          isForm
            ? [
                { key: "name", label: "Nome" },
                {
                  key: "is_active",
                  label: "Ativa",
                  render: (r) =>
                    (r as unknown as { is_active: boolean }).is_active ? "Sim" : "Não",
                },
              ]
            : [
                { key: "name", label: "Nome" },
                { key: "trigger_event", label: "Disparo" },
                {
                  key: "is_active",
                  label: "Ativa",
                  render: (r) =>
                    (r as unknown as { is_active: boolean }).is_active ? "Sim" : "Não",
                },
              ]
        }
      />
      <SurveyQuestionsDialog
        open={!!questionsFor}
        onOpenChange={(v) => !v && setQuestionsFor(null)}
        template={questionsFor}
      />
    </>
  );
}
