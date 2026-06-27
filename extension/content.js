// TechHire Hunter — Content script (v0.2.4)
// Extrai dados de perfil do LinkedIn via DOM + <title> + og:meta + JSON-LD.
// Mantém MutationObserver ativo até preencher headline/empresa/local OU timeout.

(function () {
  if (window.__techhireHunterInjected) return;
  window.__techhireHunterInjected = true;

  const SIDEBAR_ID = "techhire-hunter-sidebar";
  const EXTRACT_TIMEOUT_MS = 15000;

  const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
  const escapeHtml = (s) =>
    clean(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  const safe = (fn) => {
    try {
      return fn() || "";
    } catch {
      return "";
    }
  };

  const getVisibleText = (el) => {
    if (!el) return "";
    return (el.innerText || el.textContent || "").replace(/\u00a0/g, " ").trim();
  };

  const getLines = (el) =>
    getVisibleText(el)
      .split(/\n+/)
      .map(clean)
      .filter(Boolean);

  const isNoiseLine = (line) =>
    !line ||
    /^(conectar|connect|seguir|follow|mensagem|message|mais|more|dados de contato|contact info|salvar candidato|re-detectar|template|copiar mensagem|marcar como enviada)$/i.test(
      line,
    ) ||
    /seguidores|followers|seguidor|conexões|conexoes|connections|connection|mútuo|mutual|grau|degree/i.test(
      line,
    );

  const looksLikeLocation = (line) =>
    !!line &&
    line.length <= 140 &&
    /,/.test(line) &&
    !/[|@]/.test(line) &&
    !/marketing|developer|engineer|analyst|analista|especialista|consultor|manager|diretor|founder|CEO|CTO|CFO/i.test(
      line,
    ) &&
    /(brasil|brazil|portugal|united states|usa|canad[áa]|remote|remoto|são|sao|rio|belo|curitiba|florianópolis|florianopolis|porto|lisboa|paulo|sp|rj|rs|sc|pr|mg|es|ba|pe|ce)$/i.test(
      line,
    );

  const sanitizeCompany = (line) =>
    clean(line)
      .replace(/^empresa atual\s*:?\s*/i, "")
      .replace(/^current company\s*:?\s*/i, "")
      .replace(/^empresa actual\s*:?\s*/i, "")
      .replace(/\s+(logo|logotipo)$/i, "")
      .replace(/^[•·\-–]+\s*/, "");

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
    const direct =
      h1.closest("section.artdeco-card") ||
      h1.closest("section") ||
      h1.closest(".pv-top-card") ||
      h1.closest(".ph5") ||
      h1.closest(".mt2.relative");
    if (direct && getVisibleText(direct).length > clean(h1.textContent).length + 20) return direct;

    const main = document.querySelector("main");
    let best = direct || h1.parentElement;
    let bestScore = -1;
    let node = h1.parentElement;
    for (let i = 0; node && node !== document.body && node !== main?.parentElement && i < 10; i += 1) {
      const text = getVisibleText(node);
      const lines = getLines(node);
      if (text.length > 40 && text.length < 5000 && node.querySelector("h1")) {
        let score = lines.length;
        if (node.querySelector('a[href*="/company/"]')) score += 5;
        if (lines.some(looksLikeLocation)) score += 5;
        if (/dados de contato|contact info/i.test(text)) score += 1;
        if (/destaques|highlights|atividade|activity|experiência|experience/i.test(text)) score -= 4;
        if (score > bestScore) {
          bestScore = score;
          best = node;
        }
      }
      node = node.parentElement;
    }
    return best;
  }

  function extractProfileLines(card, fullName) {
    const lines = getLines(card).filter((line) => !isNoiseLine(line));
    const name = clean(fullName).replace(/\s*[·•]\s*\d+º?.*$/i, "");
    return lines.filter((line) => {
      const comparable = clean(line).replace(/\s*[·•]\s*\d+º?.*$/i, "");
      return comparable && comparable !== name && comparable !== clean(fullName);
    });
  }

  function extractHeadline(card, person, fullName) {
    if (card) {
      const sels = [
        ".text-body-medium.break-words",
        "div.text-body-medium.break-words",
        "div.text-body-medium",
        ".pv-text-details__left-panel .text-body-medium",
        "div[data-generated-suggestion-target]",
      ];
      for (const sel of sels) {
        const el = card.querySelector(sel);
        const txt = clean(el?.textContent);
        if (txt && !isNoiseLine(txt) && txt !== clean(fullName)) return txt;
      }

      const lines = extractProfileLines(card, fullName);
      for (const line of lines) {
        if (looksLikeLocation(line)) continue;
        if (/^\+?\d+\s/.test(line)) continue;
        if (/^[A-Z0-9 .,&'’\-–]+$/.test(line) && line.length < 80) continue;
        if (line.length > 8 && /[|@]|\b(marketing|developer|engineer|analyst|analista|especialista|consultor|manager|diretor|founder|recruiter|sales|growth|designer|product|software|programador)\b/i.test(line)) {
          return line;
        }
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
        'button[aria-label*="Empresa atual"], button[aria-label*="Current company"], button[aria-label*="Empresa actual"], a[aria-label*="Empresa atual"], a[aria-label*="Current company"], a[aria-label*="Empresa actual"]',
      );
      const btnTxt = sanitizeCompany(clean(btn?.textContent || btn?.getAttribute("aria-label")));
      if (btnTxt) return btnTxt;
      // Links de company com aria-label costumam ter o nome limpo
      const linkAria = card.querySelector('a[href*="/company/"][aria-label]');
      const aria = sanitizeCompany(clean(linkAria?.getAttribute("aria-label")));
      if (aria) return aria;
      const link = card.querySelector('a[href*="/company/"]');
      const txt = sanitizeCompany(clean(link?.textContent));
      if (txt) return txt;

      const lines = getLines(card).filter((line) => !isNoiseLine(line));
      const companyLine = lines.find(
        (line) =>
          line !== headline &&
          !looksLikeLocation(line) &&
          line.length > 3 &&
          line.length < 140 &&
          /(ltda|inc\.?|llc|sa\b|s\.a\.|company|corp|corporation|group|grupo|tecnologia|technology|consultoria|assessoria|marketing|software|solutions|soluções|escola|university|universidade)/i.test(
            line,
          ),
      );
      if (companyLine) return sanitizeCompany(companyLine);
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

      const line = getLines(card).find((candidate) => !isNoiseLine(candidate) && looksLikeLocation(candidate));
      if (line) return line;
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

    const headline = extractHeadline(card, person, full_name);
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
    const status = document.getElementById("thh-status");
    if (!el) return;
    if (!profile.full_name) {
      el.innerHTML = `<div class="thh-muted">Detectando perfil…</div>`;
      if (status) status.textContent = "Detectando perfil…";
      return;
    }
    const complete = isComplete(profile);
    if (status && !opts?.captured) {
      status.textContent = complete ? "Detalhes detectados · pronto para capturar." : "Detectando detalhes do perfil…";
    }
    const partial = opts?.partial
      ? `<div class="thh-warn" style="margin-top:6px">Ainda faltam campos. Role até o topo, aguarde o perfil carregar e tente novamente.</div>`
      : "";
    el.innerHTML = `
      <div><b>${escapeHtml(profile.full_name)}</b></div>
      <div class="thh-muted">${escapeHtml(profile.current_position) || "—"}</div>
      <div class="thh-muted">${escapeHtml(profile.current_company) || "—"}</div>
      <div class="thh-muted">${escapeHtml(profile.location) || "—"}</div>${partial}`;
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
    let allowPartialOnce = false;
    renderPreview(latestProfile, { partial: false });
    startExtractionLoop((p, opts) => {
      latestProfile = p;
      if (isComplete(p)) allowPartialOnce = false;
      renderPreview(p, opts);
    });

    document.getElementById("thh-recheck").onclick = () => {
      allowPartialOnce = false;
      startExtractionLoop((p, opts) => {
        latestProfile = p;
        if (isComplete(p)) allowPartialOnce = false;
        renderPreview(p, opts);
      });
    };

    chrome.runtime.sendMessage({ type: "PING" }, (resp) => {
      const status = document.getElementById("thh-status");
      if (!status) return;
      if (!resp?.paired) {
        status.innerHTML = `<span class="thh-warn">Extensão não pareada.</span>`;
      } else {
        status.textContent = isComplete(latestProfile)
          ? "Detalhes detectados · pronto para capturar."
          : "Pareada · detectando detalhes do perfil…";
        loadTemplates();
      }
    });

    document.getElementById("thh-capture").onclick = async () => {
      latestProfile = extractProfile();
      renderPreview(latestProfile, { partial: !isComplete(latestProfile) });
      if (!isComplete(latestProfile) && !allowPartialOnce) {
        allowPartialOnce = true;
        const status = document.getElementById("thh-status");
        if (status) {
          status.innerHTML = `<span class="thh-warn">Perfil incompleto. Clique em Re-detectar ou clique em Salvar novamente para gravar parcial.</span>`;
        }
        return;
      }
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
            renderPreview(latestProfile, { captured: true });
            window.__thhCaptureId = resp.data?.capture_id;
          } else {
            status.innerHTML = `<span class="thh-warn">${escapeHtml(resp?.error || "Erro")}</span>`;
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
