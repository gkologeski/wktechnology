// Hook + componentes para aplicar regras de campo (hidden/masked/readonly) na UI.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useCallback } from "react";
import { getMyFieldRules, type FieldMode } from "@/lib/access-control/field-rules.functions";

export type UseFieldRulesResult = {
  isLoading: boolean;
  isPrivileged: boolean;
  /** modo aplicado ao campo, ou null quando sem restrição. */
  modeFor: (field: string) => FieldMode | null;
  isHidden: (field: string) => boolean;
  isMasked: (field: string) => boolean;
  isReadonly: (field: string) => boolean;
  /** substitui valor por máscara quando `masked`; retorna null quando `hidden`. */
  applyValue: <T>(field: string, value: T, maskChar?: string) => T | string | null;
};

function maskString(value: unknown, maskChar = "•"): string {
  if (value == null) return "";
  const s = String(value);
  if (s.length <= 2) return maskChar.repeat(s.length || 3);
  return s.slice(0, 1) + maskChar.repeat(Math.max(3, s.length - 2)) + s.slice(-1);
}

/**
 * Consulta regras de campo do usuário para um `resource` (ex.: "ats_candidates").
 * Cache global em ["my-field-rules"]; invalide após mudanças no /home/access.
 */
export function useFieldRules(resource: string): UseFieldRulesResult {
  const fetchRules = useServerFn(getMyFieldRules);
  const query = useQuery({
    queryKey: ["my-field-rules"],
    queryFn: () => fetchRules(),
    staleTime: 5 * 60_000,
  });

  const bucket = useMemo(() => query.data?.rules?.[resource] ?? {}, [query.data?.rules, resource]);
  const isPrivileged = query.data?.is_privileged ?? false;

  const modeFor = useCallback(
    (field: string): FieldMode | null => {
      if (isPrivileged) return null;
      return (bucket[field] as FieldMode | undefined) ?? null;
    },
    [bucket, isPrivileged],
  );

  const isHidden = useCallback((f: string) => modeFor(f) === "hidden", [modeFor]);
  const isMasked = useCallback((f: string) => modeFor(f) === "masked", [modeFor]);
  const isReadonly = useCallback((f: string) => modeFor(f) === "readonly", [modeFor]);

  const applyValue = useCallback(
    <T,>(field: string, value: T, maskChar?: string): T | string | null => {
      const mode = modeFor(field);
      if (mode === "hidden") return null;
      if (mode === "masked") return maskString(value, maskChar);
      return value;
    },
    [modeFor],
  );

  return {
    isLoading: query.isLoading,
    isPrivileged,
    modeFor,
    isHidden,
    isMasked,
    isReadonly,
    applyValue,
  };
}

/**
 * Renderiza `children` respeitando a regra do campo.
 * - hidden: não renderiza (ou `fallback`).
 * - masked: renderiza `<span>` com valor mascarado (`value` obrigatório).
 * - readonly ou sem regra: renderiza `children`.
 *
 * Uso típico:
 *   <FieldGate resource="ats_candidates" field="salary_expectation" value={c.salary}>
 *     <span>{formatCurrency(c.salary)}</span>
 *   </FieldGate>
 */
export function FieldGate({
  resource,
  field,
  value,
  fallback = null,
  children,
}: {
  resource: string;
  field: string;
  value?: unknown;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { modeFor, isLoading } = useFieldRules(resource);
  if (isLoading) return null;
  const mode = modeFor(field);
  if (mode === "hidden") return <>{fallback}</>;
  if (mode === "masked")
    return (
      <span className="text-muted-foreground italic" title="Campo restrito">
        {maskString(value)}
      </span>
    );
  return <>{children}</>;
}
