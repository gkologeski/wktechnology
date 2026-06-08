import { useEffect, useRef, useState } from "react";
import { Building2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CompanyPickerValue = { id: string | null; name: string };

type Match = { id: string; name: string; domain: string | null; phone: string | null };

// Remove caracteres que quebram o filtro .or() do PostgREST
function sanitizeOrTerm(q: string) {
  return q.replace(/[,()%]/g, " ").trim();
}

export interface CompanyPickerProps {
  /**
   * "pick_or_create": permite texto livre (ex.: leads.company_name).
   * "pick": só permite selecionar empresa existente (FK company_id).
   */
  mode?: "pick" | "pick_or_create";
  value: CompanyPickerValue;
  onChange: (v: CompanyPickerValue) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Emitir toast quando matches aparecem (útil no Criar lead). */
  toastOnMatches?: boolean;
  /** Buscar o nome quando recebemos só o id. Default: true. */
  hydrateById?: boolean;
  id?: string;
  className?: string;
}

export function CompanyPicker({
  mode = "pick_or_create",
  value,
  onChange,
  placeholder = "Buscar ou criar",
  disabled,
  autoFocus,
  toastOnMatches = false,
  hydrateById = true,
  id,
  className,
}: CompanyPickerProps) {
  const [matches, setMatches] = useState<Match[]>([]);
  const lastSearchedRef = useRef<string>("");

  // Hidrata nome quando recebemos só o id.
  useEffect(() => {
    if (!hydrateById) return;
    if (!value.id || value.name) return;
    let cancel = false;
    (async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name")
        .eq("id", value.id!)
        .maybeSingle();
      if (cancel || error || !data) return;
      onChange({ id: data.id as string, name: (data.name as string) ?? "" });
    })();
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.id, hydrateById]);

  // Busca de empresas a partir de 3 caracteres.
  useEffect(() => {
    const q = value.name.trim();
    if (q.length < 3) {
      setMatches([]);
      return;
    }
    if (value.id) {
      // Já está vinculado a uma empresa específica: não polui com sugestões.
      setMatches([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name")
        .ilike("name", `%${q}%`)
        .order("name", { ascending: true })
        .limit(500);
      if (error) return;
      const rows = (data ?? []) as Match[];
      setMatches(rows);
      if (toastOnMatches && rows.length > 0 && lastSearchedRef.current !== q) {
        lastSearchedRef.current = q;
        toast.info(
          rows.length === 1
            ? `1 empresa parecida encontrada: ${rows[0].name}`
            : `${rows.length} empresas parecidas encontradas`,
          { description: "Clique em uma para reutilizar." },
        );
      } else if (rows.length === 0) {
        lastSearchedRef.current = q;
      }
    }, 350);
    return () => clearTimeout(t);
  }, [value.name, value.id, toastOnMatches]);

  const handleType = (text: string) => {
    // Se estava vinculado e o texto mudou, desvincula.
    if (value.id) {
      onChange({ id: null, name: text });
    } else {
      onChange({ id: value.id, name: text });
    }
  };

  const select = (m: Match) => {
    onChange({ id: m.id, name: m.name });
    setMatches([]);
    lastSearchedRef.current = m.name;
  };

  const clear = () => {
    onChange({ id: null, name: "" });
    setMatches([]);
    lastSearchedRef.current = "";
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="relative">
        <Input
          id={id}
          value={value.name}
          onChange={(e) => handleType(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
        />
        {(value.id || value.name) && !disabled && (
          <button
            type="button"
            aria-label="Limpar"
            onClick={clear}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {value.id && (
        <div className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs">
          <Building2 className="h-3.5 w-3.5 text-primary" />
          <span className="truncate">
            Vinculada a <strong>{value.name}</strong>
          </span>
        </div>
      )}

      {matches.length > 0 && (
        <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border bg-muted/30 p-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Empresas parecidas
          </p>
          {matches.map((m) => (
            <Button
              key={m.id}
              type="button"
              variant="ghost"
              className="h-auto w-full justify-start gap-2 px-2 py-1 text-sm font-normal"
              onClick={() => select(m)}
            >
              <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{m.name}</span>
            </Button>
          ))}
        </div>
      )}

      {mode === "pick" && !value.id && value.name.trim().length >= 3 && matches.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          Nenhuma empresa encontrada. Selecione uma existente.
        </p>
      )}
    </div>
  );
}
