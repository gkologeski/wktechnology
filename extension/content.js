// TechHire Hunter — Content script (v0.2.5)
// Extrai dados de perfil do LinkedIn via DOM visível + <title> + og:meta + JSON-LD.
// Mantém MutationObserver ativo até preencher headline/empresa/local OU timeout.

(function () {
  if (window.__techhireHunterInjected) return;
  window.__techhireHunterInjected = true;

  const SIDEBAR_ID = "techhire-hunter-sidebar";
  const EXTRACT_TIMEOUT_MS = 15000;
  const CONTEXT_INVALIDATED = "Extensão recarregada. Recarregue a aba do LinkedIn.";
  const extractionStops = new Set();

  const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
  const lower = (s) => clean(s).toLowerCase();
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

  const uniqueLines = (lines) => {
    const seen = new Set();
    return lines.filter((line) => {
      const key = lower(line);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const isRuntimeAvailable = () => typeof chrome !== "undefined" && Boolean(chrome.runtime?.id);

  function setStatus(message, warn) {
    const status = document.getElementById("thh-status");
    if (!status) return;
    status.innerHTML = warn ? `<span class="thh-warn">${escapeHtml(message)}</span>` : escapeHtml(message);
  }

  function sendRuntimeMessage(message, callback) {
    if (!isRuntimeAvailable()) {
      setStatus(CONTEXT_INVALIDATED, true);
      callback?.({ ok: false, error: CONTEXT_INVALIDATED, contextInvalidated: true });
      return;
    }
    try {
      chrome.runtime.sendMessage(message, (resp) => {
        const err = chrome.runtime.lastError;
        if (err) {
          const text = /context invalidated/i.test(err.message || "")
            ? CONTEXT_INVALIDATED
            : err.message || "Erro na extensão";
          setStatus(text, true);
          callback?.({ ok: false, error: text, contextInvalidated: /context invalidated/i.test(text) });
          return;
        }
        callback?.(resp);
      });
    } catch (e) {
      const messageText = /context invalidated/i.test(e?.message || "")
        ? CONTEXT_INVALIDATED
        : e?.message || "Erro na extensão";
      setStatus(messageText, true);
      callback?.({ ok: false, error: messageText, contextInvalidated: /context invalidated/i.test(messageText) });
    }
  }

  const isNoiseLine = (line) => {
    const value = lower(line);
    return (
      !value ||
      /^(conectar|connect|seguir|follow|mensagem|message|mais|more|dados de contato|contact info|salvar candidato|re-detectar|template|copiar mensagem|marcar como enviada|português|portugues|english|inglês|ingles|para negócios|para negocios|anunciar|minha rede|vagas|notificações|notificacoes|eu)$/.test(
        value,
      ) ||
      /seguidores|followers|seguidor|conexões|conexoes|connections|connection|mútuo|mutual|grau|degree|perfis para você|people also viewed|mais perfis|destaques|highlights/.test(
        value,
      )
    );
  };

  const looksLikeLocation = (line) => {
    const value = clean(line);
    return (
      !!value &&
      value.length <= 160 &&
      /,/.test(value) &&
      !/[|@]/.test(value) &&
      !/marketing|developer|engineer|analyst|analista|especialista|consultor|manager|diretor|founder|CEO|CTO|CFO|account|sales|product|software|telecom/i.test(
        value,
      ) &&
      /(brasil|brazil|portugal|united states|usa|canad[áa]|remote|remoto|são|sao|rio|belo|curitiba|florianópolis|florianopolis|porto|lisboa|paulo|sp|rj|rs|sc|pr|mg|es|ba|pe|ce)$/i.test(
        value,
      )
    );
  };

  const looksLikeHeadline = (line) => {
    const value = clean(line);
    return (
      value.length > 8 &&
      value.length < 420 &&
      !looksLikeLocation(value) &&
      !isNoiseLine(value) &&
      (/\|/.test(value) ||
        /\bat\b|\bem\b|\bna\b|\bno\b|@/i.test(value) ||
        /\b(account|sales|marketing|developer|engineer|analyst|analista|especialista|consultor|manager|diretor|founder|recruiter|growth|designer|product|software|programador|arquiteto|telecom|cloud|infra|government|governo)\b/i.test(
          value,
        ))
    );
  };

  const looksLikeCompany = (line) => {
    const value = sanitizeCompany(line);
    return (
      value.length > 2 &&
      value.length < 160 &&
      !looksLikeLocation(value) &&
      !isNoiseLine(value) &&
      !looksLikeHeadline(value) &&
      /(ltda|inc\.?|llc|sa\b|s\.a\.|company|corp|corporation|group|grupo|tecnologia|technology|consultoria|assessoria|marketing|software|solutions|soluções|solucoes|escola|university|universidade|tech|systems|sistemas|3corp)/i.test(
        value,
      )
    );
  };

  function sanitizeCompany(line) {
    return clean(line)
      .replace(/^empresa atual\s*:?\s*/i, "")
      .replace(/^current company\s*:?\s*/i, "")
      .replace(/^empresa actual\s*:?\s*/i, "")
      .replace(/^company\s*:?\s*/i, "")
      .replace(/\s+(logo|logotipo)$/i, "")
      .replace(/^[•·\-–]+\s*/, "");
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

  function scoreTopCard(el, h1) {
    if (!el || !el.querySelector?.("h1")) return -999;
    const text = getVisibleText(el);
    const lines = getLines(el).filter((line) => !isNoiseLine(line));
    if (text.length < clean(h1.textContent).length + 10 || text.length > 4500) return -999;
    let score = 0;
    if (el.matches?.(".pv-top-card, .ph5, .ph5.pb5, .mt2.relative, section")) score += 5;
    if (lines.some(looksLikeHeadline)) score += 8;
    if (lines.some(looksLikeLocation)) score += 8;
    if (el.querySelector('a[href*="/company/"], button[aria-label*="Empresa atual"], button[aria-label*="Current company"]')) score += 5;
    if (/dados de contato|contact info/i.test(text)) score += 2;
    if (/destaques|highlights|atividade|activity|experiência|experience|mais perfis|people also viewed/i.test(text)) score -= 10;
    score -= Math.max(0, lines.length - 14);
    return score;
  }

  function topCardScope() {
    const h1 = document.querySelector("main h1") || document.querySelector("h1");
    if (!h1) return null;
    const candidates = [];
    const selectors = [
      ".pv-top-card",
      ".ph5.pb5",
      ".ph5",
      ".mt2.relative",
      "section.artdeco-card",
      "section",
    ];
    for (const sel of selectors) {
      const el = h1.closest(sel);
      if (el) candidates.push(el);
    }

    let node = h1.parentElement;
    const main = document.querySelector("main");
    for (let i = 0; node && node !== document.body && node !== main?.parentElement && i < 12; i += 1) {
      candidates.push(node);
      node = node.parentElement;
    }

    let best = null;
    let bestScore = -999;
    for (const candidate of candidates) {
      const score = scoreTopCard(candidate, h1);
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    return best || h1.parentElement;
  }

  function getMainProfileWindow(fullName) {
    const main = document.querySelector("main");
    const lines = uniqueLines(getLines(main).filter((line) => !isNoiseLine(line)));
    const name = lower(fullName);
    if (!name) return lines.slice(0, 20);
    const idx = lines.findIndex((line) => lower(line).replace(/\s*[·•]\s*\d+º?.*$/i, "") === name);
    if (idx >= 0) return lines.slice(idx, idx + 14);
    return lines.slice(0, 20);
  }

  function extractProfileLines(card, fullName) {
    const cardLines = getLines(card).filter((line) => !isNoiseLine(line));
    const windowLines = getMainProfileWindow(fullName);
    const name = clean(fullName).replace(/\s*[·•]\s*\d+º?.*$/i, "");
    return uniqueLines([...cardLines, ...windowLines]).filter((line) => {
      const comparable = clean(line).replace(/\s*[·•]\s*\d+º?.*$/i, "");
      return comparable && lower(comparable) !== lower(name) && lower(comparable) !== lower(fullName);
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
        if (looksLikeHeadline(txt) && lower(txt) !== lower(fullName)) return txt;
      }
    }

    const lines = extractProfileLines(card, fullName);
    for (const line of lines) {
      if (looksLikeHeadline(line)) return line;
    }

    const jt = clean(person?.jobTitle);
    if (jt) return jt;
    const og = safe(() => document.querySelector('meta[property="og:description"]')?.content);
    if (og) return clean(og.split(/[·•]/)[0]);
    return "";
  }

  function companyFromHeadline(headline) {
    if (!headline) return "";
    const patterns = [
      /\bat\s+([^|·•,]+(?:[, ]+[A-Z0-9][^|·•,]+)?)$/i,
      /\b(?:na|no|em)\s+([^|·•,]+(?:[, ]+[A-Z0-9][^|·•,]+)?)$/i,
      /@\s*([^|·•,]+)$/i,
    ];
    for (const pattern of patterns) {
      const m = headline.match(pattern);
      if (m?.[1]) return sanitizeCompany(m[1]);
    }
    return "";
  }

  function extractCompany(card, person, headline, fullName) {
    try {
      const wf = person?.worksFor;
      if (Array.isArray(wf) && wf[0]?.name) return clean(wf[0].name);
      if (wf && typeof wf === "object" && wf.name) return clean(wf.name);
    } catch {
      /* ignore */
    }
    if (card) {
      const btn = card.querySelector(
        'button[aria-label*="Empresa atual"], button[aria-label*="Current company"], button[aria-label*="Empresa actual"], a[aria-label*="Empresa atual"], a[aria-label*="Current company"], a[aria-label*="Empresa actual"]',
      );
      const btnTxt = sanitizeCompany(clean(btn?.textContent || btn?.getAttribute("aria-label")));
      if (btnTxt && !isNoiseLine(btnTxt)) return btnTxt;

      const linkAria = card.querySelector('a[href*="/company/"][aria-label]');
      const aria = sanitizeCompany(clean(linkAria?.getAttribute("aria-label")));
      if (aria && !isNoiseLine(aria)) return aria;
      const link = card.querySelector('a[href*="/company/"]');
      const txt = sanitizeCompany(clean(link?.textContent));
      if (txt && !isNoiseLine(txt)) return txt;
    }

    const fromHeadline = companyFromHeadline(headline);
    if (fromHeadline) return fromHeadline;

    const lines = extractProfileLines(card, fullName);
    const companyLine = lines.find((line) => line !== headline && looksLikeCompany(line));
    return companyLine ? sanitizeCompany(companyLine) : "";
  }

  function extractLocation(card, person, fullName) {
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
        if (looksLikeLocation(txt)) return txt;
      }
    }

    const line = extractProfileLines(card, fullName).find((candidate) => looksLikeLocation(candidate));
    return line || "";
  }

  function extractAvatar(card) {
    const scopes = [card, document.querySelector("main"), document].filter(Boolean);
    const sels = [
      "img.pv-top-card-profile-picture__image",
      "img.pv-top-card-profile-picture__image--show",
      "img.evi-image.profile-photo-edit__preview",
      ".pv-top-card-profile-picture img",
      ".pv-top-card__photo img",
      'button[aria-label*="foto" i] img',
      'button[aria-label*="photo" i] img',
      'img[width="200"]',
      "button img.profile-photo-edit__preview",
    ];
    for (const scope of scopes) {
      for (const sel of sels) {
        const el = scope.querySelector?.(sel);
        const src = el?.getAttribute?.("src");
        if (src && /^https?:/i.test(src) && !/ghosts\/person/i.test(src)) return src;
      }
    }
    const og = safe(() => document.querySelector('meta[property="og:image"]')?.content);
    if (og && /^https?:/i.test(og) && !/ghosts\/person/i.test(og)) return og;
    return "";
  }

  // ──────────────────────────────────────────────────────────────
  // Extratores ricos (v2.0) — perfil completo, sinais, atividade
  // Cada um é isolado e tolerante a falhas (LinkedIn muda DOM com frequência)
  // ──────────────────────────────────────────────────────────────

  const ANCHOR_IDS = {
    experience: ["experience"],
    education: ["education"],
    skills: ["skills"],
    certifications: ["licenses_and_certifications", "certifications"],
    languages: ["languages"],
    projects: ["projects"],
    publications: ["publications"],
    volunteering: ["volunteer_experience", "volunteering"],
    recommendations: ["recommendations_received", "recommendations"],
    activity: ["content_collections", "activity"],
  };

  function findSectionByAnchor(ids) {
    for (const id of ids) {
      const a = document.getElementById(id);
      if (a) return a.closest("section") || a.parentElement;
    }
    return null;
  }

  function findSectionByTitle(titleRegex) {
    const sections = document.querySelectorAll("main section, main div.artdeco-card");
    for (const s of sections) {
      const headers = s.querySelectorAll(
        "h2, h2 span[aria-hidden='true'], .pvs-header__title span, .pvs-header__title, .pv-profile-card__header h2, header h2",
      );
      for (const h of headers) {
        const txt = clean(h.textContent || "");
        if (txt && titleRegex.test(txt)) return s;
      }
    }
    return null;
  }

  function findSection(kind, titleRegex) {
    return findSectionByAnchor(ANCHOR_IDS[kind] || []) || findSectionByTitle(titleRegex);
  }

  function extractListItems(section) {
    if (!section) return [];
    const items = section.querySelectorAll(
      "li.artdeco-list__item, li.pvs-list__paged-list-item, .pvs-entity",
    );
    const out = [];
    for (const li of items) {
      const lines = uniqueLines(getLines(li).filter((l) => !isNoiseLine(l)));
      // LinkedIn duplica visualmente cada texto (aria-hidden); pegamos pares únicos
      if (lines.length) out.push(lines);
    }
    return out;
  }

  // Para documentos parseados via fetch (sem layout — innerText não funciona)
  function extractListItemsFromDoc(doc) {
    if (!doc) return [];
    const main = doc.querySelector("main") || doc.body;
    if (!main) return [];
    const items = main.querySelectorAll(
      "li.artdeco-list__item, li.pvs-list__paged-list-item, .pvs-entity",
    );
    const out = [];
    for (const li of items) {
      const spans = li.querySelectorAll('span[aria-hidden="true"]');
      const lines = [];
      spans.forEach((s) => {
        const t = clean(s.textContent || "");
        if (t) lines.push(t);
      });
      const filtered = uniqueLines(lines.filter((l) => !isNoiseLine(l)));
      if (filtered.length) out.push(filtered);
    }
    return out;
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function triggerLazyLoad() {
    return safe(async () => {
      const origin = window.scrollY;
      window.scrollTo(0, document.body.scrollHeight);
      await wait(600);
      window.scrollTo(0, Math.floor(document.body.scrollHeight / 2));
      await wait(400);
      window.scrollTo(0, origin);
      await wait(200);
    });
  }

  async function fetchDetailsHtml(slug, sectionPath) {
    try {
      const url = `https://www.linkedin.com/in/${encodeURIComponent(slug)}/details/${sectionPath}/`;
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const resp = await fetch(url, { credentials: "include", signal: ctrl.signal });
      clearTimeout(t);
      if (!resp.ok) return null;
      const html = await resp.text();
      return new DOMParser().parseFromString(html, "text/html");
    } catch {
      return null;
    }
  }

  function extractAbout() {
    return safe(() => {
      const sec = findSectionByTitle(/^(sobre|about)$/i);
      if (!sec) return "";
      const span = sec.querySelector("div.display-flex.ph5.pv3 span[aria-hidden='true'], .inline-show-more-text span[aria-hidden='true']");
      return clean(span?.textContent || getVisibleText(sec).replace(/^(sobre|about)\s*/i, ""));
    });
  }

  function extractExperiences() {
    return safe(() => {
      const sec = findSection("experience", /^(experiência|experiencia|experience)/i);
      const items = extractListItems(sec);
      return items.slice(0, 20).map(mapExperience);
    }) || [];
  }

  function extractEducation() {
    return safe(() => {
      const sec = findSection("education", /^(formação|formacao|educação|educacao|education)/i);
      const items = extractListItems(sec);
      return items.slice(0, 20).map(mapEducation);
    }) || [];
  }

  function extractCertifications() {
    return safe(() => {
      const sec = findSection("certifications", /(licen[çc]as|certifica|licenses|certifications)/i);
      const items = extractListItems(sec);
      return items.slice(0, 30).map(mapCertification);
    }) || [];
  }

  function extractLanguages() {
    return safe(() => {
      const sec = findSection("languages", /^(idiomas|languages)/i);
      const items = extractListItems(sec);
      return items.slice(0, 20).map(mapLanguage);
    }) || [];
  }

  function extractSkills() {
    return safe(() => {
      const sec = findSection("skills", /^(compet[êe]ncias|skills|habilidades)/i);
      const items = extractListItems(sec);
      return items.slice(0, 100).map(mapSkill).filter((s) => s.name);
    }) || [];
  }

  function extractProjects() {
    return safe(() => {
      const sec = findSection("projects", /^(projetos|projects)/i);
      const items = extractListItems(sec);
      return items.slice(0, 30).map(mapProject);
    }) || [];
  }

  function extractPublications() {
    return safe(() => {
      const sec = findSection("publications", /^(publica[çc][õo]es|publications)/i);
      const items = extractListItems(sec);
      return items.slice(0, 30).map(mapPublication);
    }) || [];
  }

  function extractVolunteering() {
    return safe(() => {
      const sec = findSection("volunteering", /(volunt|volunteer)/i);
      const items = extractListItems(sec);
      return items.slice(0, 20).map(mapVolunteering);
    }) || [];
  }

  // ───── Mappers reutilizados pelo enrichment via /details/* ─────
  const mapExperience = (lines) => ({
    title: lines[0] || null,
    company: lines[1] || null,
    period: lines[2] || null,
    location: lines[3] || null,
    description: lines.slice(4).join(" · ") || null,
  });
  const mapEducation = (lines) => ({
    school: lines[0] || null,
    degree: lines[1] || null,
    period: lines[2] || null,
    description: lines.slice(3).join(" · ") || null,
  });
  const mapCertification = (lines) => ({
    name: lines[0] || null,
    issuer: lines[1] || null,
    issued: lines[2] || null,
  });
  const mapLanguage = (lines) => ({
    name: lines[0] || null,
    proficiency: lines[1] || null,
  });
  const mapSkill = (lines) => ({
    name: lines[0] || null,
    endorsements:
      lines.slice(1).find((l) => /\d+\s*(endosso|endorsement)/i.test(l)) || null,
  });
  const mapProject = (lines) => ({
    name: lines[0] || null,
    period: lines[1] || null,
    description: lines.slice(2).join(" · ") || null,
  });
  const mapPublication = (lines) => ({
    title: lines[0] || null,
    publisher: lines[1] || null,
    date: lines[2] || null,
  });
  const mapVolunteering = (lines) => ({
    role: lines[0] || null,
    organization: lines[1] || null,
    period: lines[2] || null,
  });

  const DETAILS_SECTIONS = [
    ["experiences", "experience", (l) => mapExperience(l), 20],
    ["education", "education", (l) => mapEducation(l), 20],
    ["skills_detailed", "skills", (l) => mapSkill(l), 100],
    ["certifications", "certifications", (l) => mapCertification(l), 30],
    ["languages", "languages", (l) => mapLanguage(l), 20],
    ["projects", "projects", (l) => mapProject(l), 30],
    ["publications", "publications", (l) => mapPublication(l), 30],
    ["volunteering", "volunteering", (l) => mapVolunteering(l), 20],
  ];

  async function enrichProfileFromDetails(profile) {
    const m = (location.pathname || "").match(/\/in\/([^/]+)/);
    if (!m) return profile;
    const slug = decodeURIComponent(m[1]);

    await Promise.all(
      DETAILS_SECTIONS.map(async ([field, path, mapper, limit]) => {
        try {
          if (Array.isArray(profile[field]) && profile[field].length > 0) return;
          const doc = await fetchDetailsHtml(slug, path);
          if (!doc) return;
          const items = extractListItemsFromDoc(doc).slice(0, limit);
          const mapped = items
            .map(mapper)
            .filter((x) => Object.values(x).some((v) => v));
          if (mapped.length) profile[field] = mapped;
        } catch {
          /* falha isolada por seção */
        }
      }),
    );

    return profile;
  }



  function extractOpenToWork(card) {
    return safe(() => {
      const text =
        (card ? getVisibleText(card) : "") +
        " " +
        getVisibleText(document.querySelector("main"));
      if (/#OpenToWork|aberto a oportunidades|open to work/i.test(text)) return true;
      const selectors = [
        'img[alt*="OpenToWork" i]',
        'img[alt*="#OPENTOWORK" i]',
        '[data-test-icon*="open-to-work" i]',
        '[aria-label*="Open to work" i]',
        '[aria-label*="aberto a oportunidades" i]',
        '.pv-open-to-frame',
        '[data-test-id*="OPEN_TO_WORK" i]',
      ];
      for (const sel of selectors) {
        if (document.querySelector(sel)) return true;
      }
      return false;
    });
  }


  function extractConnectionDegree(card) {
    return safe(() => {
      const span = card?.querySelector(".dist-value, .distance-badge, .pv-text-details__distance-text");
      const txt = clean(span?.textContent || "");
      const m = txt.match(/(1|2|3)\s*(?:st|nd|rd|º)/i);
      if (m) return `${m[1]}${m[1] === "1" ? "st" : m[1] === "2" ? "nd" : "rd"}`;
      const main = getVisibleText(card);
      if (/fora da sua rede|out of network/i.test(main)) return "out";
      return null;
    });
  }

  function extractAvailableActions(card) {
    return safe(() => {
      const scope = card || document.querySelector("main");
      if (!scope) return null;
      const text = getVisibleText(scope);
      return {
        message: /\b(message|mensagem)\b/i.test(text) && !!scope.querySelector('button[aria-label*="Message" i], a[aria-label*="Message" i], button[aria-label*="Mensagem" i]'),
        connect: !!scope.querySelector('button[aria-label*="Connect" i], button[aria-label*="Conectar" i]'),
        inmail: /\bInMail\b/.test(text),
        follow: !!scope.querySelector('button[aria-label*="Follow" i], button[aria-label*="Seguir" i]'),
      };
    });
  }

  function extractExternalLinks() {
    return safe(() => {
      const links = {};
      const anchors = document.querySelectorAll('main a[href]');
      for (const a of anchors) {
        const href = a.getAttribute("href") || "";
        if (!/^https?:/i.test(href)) continue;
        if (/linkedin\.com/i.test(href)) continue;
        if (/github\.com/i.test(href) && !links.github) links.github = href;
        else if (/(twitter\.com|x\.com)/i.test(href) && !links.twitter) links.twitter = href;
        else if (/behance\.net/i.test(href) && !links.behance) links.behance = href;
        else if (/dribbble\.com/i.test(href) && !links.dribbble) links.dribbble = href;
        else if (/medium\.com/i.test(href) && !links.medium) links.medium = href;
        else if (/(youtube\.com|youtu\.be)/i.test(href) && !links.youtube) links.youtube = href;
        else if (!links.website && /(portfolio|\.dev|\.io|\.me|\.com|\.com\.br)/i.test(href)) links.website = href;
      }
      return Object.keys(links).length ? links : null;
    });
  }

  function extractCurrentCompanyData(card) {
    return safe(() => {
      // Tenta no top-card primeiro; fallback para 1ª experiência
      const scopes = [
        card,
        findSection("experience", /^(experiência|experiencia|experience)/i),
      ].filter(Boolean);
      for (const scope of scopes) {
        const link = scope.querySelector('a[href*="/company/"]');
        if (!link) continue;
        const url = link.getAttribute("href") || null;
        const name =
          clean(link.querySelector('span[aria-hidden="true"]')?.textContent) ||
          clean(link.textContent || "");
        const logo = link.querySelector("img")?.getAttribute("src") || null;
        if (name || url) {
          return {
            name: name || null,
            url: url ? new URL(url, location.origin).toString() : null,
            logo_url: logo && /^https?:/i.test(logo) ? logo : null,
          };
        }
      }
      return null;
    });
  }


  function extractRecentActivity() {
    return safe(() => {
      const sec = findSectionByTitle(/(atividade|activity)/i);
      if (!sec) return [];
      const posts = sec.querySelectorAll(".feed-shared-update-v2, .occludable-update, .pvs-list__item--line-separated");
      const out = [];
      for (const p of posts) {
        if (out.length >= 5) break;
        const txt = clean(getVisibleText(p)).slice(0, 280);
        const link = p.querySelector('a[href*="/posts/"], a[href*="/feed/update/"]');
        if (txt) out.push({
          excerpt: txt,
          url: link?.href || null,
          type: /comment|comentou/i.test(txt) ? "comment" : "post",
        });
      }
      return out;
    }) || [];
  }

  function extractRecommendations() {
    return safe(() => {
      const sec = findSectionByTitle(/(recomenda|recommendation)/i);
      const items = extractListItems(sec);
      return items.slice(0, 10).map((lines) => ({
        author: lines[0] || null,
        relationship: lines[1] || null,
        text: lines.slice(2).join(" ") || null,
      }));
    }) || [];
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
    const company = extractCompany(card, person, headline, full_name);
    const location_ = extractLocation(card, person, full_name);
    const avatar = extractAvatar(card);

    return {
      linkedin_url: url,
      full_name,
      current_position: headline,
      current_company: company,
      location: location_,
      avatar_url: avatar,
      source: "linkedin_extension",
      capture_version: "2.1",
      // Perfil rico
      headline: headline || null,
      about: extractAbout() || null,
      photo_url: avatar || null,
      experiences: extractExperiences(),
      education: extractEducation(),
      certifications: extractCertifications(),
      languages: extractLanguages(),
      skills_detailed: extractSkills(),
      projects: extractProjects(),
      publications: extractPublications(),
      volunteering: extractVolunteering(),
      // Sinais
      open_to_work: extractOpenToWork(card),
      connection_degree: extractConnectionDegree(card),
      available_actions: extractAvailableActions(card),
      // Links/empresa/atividade
      external_links: extractExternalLinks(),
      current_company_data: extractCurrentCompanyData(card),
      recent_activity: extractRecentActivity(),
      recommendations: extractRecommendations(),
    };
  }

  function missingFields(profile) {
    const fields = [];
    if (!profile.full_name) fields.push("nome");
    if (!profile.current_position) fields.push("cargo/headline");
    if (!profile.current_company) fields.push("empresa");
    if (!profile.location) fields.push("localização");
    return fields;
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
    const missing = missingFields(profile).filter((field) => field !== "nome");
    const partial = opts?.partial
      ? `<div class="thh-warn" style="margin-top:6px">Ainda faltam: ${escapeHtml(missing.join(", ") || "detalhes")}. Role até o topo, aguarde o perfil carregar e tente novamente.</div>`
      : "";
    const richBits = [];
    if (profile.open_to_work) richBits.push("OpenToWork");
    if (profile.connection_degree) richBits.push(`Conexão ${profile.connection_degree}`);
    if (profile.experiences?.length) richBits.push(`${profile.experiences.length} exp.`);
    if (profile.education?.length) richBits.push(`${profile.education.length} edu.`);
    if (profile.skills_detailed?.length) richBits.push(`${profile.skills_detailed.length} skills`);
    if (profile.languages?.length) richBits.push(`${profile.languages.length} idiomas`);
    if (profile.certifications?.length) richBits.push(`${profile.certifications.length} certs`);
    if (profile.recent_activity?.length) richBits.push(`${profile.recent_activity.length} posts`);
    const richLine = richBits.length
      ? `<div class="thh-muted" style="margin-top:4px;font-size:11px">📊 ${escapeHtml(richBits.join(" · "))}</div>`
      : "";
    el.innerHTML = `
      <div><b>${escapeHtml(profile.full_name)}</b></div>
      <div class="thh-muted">${escapeHtml(profile.current_position) || "—"}</div>
      <div class="thh-muted">${escapeHtml(profile.current_company) || "—"}</div>
      <div class="thh-muted">${escapeHtml(profile.location) || "—"}</div>${richLine}${partial}`;
  }

  function isComplete(p) {
    return !!(p.full_name && p.current_position && (p.current_company || p.location));
  }

  function stopExtractionLoops() {
    extractionStops.forEach((stop) => stop());
    extractionStops.clear();
  }

  function startExtractionLoop(onProfile) {
    let observer = null;
    let debounce = null;
    let timeout = null;
    let done = false;
    const start = Date.now();

    function cleanup() {
      if (observer) observer.disconnect();
      observer = null;
      if (debounce) clearTimeout(debounce);
      if (timeout) clearTimeout(timeout);
      extractionStops.delete(cleanup);
    }
    extractionStops.add(cleanup);

    function attempt() {
      if (done) return;
      const profile = extractProfile();
      const complete = isComplete(profile);
      const timedOut = Date.now() - start > EXTRACT_TIMEOUT_MS;
      onProfile(profile, { partial: timedOut && !complete });
      if (complete || timedOut) {
        done = true;
        cleanup();
      }
    }

    attempt();
    if (done) return cleanup;

    const target = document.querySelector("main") || document.body;
    observer = new MutationObserver(() => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(attempt, 300);
    });
    observer.observe(target, { childList: true, subtree: true, characterData: true });
    timeout = setTimeout(() => {
      if (!done) attempt();
    }, EXTRACT_TIMEOUT_MS + 500);
    return cleanup;
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
        <div class="thh-mode-row">
          <label class="thh-label" style="margin:0">Modo</label>
          <select id="thh-mode" class="thh-select thh-select-inline">
            <option value="auto">Detectar automaticamente</option>
            <option value="direct">Mensagem direta</option>
            <option value="connect">Convite com nota</option>
            <option value="inmail">InMail</option>
          </select>
        </div>
        <textarea id="thh-message" class="thh-textarea" rows="6" placeholder="Mensagem renderizada aparece aqui"></textarea>
        <div class="thh-counter-row">
          <span id="thh-counter" class="thh-counter">0 caracteres</span>
          <span id="thh-pill" class="thh-pill thh-pill-idle">idle</span>
        </div>
        <div class="thh-actions">
          <button id="thh-prepare" class="thh-btn thh-primary">Preparar no LinkedIn</button>
          <button id="thh-copy" class="thh-btn">Copiar</button>
        </div>
        <div class="thh-actions" id="thh-confirm-row" style="display:none">
          <button id="thh-already-sent" class="thh-btn">Já enviei</button>
          <button id="thh-cancel-watch" class="thh-btn">Cancelar</button>
        </div>
        <p class="thh-footer">Você sempre confirma o envio dentro do LinkedIn. Pareie no ícone da extensão.</p>
      </div>`;
    document.body.appendChild(root);

    document.getElementById("thh-close").onclick = () => {
      stopExtractionLoops();
      root.remove();
    };

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
      stopExtractionLoops();
      startExtractionLoop((p, opts) => {
        latestProfile = p;
        if (isComplete(p)) allowPartialOnce = false;
        renderPreview(p, opts);
      });
    };

    sendRuntimeMessage({ type: "PING" }, (resp) => {
      const status = document.getElementById("thh-status");
      if (!status) return;
      if (!resp?.paired) {
        status.innerHTML = `<span class="thh-warn">${escapeHtml(resp?.error || "Extensão não pareada.")}</span>`;
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
        const missing = missingFields(latestProfile).filter((field) => field !== "nome");
        setStatus(`Perfil incompleto (${missing.join(", ") || "detalhes"}). Clique em Re-detectar ou clique em Salvar novamente para gravar parcial.`, true);
        return;
      }
      const btn = document.getElementById("thh-capture");
      btn.disabled = true;
      try {
        btn.textContent = "Coletando perfil…";
        await triggerLazyLoad();
        latestProfile = extractProfile();
        btn.textContent = "Enriquecendo…";
        latestProfile = await enrichProfileFromDetails(latestProfile);
        renderPreview(latestProfile, { partial: !isComplete(latestProfile) });
      } catch {
        /* segue para salvar mesmo se enrichment falhar */
      }
      btn.textContent = "Salvando…";
      sendRuntimeMessage({ type: "CAPTURE_CANDIDATE", payload: latestProfile }, (resp) => {
        btn.disabled = false;
        btn.textContent = "Salvar candidato";
        if (resp?.ok) {
          setStatus("Capturado ✓ — abra TechHire para vincular vaga.");
          renderPreview(latestProfile, { captured: true });
          window.__thhCaptureId = resp.data?.capture_id;
        } else {
          setStatus(resp?.error || "Erro", true);
        }
      });
    };


    function loadTemplates() {
      sendRuntimeMessage({ type: "LIST_TEMPLATES" }, (resp) => {
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
      lastTemplateId = templateId;
      sendRuntimeMessage({ type: "RENDER_TEMPLATE", payload: { templateId, profile: latestProfile } }, (resp) => {
        if (resp?.ok) {
          document.getElementById("thh-message").value = resp.data?.body || "";
          updateCounter?.();
        }
      });
    }

    // ──────────────────────────────────────────────────────────────
    // Envio assistido via window.__thhMessenger (v0.3.0)
    // ──────────────────────────────────────────────────────────────

    const LIMITS = window.__thhMessenger?.LIMITS || { connect: 300, direct: 1900, inmail_body: 1900 };
    const messageEl = document.getElementById("thh-message");
    const counterEl = document.getElementById("thh-counter");
    const pillEl = document.getElementById("thh-pill");
    const modeSel = document.getElementById("thh-mode");
    const prepareBtn = document.getElementById("thh-prepare");
    const confirmRow = document.getElementById("thh-confirm-row");
    let lastTemplateId = "";
    let cancelWatch = null;
    let lastPrepared = null;

    function setPill(state, label) {
      if (!pillEl) return;
      pillEl.className = `thh-pill thh-pill-${state}`;
      pillEl.textContent = label;
    }

    function effectiveMode() {
      const sel = modeSel?.value || "auto";
      if (sel !== "auto") return sel;
      try {
        return window.__thhMessenger?.pickAuto?.(window.__thhMessenger.detect()) || "direct";
      } catch {
        return "direct";
      }
    }

    function limitFor(mode) {
      if (mode === "connect") return LIMITS.connect || 300;
      if (mode === "inmail") return LIMITS.inmail_body || 1900;
      return LIMITS.direct || 1900;
    }

    function updateCounter() {
      const text = messageEl?.value || "";
      const mode = effectiveMode();
      const limit = limitFor(mode);
      const len = text.length;
      if (counterEl) {
        counterEl.textContent = `${len}/${limit} · ${
          mode === "connect" ? "convite" : mode === "inmail" ? "InMail" : "mensagem direta"
        }`;
        counterEl.classList.toggle("thh-over", len > limit);
      }
      if (prepareBtn) {
        prepareBtn.textContent =
          mode === "connect"
            ? "Preparar convite"
            : mode === "inmail"
              ? "Preparar InMail"
              : "Preparar mensagem";
      }
    }

    messageEl?.addEventListener("input", updateCounter);
    modeSel?.addEventListener("change", updateCounter);
    updateCounter();

    function logOutreach({ channel, body, detected }) {
      sendRuntimeMessage(
        {
          type: "LOG_OUTREACH",
          payload: {
            linkedin_url: latestProfile.linkedin_url,
            channel,
            body,
            template_id: lastTemplateId || undefined,
            detected: Boolean(detected),
            final_length: body.length,
          },
        },
        (resp) => {
          if (resp?.ok) {
            setStatus("Outreach registrado ✓");
            setPill("sent", detected ? "enviado" : "enviado (manual)");
          } else {
            setStatus(resp?.error || "Erro ao registrar outreach", true);
            setPill("failed", "falhou");
          }
        },
      );
    }

    document.getElementById("thh-copy").onclick = async () => {
      const v = messageEl.value;
      await navigator.clipboard.writeText(v);
      setStatus("Mensagem copiada.");
    };

    prepareBtn.onclick = async () => {
      const messenger = window.__thhMessenger;
      if (!messenger) {
        setStatus("Messenger não carregado. Recarregue a aba.", true);
        return;
      }
      const body = messageEl.value;
      if (!body.trim()) {
        setStatus("Escreva ou selecione um template primeiro.", true);
        return;
      }
      const mode = effectiveMode();
      prepareBtn.disabled = true;
      setPill("filling", "preenchendo…");
      try {
        const result = await messenger.prepare(mode, { body });
        lastPrepared = result;
        setPill("ready", result.truncated ? "preenchido (truncado)" : "aguardando envio");
        setStatus(
          result.truncated
            ? `Texto truncado para ${result.final_length} chars (limite do LinkedIn). Revise e envie.`
            : "Preenchido no LinkedIn. Revise e clique em Enviar lá.",
          result.truncated,
        );
        confirmRow.style.display = "flex";
        if (cancelWatch) cancelWatch();
        cancelWatch = messenger.watchSend(result.mode, body, (outcome) => {
          confirmRow.style.display = "none";
          cancelWatch = null;
          if (outcome.ok && outcome.detected) {
            logOutreach({ channel: result.channel, body, detected: true });
          } else if (outcome.evidence === "timeout") {
            setPill("idle", "sem confirmação");
            setStatus("Não detectamos o envio em 5min. Se enviou, clique em 'Já enviei'.", true);
          }
        });
      } catch (e) {
        setPill("failed", "falhou");
        setStatus(e?.message || "Erro ao preparar mensagem.", true);
      } finally {
        prepareBtn.disabled = false;
      }
    };

    document.getElementById("thh-already-sent").onclick = () => {
      if (cancelWatch) cancelWatch();
      cancelWatch = null;
      confirmRow.style.display = "none";
      const channel = lastPrepared?.channel || "linkedin_message";
      logOutreach({ channel, body: messageEl.value, detected: false });
    };

    document.getElementById("thh-cancel-watch").onclick = () => {
      if (cancelWatch) cancelWatch();
      cancelWatch = null;
      confirmRow.style.display = "none";
      setPill("idle", "idle");
      setStatus("Acompanhamento cancelado.");
    };
  }

  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      stopExtractionLoops();
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

  window.__techhireHunterExtractProfile = extractProfile;

  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot, { once: true });
})();