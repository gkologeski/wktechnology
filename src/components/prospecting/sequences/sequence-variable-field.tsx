import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Braces } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { isBlockedFilterColumn, type FilterFieldCatalog } from "@/lib/whatsapp/campaign-audience";
import {
  VARIABLE_ENTITIES,
  buildFieldToken,
  columnToPath,
  parseFieldToken,
  type VariableEntity,
} from "@/lib/prospecting/sequences/variable-tokens";

const FIXED = "__fixed__";

export function useFieldLabel(fields: FilterFieldCatalog) {
  return useMemo(() => {
    const map = new Map<string, string>();
    for (const e of VARIABLE_ENTITIES)
      for (const f of fields[e.base] ?? [])
        map.set(`${e.entity}.${columnToPath(f.column)}`, `${e.label} › ${f.label}`);
    return map;
  }, [fields]);
}

function FieldCommand({
  fields,
  selected,
  allowFixed,
  onPick,
}: {
  fields: FilterFieldCatalog;
  selected?: string;
  allowFixed?: boolean;
  onPick: (value: string, entity?: VariableEntity, column?: string) => void;
}) {
  return (
    <Command>
      <CommandInput placeholder="Pesquisar campo…" />
      <CommandList className="max-h-72">
        <CommandEmpty>Nenhum campo encontrado.</CommandEmpty>
        {allowFixed && (
          <CommandGroup>
            <CommandItem value="Texto fixo" onSelect={() => onPick(FIXED)}>
              <Check className={selected === FIXED ? "mr-2 h-4 w-4" : "mr-2 h-4 w-4 opacity-0"} />
              Texto fixo
            </CommandItem>
          </CommandGroup>
        )}
        {VARIABLE_ENTITIES.map((e) => (
          <CommandGroup key={e.entity} heading={e.label}>
            {(fields[e.base] ?? [])
              .filter((f) => !isBlockedFilterColumn(f.column))
              .map((f) => {
                const key = `${e.entity}.${columnToPath(f.column)}`;
                return (
                  <CommandItem
                    key={key}
                    value={`${e.label} ${f.label} ${key}`}
                    onSelect={() => onPick(key, e.entity, f.column)}
                  >
                    <Check
                      className={selected === key ? "mr-2 h-4 w-4" : "mr-2 h-4 w-4 opacity-0"}
                    />
                    {f.label}
                  </CommandItem>
                );
              })}
          </CommandGroup>
        ))}
      </CommandList>
    </Command>
  );
}

/** Valor de variável de modelo: campo de uma entidade (com padrão) ou texto fixo. */
export function SequenceVariableField({
  index,
  value,
  fields,
  disabled,
  onChange,
}: {
  index: number;
  value: string;
  fields: FilterFieldCatalog;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const labels = useFieldLabel(fields);
  const parsed = parseFieldToken(value);
  const [fixedMode, setFixedMode] = useState(!parsed && !!value);
  const key = parsed ? `${parsed.entity}.${parsed.path}` : fixedMode ? FIXED : "";
  const label = parsed ? (labels.get(key) ?? key) : fixedMode ? "Texto fixo" : "Escolha um campo";
  return (
    <div className="space-y-1 rounded-md border p-2 text-xs">
      <span className="font-medium">Variável {`{{${index}}}`}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={`Campo da variável ${index}`}
            disabled={disabled}
            className="w-full justify-between font-normal"
          >
            <span className="truncate">{label}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] min-w-72 p-0" align="start">
          <FieldCommand
            fields={fields}
            selected={key}
            allowFixed
            onPick={(v, entity, column) => {
              setOpen(false);
              if (v === FIXED) {
                setFixedMode(true);
                onChange("");
              } else if (entity && column) {
                setFixedMode(false);
                onChange(buildFieldToken(entity, column, parsed?.fallback));
              }
            }}
          />
        </PopoverContent>
      </Popover>
      {parsed && (
        <label className="block text-muted-foreground">
          Valor padrão se o campo estiver vazio (opcional)
          <Input
            disabled={disabled}
            maxLength={200}
            value={parsed.fallback}
            onChange={(e) =>
              onChange(
                `{{${parsed.entity}.${parsed.path}${e.target.value.replace(/[{}|]/g, "") ? `|${e.target.value.replace(/[{}|]/g, "")}` : ""}}}`,
              )
            }
          />
        </label>
      )}
      {fixedMode && !parsed && (
        <label className="block text-muted-foreground">
          Texto enviado a todos
          <Input
            disabled={disabled}
            maxLength={1000}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </label>
      )}
    </div>
  );
}

/** Botão que insere `{{entidade.campo}}` em textos (assunto/corpo do e-mail). */
export function InsertVariableButton({
  fields,
  disabled,
  onInsert,
}: {
  fields: FilterFieldCatalog;
  disabled: boolean;
  onInsert: (token: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} className="h-7 gap-1 text-xs">
          <Braces className="h-3.5 w-3.5" /> Inserir variável
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <FieldCommand
          fields={fields}
          onPick={(_v, entity, column) => {
            setOpen(false);
            if (entity && column) onInsert(buildFieldToken(entity, column));
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
