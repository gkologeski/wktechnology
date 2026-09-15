// Padrões de contrato do workspace: valores pré-preenchidos nas telas de
// criação (manual, a partir do negócio e via workflow).
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/techhire/ui";
import {
  getContractDefaults,
  saveContractDefaults,
} from "@/lib/contracts/contract-defaults.functions";
import type {
  ContractDefaultsBundle,
  ContractDefaultsMap,
} from "@/lib/contracts/contract-defaults-shared";
import { DEFAULTABLE_CONTRACT_FIELDS } from "@/lib/contracts/contract-field-catalog";
import { CONTRACT_KINDS, CONTRACT_KIND_LABEL } from "@/lib/contracts/contract-kinds";
import { ContractFieldsForm } from "./contract-form/contract-fields-form";

type Scope = "general" | (typeof CONTRACT_KINDS)[number];

const SCOPES: { value: Scope; label: string }[] = [
  { value: "general", label: "Todos os tipos" },
  ...CONTRACT_KINDS.map((k) => ({ value: k as Scope, label: CONTRACT_KIND_LABEL[k] })),
];

function scopeDefaults(bundle: ContractDefaultsBundle | undefined, scope: Scope) {
  if (!bundle) return {};
  return scope === "general" ? bundle.general : (bundle.byKind[scope] ?? {});
}

export function ContractDefaultsPage() {
  const load = useServerFn(getContractDefaults);
  const save = useServerFn(saveContractDefaults);
  const [scope, setScope] = useState<Scope>("general");
  const [draft, setDraft] = useState<ContractDefaultsMap>({});
  const [saving, setSaving] = useState(false);

  const query = useQuery({
    queryKey: ["contract-defaults"],
    queryFn: () => load(),
    staleTime: 30_000,
  });

  useEffect(() => {
    setDraft(scopeDefaults(query.data, scope));
  }, [query.data, scope]);

  const fields = useMemo(() => DEFAULTABLE_CONTRACT_FIELDS, []);

  async function submit() {
    setSaving(true);
    try {
      await save({ data: { scope, defaults: draft } });
      toast.success("Padrões salvos.");
      await query.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Padrões de contrato"
        description="Defina os valores que já vêm preenchidos ao criar contratos. O que vier do negócio ou for digitado pelo usuário tem prioridade sobre o padrão."
      />

      {query.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : query.isError ? (
        <div className="rounded-lg border p-6 text-sm">
          <p className="text-destructive">Não foi possível carregar os padrões de contrato.</p>
          <Button variant="outline" className="mt-3" onClick={() => void query.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : (
        <Tabs value={scope} onValueChange={(v) => setScope(v as Scope)}>
          <TabsList>
            {SCOPES.map((s) => (
              <TabsTrigger key={s.value} value={s.value}>
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {SCOPES.map((s) => (
            <TabsContent key={s.value} value={s.value} className="mt-4">
              <ContractFieldsForm
                fields={fields}
                values={draft}
                onChange={(name, value) =>
                  setDraft((cur) => ({
                    ...cur,
                    [name]: value as ContractDefaultsMap[string],
                  }))
                }
              />
              <div className="flex justify-end pt-4">
                <Button onClick={submit} disabled={saving}>
                  {saving ? "Salvando…" : "Salvar padrões"}
                </Button>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
