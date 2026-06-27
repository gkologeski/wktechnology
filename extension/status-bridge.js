// Bridge de status entre a página /hunting/install (e /auth/extension-link)
// e o background da extensão. Anuncia presença e responde com o estado de
// pareamento atual (paired/pending/failed) sob demanda.
(function () {
  function broadcastStatus() {
    try {
      chrome.runtime.sendMessage({ type: "PING" }, (resp) => {
        const payload = {
          source: "techhire-extension-status",
          ok: Boolean(resp?.ok),
          paired: Boolean(resp?.paired),
          apiBase: resp?.apiBase || null,
          lastError: resp?.lastError || null,
          at: Date.now(),
        };
        window.postMessage(payload, window.location.origin);
      });
    } catch (e) {
      window.postMessage(
        {
          source: "techhire-extension-status",
          ok: false,
          paired: false,
          lastError: String(e?.message || e),
          at: Date.now(),
        },
        window.location.origin,
      );
    }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== "techhire-extension-status-request") return;
    broadcastStatus();
  });

  // Anuncia presença e estado inicial.
  window.postMessage(
    { source: "techhire-extension-status-ready" },
    window.location.origin,
  );
  broadcastStatus();
})();
