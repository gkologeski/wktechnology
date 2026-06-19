import { useEffect } from "react";

/**
 * Quando a URL contém `?create=1` (ou `?create=true`), invoca `open()` uma vez
 * para abrir o modal de criação da entidade e remove o parâmetro da URL.
 *
 * Usado em conjunto com QuickCreateMenu, que navega para /leads?create=1 etc.
 */
export function useAutoCreateParam(open: () => void) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const v = url.searchParams.get("create");
    if (v === "1" || v === "true") {
      url.searchParams.delete("create");
      window.history.replaceState({}, "", url.pathname + (url.search ? url.search : "") + url.hash);
      // pequeno defer para garantir que o componente terminou de montar
      setTimeout(open, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
