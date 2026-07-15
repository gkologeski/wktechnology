// Service worker v3: NetworkFirst para HTML, NetworkFirst para assets JS/CSS
// (evita servir chunks lazy obsoletos após novo build), push notifications.
const CACHE = "crm-v4";
const RUNTIME = "crm-runtime-v4";
const SHELL = ["/favicon.ico", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE && k !== RUNTIME).map((k) => caches.delete(k))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Nunca cachear chamadas a APIs e server functions.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_server")) return;

  const isHTML = req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");
  if (isHTML) {
    // NetworkFirst: tenta rede, fallback para cache (offline shell).
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches
            .open(RUNTIME)
            .then((c) => c.put(req, copy))
            .catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match("/"))),
    );
    return;
  }
  // JS/CSS: NetworkFirst para evitar chunks lazy obsoletos após novo build.
  const isScript = /\.(?:js|mjs|css)(?:\?|$)/.test(url.pathname);
  if (isScript) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches
            .open(RUNTIME)
            .then((c) => c.put(req, copy))
            .catch(() => {});
          return res;
        })
        .catch(() => caches.match(req)),
    );
    return;
  }
  // Outros assets (imagens, fontes): cache first.
  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches
              .open(RUNTIME)
              .then((c) => c.put(req, copy))
              .catch(() => {});
            return res;
          })
          .catch(() => cached),
    ),
  );
});

self.addEventListener("push", (event) => {
  let data = { title: "CRM", body: "Nova notificação", url: "/" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || "/favicon.ico",
      badge: "/favicon.ico",
      tag: data.tag,
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of all) {
        if (c.url.includes(url) && "focus" in c) return c.focus();
      }
      return self.clients.openWindow(url);
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") self.skipWaiting();
});
