import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";

/**
 * Quando a URL contém `?create=1` (ou `?create=true`), invoca `open()` para
 * abrir o modal de criação da entidade e remove o parâmetro da URL.
 *
 * Reage a mudanças de URL (não apenas no mount), pois o usuário pode já estar
 * na rota destino quando aciona o QuickCreateMenu — nesse caso o componente
 * não remonta, mas o search muda. Usamos `useRouterState` para observar.
 */
export function useAutoCreateParam(open: () => void) {
  const search = useRouterState({ select: (s) => s.location.search }) as unknown as
    | Record<string, unknown>
    | undefined;

  const openRef = useRef(open);
  openRef.current = open;
  const handledRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = search?.create;
    const isOn = v === 1 || v === "1" || v === true || v === "true";
    if (!isOn) {
      handledRef.current = false;
      return;
    }
    if (handledRef.current) return;
    handledRef.current = true;
    // Remove o parâmetro da URL sem disparar navegação adicional.
    const url = new URL(window.location.href);
    url.searchParams.delete("create");
    window.history.replaceState({}, "", url.pathname + (url.search ? url.search : "") + url.hash);
    setTimeout(() => openRef.current(), 0);
  }, [search]);
}
