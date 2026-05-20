// Hook utilitário para registrar service worker + push subscription.
import { useEffect, useState } from "react";

export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

export function usePwaInstall() {
  const [prompt, setPrompt] = useState<Event | null>(null);
  useEffect(() => {
    const onBeforeInstall = (e: Event) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);
  return {
    canInstall: !!prompt,
    install: async () => {
      if (!prompt) return;
      // @ts-expect-error BeforeInstallPromptEvent não tipado
      await prompt.prompt();
      setPrompt(null);
    },
  };
}
