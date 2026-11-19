import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Label } from "@/components/ui/label";
import { SearchCreateField } from "@/components/ui/search-create-field";
import { SearchCreateRecordDialog } from "@/components/record/search-create-record-dialog";
import { searchCreateResources, type SearchCreateEntity } from "@/lib/search-create-entities";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { readViewAs } from "@/lib/view-as-client";
import { useAuth } from "@/lib/auth";
import { searchPreparationPicker } from "@/lib/hiring/requests/requests.functions";
import type { RequestKind, PickerKind } from "@/lib/hiring/requests/types";
import { useDebouncedValue } from "@/lib/use-debounced-value";

export function PreparationReferenceField({
  kind,
  picker,
  label,
  value,
  onChange,
  disabled,
  company,
  commercialContractId,
  allowCreate = true,
}: {
  kind: RequestKind;
  picker: PickerKind;
  label: string;
  value: string | null;
  onChange: (id: string | null) => void;
  disabled: boolean;
  company: string | null;
  commercialContractId?: string | null;
  allowCreate?: boolean;
}) {
  const p = usePermissions(),
    { user } = useAuth(),
    client = useQueryClient();
  const [text, setText] = useState(""),
    [focused, setFocused] = useState(false),
    [creating, setCreating] = useState<{
      name: string;
      actorId: string;
      workspaceId: string;
    } | null>(null),
    [creationError, setCreationError] = useState("");
  const term = useDebouncedValue(text, 300);
  const fn = useServerFn(searchPreparationPicker);
  const allowed = !p.isLoading && !p.isError && !!p.workspaceId && !!user?.id;
  const permissionKey = [...p.permissions]
    .filter(
      (key) =>
        key.startsWith(
          kind === "supplier" ? "techcontracts.supplier_requests." : "techpeople.hiring_requests.",
        ) || key.startsWith(searchCreateResources[picker as SearchCreateEntity] ?? "__none__"),
    )
    .sort()
    .join("|");
  const context = [user?.id, p.workspaceId, permissionKey, kind, picker, company];
  const selected = useQuery({
    queryKey: ["preparation-picker-label-v2", ...context, value],
    enabled: allowed && !!value,
    queryFn: () => fn({ data: { kind, picker, search: "", selected: value, company } }),
    retry: false,
    staleTime: 0,
  });
  const options = useQuery({
    queryKey: ["preparation-picker-v2", ...context, term],
    enabled:
      allowed &&
      focused &&
      !value &&
      (term.trim().length >= 2 ||
        ["area", "legal_entity", "person"].includes(picker) ||
        (picker === "contact" && !!company)),
    queryFn: () => fn({ data: { kind, picker, search: term, selected: null, company } }),
    retry: false,
    staleTime: 0,
  });
  const resource = searchCreateResources[picker as SearchCreateEntity];
  const canCreate =
    allowCreate &&
    allowed &&
    !disabled &&
    !readViewAs()?.readOnly &&
    !!resource &&
    p.canAny(["own", "team", "workspace"].map((scope) => `${resource}.create.${scope}`)) &&
    p.canAny(["own", "team", "workspace"].map((scope) => `${resource}.view.${scope}`));
  const unavailable = !allowed || (picker === "contact" && !company);
  async function created(id: string) {
    setCreating(null);
    // Recheck visibility, workspace, role and supplier relation before selecting the new ID.
    try {
      const found = await fn({ data: { kind, picker, search: "", selected: id, company } });
      if (!found.some((option) => option.id === id))
        throw Error(
          "Cadastro criado, mas indisponível para este vínculo. Confira o tipo, a empresa e suas permissões.",
        );
      await client.invalidateQueries({ queryKey: ["preparation-picker-v2"] });
      setText(found[0].label);
      onChange(id);
    } catch (error) {
      setCreationError((error as Error).message);
    }
  }
  return (
    <div className="space-y-2">
      <Label htmlFor={`choose-${picker}`}>{label}</Label>
      <SearchCreateField
        id={`choose-${picker}`}
        label={label}
        text={
          value
            ? selected.isFetching
              ? "Carregando vínculo…"
              : (selected.data?.[0]?.label ?? "Vínculo indisponível")
            : text
        }
        selectedId={value}
        options={options.data ?? []}
        loading={options.isFetching}
        searched={options.isSuccess}
        error={
          creationError ||
          (selected.isError || options.isError
            ? "Não foi possível carregar as opções disponíveis."
            : !allowed && !p.isLoading
              ? "Não foi possível verificar o acesso."
              : null)
        }
        disabled={disabled || unavailable}
        onTextChange={(next) => {
          setCreationError("");
          setText(next);
          if (value) onChange(null);
        }}
        onFocus={() => setFocused(true)}
        onPick={(option) => {
          setText(option.label);
          onChange(option.id);
        }}
        onClear={() => {
          setText("");
          setCreationError("");
          onChange(null);
        }}
        onCreate={
          canCreate
            ? (name) => {
                setCreationError("");
                setCreating({ name, actorId: user!.id, workspaceId: p.workspaceId! });
              }
            : undefined
        }
        onRetry={() => {
          setCreationError("");
          if (value) void selected.refetch();
          else void options.refetch();
        }}
      />
      {picker === "contact" && !company && (
        <p className="text-xs text-muted-foreground">Selecione primeiro a empresa fornecedora.</p>
      )}
      {creating !== null && canCreate && (
        <SearchCreateRecordDialog
          key={`${p.workspaceId}:${picker}:${company ?? ""}`}
          entity={picker as SearchCreateEntity}
          name={creating.name}
          actorId={creating.actorId}
          workspaceId={creating.workspaceId}
          companyId={company}
          commercialContractId={commercialContractId}
          onClose={() => setCreating(null)}
          onCreated={(id) => void created(id)}
        />
      )}
    </div>
  );
}
