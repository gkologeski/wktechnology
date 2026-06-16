import { useNavigate, type NavigateOptions } from "@tanstack/react-router";
import { toast } from "sonner";
import { useCallback } from "react";

/**
 * Hook para emitir toasts de sucesso de criação com uma ação "Ir para [entidade]"
 * que navega ao detalhe do registro recém-criado usando o router type-safe.
 */
export function useToastCreated() {
  const navigate = useNavigate();

  return useCallback(
    (message: string, opts: { label?: string; to: NavigateOptions }) => {
      toast.success(message, {
        action: {
          label: opts.label ?? "Ir para o registro",
          onClick: () => {
            void navigate(opts.to);
          },
        },
      });
    },
    [navigate],
  );
}
