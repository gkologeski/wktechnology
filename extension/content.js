// TechHire Hunter — Content script (v0.2.2)
// Injeta sidebar nos perfis do LinkedIn e extrai dados via múltiplas fontes:
// DOM (vários seletores), <title>, og:meta tags e JSON-LD. Reextrai com
// MutationObserver até preencher full_name ou estourar timeout.

(function () {
  if (window.__techhireHunterInjected) return;
  window.__techhireHunterInjected = true;

  const SIDEBAR_ID = "techhire-hunter-sidebar";
  const EXTRACT_TIMEOUT_MS = 10000;

  function clean(s) {
    return (s || "").replace(/\s+/g, " ").trim();
  }

  function safe(fn) {
    try {
      return fn();
    } catch {
      return "";
    }
  }

  function getJsonLdPerson() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const s of scripts) {
      try {
        const data = JSON.parse(s.textContent || "{}");
        const arr = Array.isArray(data) ? data : data["@graph"] || [data];
        for (const item of arr) {
          if (!item) continue;
          const t = item["@type"];
          const isPerson = t === "Person" || (Array.isArray(t) && t.includes("Person"));
          if (isPerson) return item;
        }
      } catch {
        /* ignore */
      }
    }
    return null;
  }

  function nameFromTitle() {
    const t = document.title || "";
    // Ex: "(7) Rafaela Correa | LinkedIn" → "Rafaela Correa"
    return clean(
      t
        .replace(/^\(\d+\)\s*/, "")
        .replace(/\s*[|\-–]\s*LinkedIn.*$/i, "")
        .replace(/\s*\|.*$/, ""),
    );
  }

  function extractProfile() {
    const url = (location.href.split("?")[0] || "").replace(/\/+$/, "");
    const person = getJsonLdPerson();

    // ---- full_name
    let full_name =
      safe(() => clean(document.querySelector("main h1")?.textContent)) ||
      safe(() => clean(document.querySelector("h1")?.textContent)) ||
      safe(() => clean(person?.name)) ||
      safe(() => clean(document.querySelector('meta[property="og:title"]')?.content)) ||
      nameFromTitle();
    full_name = clean(full_name).replace(/\s*[|\-–]\s*LinkedIn.*$/i, "");

    // ---- current_position (headline)
    let headline = "";
    const h1 = document.querySelector("main h1") || document.querySelector("h1");
    if (h1) {
      // Procura nó .text-body-medium próximo ao h1 (mesmo card)
      const card = h1.closest("section, div");
      const med = card?.querySelector(".text-body-medium");
      if (med) headline = clean(med.textContent);
    }
    if (!headline) {
      headline = safe(() => clean(person?.jobTitle));
    }
    if (!headline) {
      const og = safe(() => document.querySelector('meta[property="og:description"]')?.content);
      if (og) headline = clean(og.split(/[|·•]/)[0]);
    }

    // ---- current_company
    let company = "";
    try {
      const wf = person?.worksFor;
      if (Array.isArray(wf) && wf[0]) company = clean(wf[0].name);
      else if (wf && typeof wf === "object") company = clean(wf.name);
    } catch {
      /* ignore */
    }
    if (!company && h1) {
      const card = h1.closest("section, div") || document;
      const link = card.querySelector('a[href*="/company/"]');
      if (link) company = clean(link.textContent);
    }
    if (!company && headline) {
      const m = headline.match(/\s(?:at|na|no|@)\s+(.+)$/i);
      if (m) company = clean(m[1]);
    }

    // ---- location
    let location_ = "";
    try {
      const addr = person?.address;
      if (typeof addr === "string") location_ = clean(addr);
      else if (addr && typeof addr === "object")
        location_ = clean(addr.addressLocality || addr.name || "");
    } catch {
      /* ignore */
    }
    if (!location_ && h1) {
      const card = h1.closest("section, div");
      const candidates = card?.querySelectorAll('[class*="text-body-small"]') || [];
      for (const el of candidates) {
        const txt = clean(el.textContent);
        if (txt && !/seguidores|followers|connections|conex/i.test(txt) && txt.length < 120) {
          location_ = txt;
          break;
        }
      }
    }

    return {
      linkedin_url: url,
      full_name,
      current_position: headline,
      current_company: company,
      location: location_,
      source: "linkedin_extension",
    };
  }

  function renderPreview(profile) {
    const el = document.getElementById("thh-preview");
    if (!el) return;
    if (!profile.full_name) {
      el.innerHTML = `<div class="thh-muted">Detectando perfil…</div>`;
      return;
    }
    el.innerHTML = `
      <div><b>${profile.full_name}</b></div>
      <div class="thh-muted">${profile.current_position || ""}</div>
      <div class="thh-muted">${profile.current_company || ""}</div>
      <div class="thh-muted">${profile.location || ""}</div>`;
  }

  function startExtractionLoop(onProfile) {
    let resolved = false;
    let observer = null;
    let debounce = null;
    const start = Date.now();

    function attempt() {
      const profile = extractProfile();
      onProfile(profile);
      if (profile.full_name) {
        resolved = true;
        cleanup();
      } else if (Date.now() - start > EXTRACT_TIMEOUT_MS) {
        cleanup();
      }
    }
    function cleanup() {
      if (observer) observer.disconnect();
      observer = null;
      if (debounce) clearTimeout(debounce);
    }

    attempt();
    if (resolved) return;

    const target = document.querySelector("main") || document.body;
    observer = new MutationObserver(() => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(attempt, 300);
    });
    observer.observe(target, { childList: true, subtree: true });

    // Hard timeout
    setTimeout(cleanup, EXTRACT_TIMEOUT_MS + 500);
  }

  function injectSidebar() {
    if (document.getElementById(SIDEBAR_ID)) return;
    const root = document.createElement("div");
    root.id = SIDEBAR_ID;
    root.innerHTML = `
      <div class="thh-card">
        <div class="thh-header">
          <strong>TechHire Hunter</strong>
          <button id="thh-close" aria-label="Fechar">×</button>
        </div>
        <div id="thh-status" class="thh-status">Carregando…</div>
        <div id="thh-preview" class="thh-preview"><div class="thh-muted">Detectando perfil…</div></div>
        <div class="thh-actions">
          <button id="thh-capture" class="thh-btn thh-primary">Salvar candidato</button>
        </div>
        <hr/>
        <label class="thh-label">Template</label>
        <select id="thh-template" class="thh-select"><option value="">—</option></select>
        <textarea id="thh-message" class="thh-textarea" rows="6" placeholder="Mensagem renderizada aparece aqui"></textarea>
        <div class="thh-actions">
          <button id="thh-copy" class="thh-btn">Copiar mensagem</button>
          <button id="thh-log" class="thh-btn">Marcar como enviada</button>
        </div>
        <p class="thh-footer">Configure a extensão no ícone da barra do navegador.</p>
      </div>`;
    document.body.appendChild(root);

    document.getElementById("thh-close").onclick = () => root.remove();

    // Mantém o perfil mais recente capturado pela rotina de extração
    let latestProfile = extractProfile();
    renderPreview(latestProfile);
    startExtractionLoop((p) => {
      latestProfile = p;
      renderPreview(p);
    });

    // Estado de pareamento
    chrome.runtime.sendMessage({ type: "PING" }, (resp) => {
      const status = document.getElementById("thh-status");
      if (!status) return;
      if (!resp?.paired) {
        status.innerHTML = `<span class="thh-warn">Extensão não pareada.</span>`;
      } else {
        status.textContent = "Pareada · pronta para capturar.";
        loadTemplates();
      }
    });

    document.getElementById("thh-capture").onclick = async () => {
      const btn = document.getElementById("thh-capture");
      btn.disabled = true;
      btn.textContent = "Salvando…";
      chrome.runtime.sendMessage(
        { type: "CAPTURE_CANDIDATE", payload: latestProfile },
        (resp) => {
          btn.disabled = false;
          btn.textContent = "Salvar candidato";
          const status = document.getElementById("thh-status");
          if (resp?.ok) {
            status.textContent = "Capturado ✓ — abra TechHire para vincular vaga.";
            window.__thhCaptureId = resp.data?.capture_id;
          } else {
            status.innerHTML = `<span class="thh-warn">${resp?.error || "Erro"}</span>`;
          }
        },
      );
    };

    function loadTemplates() {
      chrome.runtime.sendMessage({ type: "LIST_TEMPLATES" }, (resp) => {
        if (!resp?.ok) return;
        const sel = document.getElementById("thh-template");
        for (const t of resp.data?.templates || []) {
          const opt = document.createElement("option");
          opt.value = t.id;
          opt.textContent = `${t.name} (${t.channel})`;
          sel.appendChild(opt);
        }
        sel.onchange = () => renderTemplate(sel.value);
      });
    }

    function renderTemplate(templateId) {
      if (!templateId) return;
      chrome.runtime.sendMessage(
        { type: "RENDER_TEMPLATE", payload: { templateId, profile: latestProfile } },
        (resp) => {
          if (resp?.ok) {
            document.getElementById("thh-message").value = resp.data?.body || "";
          }
        },
      );
    }

    document.getElementById("thh-copy").onclick = async () => {
      const v = document.getElementById("thh-message").value;
      await navigator.clipboard.writeText(v);
      document.getElementById("thh-status").textContent = "Mensagem copiada.";
    };

    document.getElementById("thh-log").onclick = () => {
      const channel =
        document.getElementById("thh-template").selectedOptions[0]?.textContent
          ?.match(/\((.+)\)/)?.[1] || "linkedin_message";
      chrome.runtime.sendMessage(
        {
          type: "LOG_OUTREACH",
          payload: {
            linkedin_url: latestProfile.linkedin_url,
            channel,
            body: document.getElementById("thh-message").value,
          },
        },
        (resp) => {
          const status = document.getElementById("thh-status");
          status.textContent = resp?.ok ? "Outreach registrado ✓" : resp?.error || "Erro";
        },
      );
    };
  }

  // Reinjeta ao navegar entre perfis (SPA do LinkedIn)
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      const old = document.getElementById(SIDEBAR_ID);
      if (old) old.remove();
      if (/\/in\/|\/sales\/lead\//.test(location.pathname)) {
        setTimeout(injectSidebar, 800);
      }
    }
  }, 1000);

  function boot() {
    if (/\/in\/|\/sales\/lead\//.test(location.pathname)) {
      setTimeout(injectSidebar, 800);
    }
  }
  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot, { once: true });
})();
