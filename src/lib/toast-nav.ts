import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useCallback } from "react";

type NavigateFn = ReturnType<typeof useNavigate>;

/**
 * Hook para emitir toasts de sucesso de criação com uma ação "Ir para [entidade]"
 * que navega ao detalhe do registro recém-criado usando o router type-safe.
 *
 * Uso:
 *   const toastCreated = useToastCreated();
 *   toastCreated("Lead criado", "Ir para o lead", (nav) =>
 *     nav({ to: "/leads/$id", params: { id } }),
 *   );
 */
export function useToastCreated() {
  const navigate = useNavigate();

  return useCallback(
    (message: string, actionLabel: string, go: (nav: NavigateFn) => void) => {
      toast.success(message, {
        action: {
          label: actionLabel,
          onClick: () => go(navigate),
        },
      });
    },
    [navigate],
  );
}
