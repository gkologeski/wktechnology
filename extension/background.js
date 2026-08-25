// TechHire Hunter — Background service worker (MV3).
// Roteia chamadas do content/popup pra API do TechHire.

const DEFAULTS = {
  apiBase: "https://app.lovable.app", // sobrescreva via popup
};

async function getConfig() {
  const stored = await chrome.storage.local.get(["apiBase", "apiKey"]);
  return {
    apiBase: stored.apiBase || DEFAULTS.apiBase,
    apiKey: stored.apiKey || "",
  };
}

async function apiCall(path, body) {
  const { apiBase, apiKey } = await getConfig();
  if (!apiKey) throw new Error("Extensão não pareada — configure no popup.");
  const res = await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg.type === "CAPTURE_CANDIDATE") {
        const out = await apiCall("/api/public/hunting/capture", msg.payload);
        sendResponse({ ok: true, data: out });
      } else if (msg.type === "LIST_TEMPLATES") {
        const out = await apiCall("/api/public/hunting/templates", {});
        sendResponse({ ok: true, data: out });
      } else if (msg.type === "RENDER_TEMPLATE") {
        const out = await apiCall("/api/public/hunting/render-template", msg.payload);
        sendResponse({ ok: true, data: out });
      } else if (msg.type === "LOG_OUTREACH") {
        const out = await apiCall("/api/public/hunting/log-outreach", msg.payload);
        sendResponse({ ok: true, data: out });
      } else if (msg.type === "PAIR_FROM_WEB") {
        const apiBase = String(msg.apiBase || "")
          .trim()
          .replace(/\/$/, "");
        const apiKey = String(msg.apiKey || "").trim();
        if (!apiBase || !apiKey) {
          await chrome.storage.local.set({
            lastPairError: "missing_fields",
            lastPairAt: Date.now(),
          });
          sendResponse({ ok: false, error: "missing_fields" });
          return;
        }
        await chrome.storage.local.set({
          apiBase,
          apiKey,
          lastPairError: null,
          lastPairAt: Date.now(),
        });
        sendResponse({ ok: true });
      } else if (msg.type === "PING") {
        const cfg = await getConfig();
        const stored = await chrome.storage.local.get(["lastPairError", "lastPairAt"]);
        sendResponse({
          ok: true,
          paired: Boolean(cfg.apiKey),
          apiBase: cfg.apiBase,
          lastError: stored.lastPairError || null,
          lastPairAt: stored.lastPairAt || null,
        });
      } else {
        sendResponse({ ok: false, error: "Mensagem desconhecida" });
      }
    } catch (e) {
      sendResponse({ ok: false, error: e?.message || String(e) });
    }
  })();
  return true; // resposta assíncrona
});
