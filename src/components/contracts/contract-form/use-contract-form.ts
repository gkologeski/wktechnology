// Estado do formulário de criação de contrato: tipo de documento, padrões do
// workspace, dados do negócio (serviços contratados) e título sugerido.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getDealContractPrefill } from "@/lib/contracts/contract-defaults.functions";
import { effectiveDefaults } from "@/lib/contracts/contract-defaults-shared";
import { fieldsForKind } from "@/lib/contracts/contract-field-catalog";
import { buildContractTitle } from "@/lib/contracts/title";
import type { ContractKind } from "@/lib/contracts/contract-kinds";

export type ContractFormValues = Record<string, unknown>;

export function useContractForm({
  open,
  initialKind,
  initialCompanyId,
  initialDealId,
}: {
  open: boolean;
  initialKind: ContractKind;
  initialCompanyId?: string | null;
  initialDealId?: string | null;
}) {
  const prefillFn = useServerFn(getDealContractPrefill);
  const [kind, setKind] = useState<ContractKind>(initialKind);
  const [values, setValues] = useState<ContractFormValues>({});
  const [hints, setHints] = useState<Record<string, string | null>>({});
  const [selectedItemIds, setSelectedItemIds] = useState<string[] | null>(null);
  const lastSuggestion = useRef<string | null>(null);

  const dealId = (values["deal_id"] as string | null) ?? null;

  const prefill = useQuery({
    queryKey: ["contract-deal-prefill", dealId],
    queryFn: () => prefillFn({ data: { dealId: dealId as string } }),
    enabled: open && !!dealId,
    staleTime: 30_000,
  });

  const ownEntity = useQuery({
    queryKey: ["own-legal-entity-name"],
    queryFn: async () => {
      const { data } = await supabase.from("legal_entities").select("name").limit(1).maybeSingle();
      return (data?.name as string | undefined) ?? null;
    },
    enabled: open,
    staleTime: 300_000,
  });

  const companyId = (values["counterparty_company_id"] as string | null) ?? null;
  const companyQuery = useQuery({
    queryKey: ["contract-form-company-name", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("name")
        .eq("id", companyId as string)
        .maybeSingle();
      return (data?.name as string | undefined) ?? null;
    },
    enabled: open && !!companyId,
    staleTime: 300_000,
  });
  const companyName = companyQuery.data ?? null;

  // Reset ao abrir.
  useEffect(() => {
    if (!open) return;
    setKind(initialKind);
    setValues({
      counterparty_company_id: initialCompanyId ?? null,
      deal_id: initialDealId ?? null,
    });
    setHints({});
    setSelectedItemIds(null);
    lastSuggestion.current = null;
  }, [open, initialKind, initialCompanyId, initialDealId]);

  const setValue = useCallback((name: string, value: unknown) => {
    setValues((current) => ({ ...current, [name]: value }));
    setHints((current) => ({ ...current, [name]: null }));
  }, []);

  // Aplica padrões do workspace e dados do negócio sem sobrescrever o que o
  // usuário digitou.
  useEffect(() => {
    const data = prefill.data;
    if (!data) return;
    const defaults = effectiveDefaults(data.defaults, kind);
    setValues((current) => {
      const next = { ...current };
      const marks: Record<string, string | null> = {};
      const put = (k: string, v: unknown, origin: string) => {
        const cur = next[k];
        const empty = cur === null || cur === undefined || (typeof cur === "string" && !cur.trim());
        if (empty && v !== null && v !== undefined && v !== "") {
          next[k] = v;
          marks[k] = origin;
        }
      };
      Object.entries(data.fields).forEach(([k, v]) => put(k, v, "Do negócio"));
      Object.entries(defaults).forEach(([k, v]) => put(k, v, "Padrão do workspace"));
      setHints((h) => ({ ...h, ...marks }));
      return next;
    });
    setSelectedItemIds((cur) => cur ?? data.lineItems.map((li) => li.id));
  }, [prefill.data, kind]);

  // Título padronizado sugerido, sem sobrescrever o que o usuário digitou.
  useEffect(() => {
    if (!open) return;
    const role = kind === "client" ? "client" : "provider";
    const suggestion = buildContractTitle({
      role,
      documentKind: kind === "amendment" ? "amendment" : "main",
      contractingName: role === "client" ? (ownEntity.data ?? null) : companyName,
      counterpartyName: companyName,
      ownName: ownEntity.data ?? null,
      startsAt: (values["starts_at"] as string | null) ?? null,
    });
    if (!suggestion) return;
    setValues((current) => {
      const currentTitle = String(current["title"] ?? "");
      if (currentTitle === suggestion) return current; // já aplicada: não recria o objeto
      if (currentTitle.trim() && currentTitle !== lastSuggestion.current) return current;
      lastSuggestion.current = suggestion;
      return { ...current, title: suggestion };
    });
  }, [open, kind, companyName, ownEntity.data, values]);

  const fields = useMemo(() => fieldsForKind(kind), [kind]);

  return {
    kind,
    setKind,
    fields,
    values,
    setValue,
    hints,
    companyName,
    prefill,
    selectedItemIds,
    setSelectedItemIds,
  };
}
