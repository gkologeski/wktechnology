import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { endViewAs } from "@/lib/view-as.functions";
import { exitViewAs, readViewAs, type ViewAsState } from "@/lib/view-as-client";

/** Faixa fixa enquanto o admin navega com o acesso de outra pessoa/papel. */
export function ViewAsBanner() {
  const [state, setState] = useState<ViewAsState | null>(null);
  const [leaving, setLeaving] = useState(false);
  const end = useServerFn(endViewAs);

  useEffect(() => setState(readViewAs()), []);

  const leave = async () => {
    setLeaving(true);
    await exitViewAs(end);
  };

  // Sessão expirada (1h): volta automaticamente ao acesso do administrador.
  useEffect(() => {
    if (!state) return;
    const ms = new Date(state.expiresAt).getTime() - Date.now();
    const t = setTimeout(() => void exitViewAs(end), Math.max(ms, 0));
    return () => clearTimeout(t);
  }, [state, end]);

  if (!state) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-wrap items-center gap-2 border-b border-warning/40 bg-warning/15 px-4 py-2 text-sm text-foreground"
    >
      <Eye className="h-4 w-4 shrink-0" aria-hidden />
      <span className="font-medium">Você está vendo como {state.label}.</span>
      <span className="text-muted-foreground">
        {state.readOnly
          ? "Modo teste: leads, empresas, contatos, negócios e atividades que você criar serão apagados em até 1h. Dados reais não podem ser alterados e envios estão bloqueados."
          : "Ações e envios são reais e serão feitos em nome desta pessoa, conforme seus acessos."}
      </span>
      <div className="flex-1" />
      <Button size="sm" variant="outline" onClick={leave} disabled={leaving}>
        {leaving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
        Voltar ao meu acesso
      </Button>
    </div>
  );
}
