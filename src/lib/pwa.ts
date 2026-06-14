// Helpers PWA: registro de SW, prompt de instalação, subscrição Push.
import { useEffect, useState } from "react";

export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  // Não registrar em previews Lovable (evita cache stale).
  const h = window.location.hostname;
  if (h.startsWith("id-preview--") || h.startsWith("preview--") || h.endsWith("lovableproject.com"))
    return;
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

export function usePwaInstall() {
  const [prompt, setPrompt] = useState<Event | null>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setPrompt(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    if (window.matchMedia?.("(display-mode: standalone)").matches) setInstalled(true);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  return {
    canInstall: !!prompt && !installed,
    installed,
    install: async () => {
      if (!prompt) return;
      // @ts-expect-error BeforeInstallPromptEvent não tipado
      await prompt.prompt();
      setPrompt(null);
    },
  };
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function arrayBufferToBase64Url(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Solicita permissão e inscreve o dispositivo. Retorna a subscription serializada
 * pronta para upsert no backend.
 */
export async function subscribeToPush(vapidPublicKey: string) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Push não suportado neste navegador.");
  }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Permissão negada.");
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }
  const json = sub.toJSON();
  const p256dh = json.keys?.p256dh ?? arrayBufferToBase64Url(sub.getKey("p256dh") as ArrayBuffer);
  const auth = json.keys?.auth ?? arrayBufferToBase64Url(sub.getKey("auth") as ArrayBuffer);
  return {
    endpoint: sub.endpoint,
    p256dh,
    auth,
    user_agent: navigator.userAgent,
  };
}

export async function unsubscribeFromPush() {
  if (!("serviceWorker" in navigator)) return null;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  return endpoint;
}
