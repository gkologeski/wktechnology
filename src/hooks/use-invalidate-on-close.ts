// Hooks utilitários para revalidar dados após o fechamento de modais/diálogos
// e ao ganhar foco novamente. Reduz a necessidade de F5 após edições.
import { useEffect, useRef, useCallback } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";

/**
 * Invalida as queries indicadas quando `open` transiciona de true → false.
 * Uso: `useInvalidateOnClose(open, [["leads", id]])` no componente pai do modal.
 */
export function useInvalidateOnClose(open: boolean, keys: QueryKey[]) {
  const qc = useQueryClient();
  const prev = useRef(open);
  useEffect(() => {
    if (prev.current && !open) {
      for (const k of keys) qc.invalidateQueries({ queryKey: k });
    }
    prev.current = open;
    // keys stringificado seria caro; confiamos que o consumidor mantém referência estável
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}

/**
 * Invalida todas as queries ativas (montadas) quando a aba volta a receber foco
 * ou quando `visibilitychange` fica visível. Complementa `refetchOnWindowFocus`
 * do QueryClient — útil para telas que dependem de dados agregados.
 */
export function useRefetchOnFocus(callback?: () => void) {
  const qc = useQueryClient();
  const cbRef = useRef(callback);
  cbRef.current = callback;

  const run = useCallback(() => {
    if (cbRef.current) cbRef.current();
    else qc.invalidateQueries({ refetchType: "active" });
  }, [qc]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onFocus = () => run();
    const onVis = () => {
      if (!document.hidden) run();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [run]);
}
