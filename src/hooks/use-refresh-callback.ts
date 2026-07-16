// Hook utilitário para painéis compostos que ainda usam `useState + useEffect`
// (não migrados para TanStack Query). Reexecuta a função fornecida quando:
//   - a aba volta a ficar visível (`visibilitychange`);
//   - a janela recebe foco (`focus`);
//   - qualquer Dialog/Sheet/AlertDialog/Drawer é fechado (bus interno).
//
// Objetivo: garantir que, ao voltar o foco para uma tela, os dados exibidos
// reflitam alterações feitas em modais ou em outras abas, sem exigir F5.
import { useEffect, useRef } from "react";
import { subscribeDialogClosed } from "@/lib/dialog-refresh";

export function useRefreshCallback(callback: () => void | Promise<void>, enabled = true) {
  const ref = useRef(callback);
  ref.current = callback;

  useEffect(() => {
    if (!enabled) return;
    const run = () => {
      try {
        void ref.current();
      } catch {
        // ignore
      }
    };
    const onVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") run();
    };
    window.addEventListener("focus", run);
    document.addEventListener("visibilitychange", onVisible);
    const unsub = subscribeDialogClosed(run);
    return () => {
      window.removeEventListener("focus", run);
      document.removeEventListener("visibilitychange", onVisible);
      unsub();
    };
  }, [enabled]);
}
