// Bridge entre a página /auth/extension-link e o background da extensão.
// A página posta uma mensagem via window.postMessage; nós validamos a
// origem, repassamos pro background e respondemos com sucesso/erro.
(function () {
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== "techhire-extension-link") return;
    if (data.type !== "PAIR") return;
    const { apiBase, apiKey } = data;
    if (!apiBase || !apiKey) {
      window.postMessage(
        { source: "techhire-extension-link-ack", ok: false, error: "missing_fields" },
        window.location.origin,
      );
      return;
    }
    try {
      chrome.runtime.sendMessage({ type: "PAIR_FROM_WEB", apiBase, apiKey }, (resp) => {
        window.postMessage(
          {
            source: "techhire-extension-link-ack",
            ok: Boolean(resp?.ok),
            error: resp?.error,
          },
          window.location.origin,
        );
      });
    } catch (e) {
      window.postMessage(
        { source: "techhire-extension-link-ack", ok: false, error: String(e?.message || e) },
        window.location.origin,
      );
    }
  });
  // Anuncia presença pra UI desabilitar fallback de copy/paste.
  window.postMessage({ source: "techhire-extension-link-ready" }, window.location.origin);
})();
