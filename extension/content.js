// TechHire Hunter — Content script (v0.2.3)
// Extrai dados de perfil do LinkedIn via DOM + <title> + og:meta + JSON-LD.
// Mantém MutationObserver ativo até preencher headline/empresa/local OU timeout.

(function () {
  if (window.__techhireHunterInjected) return;
  window.__techhireHunterInjected = true;

  const SIDEBAR_ID = "techhire-hunter-sidebar";
  const EXTRACT_TIMEOUT_MS = 15000;

  const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
  const safe = (fn) => {
    try {
      return fn() || "";
    } catch {
      return "";
    }
  };

  function getJsonLdPerson() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const s of scripts) {
      try {
        const data = JSON.parse(s.textContent || "{}");
        const arr = Array.isArray(data) ? data : data["@graph"] || [data];
        for (const item of arr) {
          if (!item) continue;
          const t = item["@type"];
          if (t === "Person" || (Array.isArray(t) && t.includes("Person"))) return item;
        }
      } catch {
        /* ignore */
      }
    }
    return null;
  }

  function nameFromTitle() {
    const t = document.title || "";
    return clean(
      t
        .replace(/^\(\d+\)\s*/, "")
        .replace(/\s*[|\-–]\s*LinkedIn.*$/i, "")
        .replace(/\s*\|.*$/, ""),
    );
  }

  function topCardScope() {
    const h1 = document.querySelector("main h1") || document.querySelector("h1");
    if (!h1) return null;
    return h1.closest("section.artdeco-card") || h1.closest("section") || h1.closest("div");
  }

  function extractHeadline(card, person) {
    if (card) {
      const sels = [
        ".text-body-medium.break-words",
        "div.text-body-medium.break-words",
        "div.text-body-medium",
        ".pv-text-details__left-panel .text-body-medium",
      ];
      for (const sel of sels) {
        const el = card.querySelector(sel);
        const txt = clean(el?.textContent);
        if (txt) return txt;
      }
    }
    const jt = clean(person?.jobTitle);
    if (jt) return jt;
    const og = safe(() => document.querySelector('meta[property="og:description"]')?.content);
    if (og) return clean(og.split(/[|·•]/)[0]);
    return "";
  }

  function extractCompany(card, person, headline) {
    try {
      const wf = person?.worksFor;
      if (Array.isArray(wf) && wf[0]?.name) return clean(wf[0].name);
      if (wf && typeof wf === "object" && wf.name) return clean(wf.name);
    } catch {
      /* ignore */
    }
    if (card) {
      // Botão "Empresa atual" do topo (PT/EN/ES)
      const btn = card.querySelector(
        'button[aria-label^="Empresa atual"], button[aria-label^="Current company"], button[aria-label^="Empresa actual"]',
      );
      const btnTxt = clean(btn?.textContent);
      if (btnTxt) return btnTxt;
      // Links de company com aria-label costumam ter o nome limpo
      const linkAria = card.querySelector('a[href*="/company/"][aria-label]');
      const aria = clean(linkAria?.getAttribute("aria-label"));
      if (aria) return aria;
      const link = card.querySelector('a[href*="/company/"]');
      const txt = clean(link?.textContent);
      if (txt) return txt;
    }
    if (headline) {
      const m = headline.match(/\s(?:at|na|no|em|@)\s+(.+)$/i);
      if (m) return clean(m[1]);
    }
    return "";
  }

  function extractLocation(card, person) {
    try {
      const addr = person?.address;
      if (typeof addr === "string" && addr.trim()) return clean(addr);
      if (addr && typeof addr === "object") {
        const loc = clean(addr.addressLocality || addr.name || "");
        if (loc) return loc;
      }
    } catch {
      /* ignore */
    }
    if (card) {
      const spans = card.querySelectorAll(
        'span.text-body-small.inline.t-black--light, span.text-body-small, .pv-text-details__left-panel .text-body-small',
      );
      for (const el of spans) {
        const txt = clean(el.textContent);
        if (
          txt &&
          txt.length < 120 &&
          !/seguidores|followers|seguidor|conex|connections|connection|mútuo|mutual/i.test(txt)
        ) {
          return txt;
        }
      }
    }
    return "";
  }

  function extractAvatar(card) {
    if (card) {
      const sels = [
        "img.pv-top-card-profile-picture__image",
        'img.pv-top-card-profile-picture__image--show',
        'img[width="200"]',
        'button img.profile-photo-edit__preview',
      ];
      for (const sel of sels) {
        const el = card.querySelector(sel);
        const src = el?.getAttribute("src");
        if (src && /^https?:/i.test(src)) return src;
      }
    }
    const og = safe(() => document.querySelector('meta[property="og:image"]')?.content);
    if (og && /^https?:/i.test(og)) return og;
    return "";
  }

  function extractProfile() {
    const url = (location.href.split("?")[0] || "").replace(/\/+$/, "");
    const person = getJsonLdPerson();
    const card = topCardScope();

    let full_name =
      safe(() => clean(card?.querySelector("h1")?.textContent)) ||
      safe(() => clean(document.querySelector("main h1")?.textContent)) ||
      safe(() => clean(document.querySelector("h1")?.textContent)) ||
      clean(person?.name) ||
      safe(() => clean(document.querySelector('meta[property="og:title"]')?.content)) ||
      nameFromTitle();
    full_name = clean(full_name).replace(/\s*[|\-–]\s*LinkedIn.*$/i, "");

    const headline = extractHeadline(card, person);
    const company = extractCompany(card, person, headline);
    const location_ = extractLocation(card, person);
    const avatar = extractAvatar(card);

    return {
      linkedin_url: url,
      full_name,
      current_position: headline,
      current_company: company,
      location: location_,
      avatar_url: avatar,
      source: "linkedin_extension",
    };
  }

  function renderPreview(profile, opts) {
    const el = document.getElementById("thh-preview");
    if (!el) return;
    if (!profile.full_name) {
      el.innerHTML = `<div class="thh-muted">Detectando perfil…</div>`;
      return;
    }
    const partial = opts?.partial
      ? `<div class="thh-warn" style="margin-top:6px">Alguns campos não foram detectados. Role o perfil até o topo e tente novamente.</div>`
      : "";
    el.innerHTML = `
      <div><b>${profile.full_name}</b></div>
      <div class="thh-muted">${profile.current_position || "—"}</div>
      <div class="thh-muted">${profile.current_company || "—"}</div>
      <div class="thh-muted">${profile.location || "—"}</div>${partial}`;
  }

  function isComplete(p) {
    return !!(p.full_name && p.current_position && (p.current_company || p.location));
  }

  function startExtractionLoop(onProfile) {
    let observer = null;
    let debounce = null;
    let done = false;
    const start = Date.now();

    function attempt() {
      const profile = extractProfile();
      const complete = isComplete(profile);
      const timedOut = Date.now() - start > EXTRACT_TIMEOUT_MS;
      onProfile(profile, { partial: timedOut && !complete });
      if (complete || timedOut) {
        done = true;
        cleanup();
      }
    }
    function cleanup() {
      if (observer) observer.disconnect();
      observer = null;
      if (debounce) clearTimeout(debounce);
    }

    attempt();
    if (done) return;

    const target = document.querySelector("main") || document.body;
    observer = new MutationObserver(() => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(attempt, 300);
    });
    observer.observe(target, { childList: true, subtree: true });
    setTimeout(() => {
      if (!done) attempt();
    }, EXTRACT_TIMEOUT_MS + 500);
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
          <button id="thh-recheck" class="thh-btn">Re-detectar</button>
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

    let latestProfile = extractProfile();
    renderPreview(latestProfile, { partial: false });
    startExtractionLoop((p, opts) => {
      latestProfile = p;
      renderPreview(p, opts);
    });

    document.getElementById("thh-recheck").onclick = () => {
      startExtractionLoop((p, opts) => {
        latestProfile = p;
        renderPreview(p, opts);
      });
    };

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
