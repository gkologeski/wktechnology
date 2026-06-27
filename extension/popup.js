// TechHire Hunter — popup.
const baseEl = document.getElementById("apiBase");
const keyEl = document.getElementById("apiKey");
const statusEl = document.getElementById("status");

chrome.storage.local.get(["apiBase", "apiKey"]).then((s) => {
  baseEl.value = s.apiBase || "";
  keyEl.value = s.apiKey || "";
});

document.getElementById("save").addEventListener("click", async () => {
  const apiBase = baseEl.value.trim().replace(/\/$/, "");
  const apiKey = keyEl.value.trim();
  if (!apiBase || !apiKey) {
    statusEl.textContent = "Preencha URL e API key.";
    statusEl.className = "status err";
    return;
  }
  await chrome.storage.local.set({ apiBase, apiKey });
  statusEl.textContent = "Salvo ✓. Recarregue a aba do LinkedIn.";
  statusEl.className = "status ok";
});
