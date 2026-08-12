// Rota de onboarding guiado. /onboarding/$entity com wizard dirigido por template.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { ensureLeadRelationsSafe } from "@/lib/leads/lead-relations";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import {
  listOnbTemplates,
  startOnbRun,
  type OnbEntityType,
  type OnbTemplateRow,
} from "@/lib/onboarding/onboarding.functions";

const ENTITY_ALIAS: Record<string, OnbEntityType> = {
  leads: "lead",
  companies: "company",
  contacts: "contact",
  lead: "lead",
  company: "company",
  contact: "contact",
};

const ENTITY_LABEL: Record<OnbEntityType, string> = {
  lead: "Lead",
  company: "Empresa",
  contact: "Contato",
};

const searchSchema = z.object({
  segment: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/onboarding/$entity")({
  validateSearch: (s) => searchSchema.parse(s),
  head: ({ params }) => ({
    meta: [
      { title: `Onboarding guiado · ${params.entity}` },
      {
        name: "description",
        content:
          "Wizard guiado para criação de leads, contatos e empresas com templates de campos, tarefas e workflows.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OnboardingEntityPage,
});

type Primitive = string | number | boolean | null;

async function createEntity(
  entityType: OnbEntityType,
  ownerId: string,
  form: Record<string, Primitive>,
  template: OnbTemplateRow,
): Promise<string> {
  // Mapeia form → colunas reais via target_column definido em cada field
  const columnMap: Record<string, string> = {};
  for (const step of template.field_config) {
    for (const f of step.fields) {
      const col = f.target_column ?? f.name;
      columnMap[f.name] = col;
    }
  }
  const payload: Record<string, Primitive> = { owner_id: ownerId };
  for (const [k, v] of Object.entries(form)) {
    const col = columnMap[k] ?? k;
    if (v === "" || v === undefined) continue;
    payload[col] = v;
  }

  if (entityType === "lead") {
    payload.status = payload.status ?? "new";
    const { data, error } = await supabase
      .from("leads")
      .insert(payload as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    // Garante empresa e contato vinculados ao lead
    await ensureLeadRelationsSafe(supabase, data!.id as string);
    return data!.id as string;
  }
  if (entityType === "company") {
    const { data, error } = await supabase
      .from("companies")
      .insert(payload as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return data!.id as string;
  }
  const { data, error } = await supabase
    .from("contacts")
    .insert(payload as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data!.id as string;
}

function OnboardingEntityPage() {
  const params = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const entityType = ENTITY_ALIAS[params.entity];

  const listFn = useServerFn(listOnbTemplates);
  const startFn = useServerFn(startOnbRun);

  const [selectedId, setSelectedId] = useState<string>("");
  const [runId, setRunId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["onb-templates", entityType],
    queryFn: () => listFn({ data: { entity_type: entityType } }),
    enabled: !!entityType,
  });

  const templates = q.data?.templates ?? [];

  // Seleciona template automaticamente por segmento ou default
  useEffect(() => {
    if (selectedId || templates.length === 0) return;
    if (search.segment) {
      const seg = templates.find(
        (t) => t.segment_value?.toLowerCase() === search.segment?.toLowerCase(),
      );
      if (seg) return setSelectedId(seg.id);
    }
    const def = templates.find((t) => t.is_default) ?? templates[0];
    setSelectedId(def.id);
  }, [templates, search.segment, selectedId]);

  // Inicia run quando template selecionado
  useEffect(() => {
    if (!selectedId || runId) return;
    startFn({ data: { template_id: selectedId, entity_type: entityType } })
      .then((r) => setRunId(r.id))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Falha ao iniciar"));
  }, [selectedId, entityType, runId, startFn]);

  const template = templates.find((t) => t.id === selectedId);

  if (!entityType) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Tipo de entidade inválido. Use /onboarding/leads, /onboarding/companies ou
            /onboarding/contacts.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title={`Onboarding · ${ENTITY_LABEL[entityType]}`}
        description="Wizard guiado com autosave. Ao concluir, tarefas e workflows do template são disparados automaticamente."
      />

      {q.isLoading ? (
        <Skeleton className="h-64 w-full max-w-2xl mx-auto" />
      ) : templates.length === 0 ? (
        <Card className="max-w-2xl mx-auto">
          <CardContent className="py-12 text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Nenhum modelo de onboarding cadastrado para {ENTITY_LABEL[entityType].toLowerCase()}.
            </p>
            <Button asChild size="sm">
              <a href="/settings/onboarding-templates">Criar primeiro modelo</a>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4 max-w-2xl mx-auto">
          {templates.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Modelo:</span>
              <Select
                value={selectedId}
                onValueChange={(v) => {
                  setSelectedId(v);
                  setRunId(null);
                }}
              >
                <SelectTrigger className="w-72">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                      {t.segment_value && ` · ${t.segment_value}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {template && runId && user && (
            <OnboardingWizard
              key={runId}
              template={template}
              runId={runId}
              onCreateEntity={(data) => createEntity(entityType, user.id, data, template)}
              onCompleted={({ entity_id }) => {
                const target =
                  entityType === "lead"
                    ? `/leads/${entity_id}`
                    : entityType === "company"
                      ? `/companies/${entity_id}`
                      : `/contacts/${entity_id}`;
                navigate({ to: target });
              }}
              onCancel={() => navigate({ to: "/home" })}
            />
          )}
        </div>
      )}
    </div>
  );
}
