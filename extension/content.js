// TechHire Hunter — Content script (v1.0.8 — modo debug)
// Extrai dados de perfil do LinkedIn via DOM visível + <title> + og:meta + JSON-LD.
// Mantém MutationObserver ativo até preencher headline/empresa/local OU timeout.

(function () {
  if (window.__techhireHunterInjected) return;
  window.__techhireHunterInjected = true;

  const SIDEBAR_ID = "techhire-hunter-sidebar";
  const EXTRACT_TIMEOUT_MS = 15000;
  const CONTEXT_INVALIDATED = "Extensão recarregada. Recarregue a aba do LinkedIn.";
  const extractionStops = new Set();

  const clean = (s) => (s == null ? "" : String(s)).replace(/\s+/g, " ").trim();
  const lower = (s) => clean(s).toLowerCase();
  const normalizedName = (s) =>
    clean(s)
      .replace(/\s*(?:verificado|verified)\s*/gi, " ")
      .replace(/\s*[·•]\s*\d+\s*(?:º|st|nd|rd).*$/i, "")
      .replace(/\s+/g, " ")
      .trim();
  const escapeHtml = (s) =>
    clean(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  const parserDiagnostics = {
    voyager: { attempted: 0, ok: 0, failed: 0, status: [] },
    details: { attempted: 0, ok: 0, failed: 0, status: [] },
  };

  function pushDiagnosticStatus(bucket, entry) {
    bucket.status.push(entry);
    if (bucket.status.length > 12) bucket.status.splice(0, bucket.status.length - 12);
  }

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

  const getLines = (el) => getVisibleText(el).split(/\n+/).map(clean).filter(Boolean);

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
    status.innerHTML = warn
      ? `<span class="thh-warn">${escapeHtml(message)}</span>`
      : escapeHtml(message);
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
          callback?.({
            ok: false,
            error: text,
            contextInvalidated: /context invalidated/i.test(text),
          });
          return;
        }
        callback?.(resp);
      });
    } catch (e) {
      const messageText = /context invalidated/i.test(e?.message || "")
        ? CONTEXT_INVALIDATED
        : e?.message || "Erro na extensão";
      setStatus(messageText, true);
      callback?.({
        ok: false,
        error: messageText,
        contextInvalidated: /context invalidated/i.test(messageText),
      });
    }
  }

  // v3.1: junk patterns do rodapé/anúncios do LinkedIn que contaminam fallback
  // de texto quando /details/* vem sem SSR renderizado.
  const LINKEDIN_JUNK_RE =
    /(op[çc][õo]es de an[úu]ncios|por que estou vendo este an[úu]ncio|ocultar ou denunciar|n[ãa]o quero ver|j[áa] vi este mesmo an[úu]ncio|seu feedback nos ajudar[áa]|denunciar este an[úu]ncio|solu[çc][õo]es de marketing|solu[çc][õo]es de vendas|solu[çc][õo]es de talentos|prefer[êe]ncias de an[úu]ncios|termos e privacidade|diretrizes da comunidade|central de ajuda|central de seguran[çc]a|acesse suas configura[çc][õo]es|visibilidade da recomenda[çc][ãa]o|linked\s*in corporation|©\s*20\d{2}|dispositivo m[óo]vel|pequenas empresas|pol[íi]ticas para comunidades|gerencie sua conta|gerencie suas prefer[êe]ncias|d[úu]vidas\?|comunidades profissionais|servi[çc]os ao consumidor)/i;

  const isLinkedInUiLine = (line) => {
    const value = lower(line);
    return (
      !value ||
      /^(conectar|connect|seguir|follow|mensagem|message|mais|more|dados de contato|contact info|salvar candidato|re-detectar|template|copiar mensagem|marcar como enviada|português|portugues|english|inglês|ingles|para negócios|para negocios|anunciar|minha rede|vagas|notificações|notificacoes|eu|enviar|sobre|publicidade|carreiras|acessibilidade|linked)$/.test(
        value,
      ) ||
      /seguidores|followers|seguidor|conexões|conexoes|connections|connection|mútuo|mutual|grau|degree|perfis para você|people also viewed|mais perfis|destaques|highlights/.test(
        value,
      ) ||
      LINKEDIN_JUNK_RE.test(line)
    );
  };

  const isNoiseLine = (line) => isLinkedInUiLine(line);

  // Heurística: um item mapeado é "lixo" se qualquer campo bate no junk regex.
  const itemHasJunk = (obj) => {
    if (!obj || typeof obj !== "object") return false;
    return Object.values(obj).some(
      (v) => typeof v === "string" && (LINKEDIN_JUNK_RE.test(v) || isLinkedInUiLine(v)),
    );
  };

  const looksLikeNameLine = (line, fullName) => {
    const a = lower(normalizedName(line));
    const b = lower(normalizedName(fullName));
    return Boolean(a && b && (a === b || a.startsWith(`${b} `) || b.startsWith(`${a} `)));
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
        /\b(account|sales|marketing|developer|engineer|analyst|analista|especialista|consultor|manager|diretor|founder|recruiter|growth|designer|product|software|programador|arquiteto|telecom|cloud|infra|government|governo|professor|professora|docente|educador|educadora|pesquisador|pesquisadora|coordenador|coordenadora|estudante|teacher|lecturer|researcher)\b/i.test(
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
    if (
      el.querySelector(
        'a[href*="/company/"], button[aria-label*="Empresa atual"], button[aria-label*="Current company"]',
      )
    )
      score += 5;
    if (/dados de contato|contact info/i.test(text)) score += 2;
    if (
      /destaques|highlights|atividade|activity|experiência|experience|mais perfis|people also viewed/i.test(
        text,
      )
    )
      score -= 10;
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
    for (
      let i = 0;
      node && node !== document.body && node !== main?.parentElement && i < 12;
      i += 1
    ) {
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
      return (
        comparable && lower(comparable) !== lower(name) && lower(comparable) !== lower(fullName)
      );
    });
  }

  // ──────────────────────────────────────────────────────────────
  // SSR reader (v2.3): LinkedIn embute o estado inicial em
  // <code id="bpr-guid-*"> dentro de `included[]`. Lemos esses
  // objetos como FONTE PRIMÁRIA — DOM e /details/* viram fallback.
  // ──────────────────────────────────────────────────────────────
  let _ssrCache = null;
  let _ssrExtraItems = [];
  function collectSsrObjects(value, out = [], seen = new WeakSet()) {
    if (!value || typeof value !== "object") return out;
    if (seen.has(value)) return out;
    seen.add(value);
    if (typeof value.$type === "string" || typeof value["$type"] === "string") out.push(value);
    if (Array.isArray(value)) {
      for (const item of value) collectSsrObjects(item, out, seen);
      return out;
    }
    for (const v of Object.values(value)) collectSsrObjects(v, out, seen);
    return out;
  }

  function ssrIncluded(doc = document) {
    if (doc === document && _ssrCache) return _ssrCache;
    const items = [];
    const codes = doc.querySelectorAll(
      'code[id^="bpr-guid"], code[style*="display:none"], code[style*="display: none"]',
    );
    for (const c of codes) {
      const raw = (c.textContent || "").trim();
      if (raw.length < 50 || raw[0] !== "{") continue;
      try {
        const json = JSON.parse(raw);
        if (Array.isArray(json?.included)) items.push(...json.included);
        collectSsrObjects(json, items);
      } catch {
        /* ignore */
      }
    }
    const deduped = [];
    const seen = new Set();
    for (const item of items) {
      const key =
        item?.entityUrn || item?.urn || item?.trackingId || JSON.stringify(item).slice(0, 300);
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
    }
    const merged = doc === document ? dedupeSsrItems([...deduped, ..._ssrExtraItems]) : deduped;
    if (doc === document) _ssrCache = merged;
    return merged;
  }

  function dedupeSsrItems(items) {
    const deduped = [];
    const seen = new Set();
    items.forEach((item, index) => {
      if (!item || typeof item !== "object") return;
      const key =
        item.entityUrn ||
        item.urn ||
        item.objectUrn ||
        item.trackingId ||
        `${item.$type || "unknown"}:${index}:${JSON.stringify(item).slice(0, 220)}`;
      if (seen.has(key)) return;
      seen.add(key);
      deduped.push(item);
    });
    return deduped;
  }

  function mergeSsrJson(json) {
    const items = [];
    if (Array.isArray(json?.included)) items.push(...json.included);
    collectSsrObjects(json, items);
    if (!items.length) return 0;
    _ssrExtraItems = dedupeSsrItems([..._ssrExtraItems, ...items]);
    _ssrCache = null;
    return items.length;
  }

  const SSR_TYPES = {
    position: /(\.Position|ProfilePosition|PositionView|PositionGroup|Experience)/i,
    education: /(\.Education|EducationView|ProfileEducation|School)/i,
    skill: /(\.Skill|SkillView|StandardizedSkill|EndorsedSkill)/i,
    certification: /(\.Certification|CertificationView|License)/i,
    language: /(\.Language|LanguageView)/i,
    topCard: /(\.ProfileTopCard|\.MiniProfile|\.Profile|TopCard)/,
  };

  function looksLikeSsrKind(it, kind) {
    if (!it || typeof it !== "object") return false;
    const t = String(it.$type || it["$type"] || it.entityUrn || it.urn || it.objectUrn || "");
    if (SSR_TYPES[kind]?.test(t)) return true;
    if (kind === "position")
      return Boolean(
        (it.title || it.profilePosition || it.position) &&
        (it.companyName || it.company || it.companyUrn || it.dateRange || it.timePeriod),
      );
    if (kind === "education")
      return Boolean(
        it.schoolName || it.school || it.schoolUrn || it.degreeName || it.fieldOfStudy,
      );
    if (kind === "skill") return Boolean((it.name || it.skillName) && /skill/i.test(t));
    if (kind === "certification")
      return Boolean(
        (it.name || it.title) &&
        (it.authority || it.issuer || it.licenseNumber || /certif|license/i.test(t)),
      );
    if (kind === "language")
      return Boolean((it.name || it.language) && (it.proficiency || /language/i.test(t)));
    return false;
  }

  const ssrFind = (kind, doc) => ssrIncluded(doc).filter((it) => looksLikeSsrKind(it, kind));

  function firstScalar(...values) {
    for (const value of values) {
      if (typeof value === "string" || typeof value === "number") {
        const text = clean(value);
        if (text && text !== "[object Object]") return text;
      }
    }
    return "";
  }

  function ssrText(node, depth = 0) {
    if (!node) return "";
    if (typeof node === "string") return clean(node);
    if (typeof node === "number") return clean(String(node));
    if (typeof node === "object" && depth < 4) {
      const direct = firstScalar(
        node.text,
        node.localizedName,
        node.value,
        node.name,
        node.title,
        node.headline,
        node.description,
      );
      if (direct) return direct;
      if (Array.isArray(node.attributes)) {
        const joined = node.attributes
          .map((a) => ssrText(a, depth + 1))
          .filter(Boolean)
          .join(" ");
        if (joined) return clean(joined);
      }
      for (const [key, value] of Object.entries(node)) {
        if (/urn|tracking|control|navigation|image|logo|vector|paging/i.test(key)) continue;
        const txt = ssrText(value, depth + 1);
        if (txt && !/^\{/.test(txt)) return txt;
      }
    }
    return "";
  }

  function ssrTextLines(node, depth = 0, out = []) {
    if (!node || depth > 5) return out;
    if (typeof node === "string" || typeof node === "number") {
      const value = clean(node);
      if (value && value !== "[object Object]" && !/^urn:li:/i.test(value)) out.push(value);
      return out;
    }
    if (Array.isArray(node)) {
      node.forEach((item) => ssrTextLines(item, depth + 1, out));
      return out;
    }
    if (typeof node === "object") {
      const direct = firstScalar(
        node.text,
        node.localizedName,
        node.value,
        node.name,
        node.title,
        node.headline,
        node.description,
      );
      if (direct) out.push(direct);
      for (const [key, value] of Object.entries(node)) {
        if (/urn|tracking|control|navigation|image|logo|vector|paging|dash|video|entity/i.test(key))
          continue;
        ssrTextLines(value, depth + 1, out);
      }
    }
    return uniqueLines(out.filter((line) => !isNoiseLine(line)));
  }

  function ssrFirstLine(it, used = []) {
    const usedSet = new Set(used.map(lower).filter(Boolean));
    return ssrTextLines(it).find((line) => !usedSet.has(lower(line))) || "";
  }

  function ssrDateRange(dr) {
    if (!dr || typeof dr !== "object") return "";
    const fmt = (d) => {
      if (!d) return "";
      const m = d.month ? String(d.month).padStart(2, "0") : "";
      const y = d.year || "";
      return [m, y].filter(Boolean).join("/");
    };
    const a = fmt(dr.start);
    const b = fmt(dr.end) || "presente";
    return a ? `${a} – ${b}` : "";
  }

  function ssrTopCard(fullName = "") {
    const arr = ssrFind("topCard");
    const slug = decodeURIComponent(
      location.pathname.match(/\/in\/([^/?#]+)/i)?.[1] || "",
    ).toLowerCase();
    let best = null;
    let bestScore = -999;
    for (const it of arr) {
      const first = ssrText(it.firstName);
      const last = ssrText(it.lastName);
      const name = clean(
        ssrText(it.fullName) || ssrText(it.name) || [first, last].filter(Boolean).join(" "),
      );
      const publicIdentifier = clean(
        it.publicIdentifier || it.publicProfileUrl || "",
      ).toLowerCase();
      const headline =
        ssrText(it.headline) ||
        ssrText(it.occupation) ||
        ssrText(it.subline) ||
        ssrText(it.summary);
      const location =
        ssrText(it.geoLocationName) || ssrText(it.locationName) || ssrText(it.address);
      let score = 0;
      if (headline) score += 8;
      if (location) score += 4;
      if (name && lower(name) === lower(fullName)) score += 20;
      if (slug && publicIdentifier.includes(slug)) score += 30;
      if (/MiniProfile/i.test(it.$type || "")) score -= 6;
      if (score > bestScore) {
        bestScore = score;
        best = { headline, location, name };
      }
    }
    return best?.headline || best?.location ? best : null;
  }

  // v3.0 — about/summary autoritativo: lê Profile.summary do SSR.
  // É a única forma confiável de obter o "Sobre" sem misturar com
  // "Atividade", "Mais perfis" e rodapé. Quando isto vier preenchido,
  // ele DEVE sobrescrever qualquer about extraído do DOM.
  function ssrProfileSummary(fullName = "") {
    const items = ssrIncluded();
    const slug = decodeURIComponent(
      location.pathname.match(/\/in\/([^/?#]+)/i)?.[1] || "",
    ).toLowerCase();
    let best = "";
    let bestScore = -999;
    for (const it of items) {
      if (!it || typeof it !== "object") continue;
      const type = String(it.$type || it["$type"] || "");
      if (!/\.Profile($|[^A-Za-z])/i.test(type) && !/MiniProfile/i.test(type)) continue;
      const summary = ssrText(it.summary) || ssrText(it.about) || "";
      if (!summary || summary.length < 12) continue;
      const publicIdentifier = clean(
        it.publicIdentifier || it.publicProfileUrl || "",
      ).toLowerCase();
      const name = clean(ssrText(it.fullName) || ssrText(it.name) || "");
      let score = summary.length > 60 ? 4 : 1;
      if (slug && publicIdentifier.includes(slug)) score += 30;
      if (name && lower(name) === lower(fullName)) score += 20;
      if (/MiniProfile/i.test(type)) score -= 6;
      if (score > bestScore) {
        bestScore = score;
        best = summary;
      }
    }
    return best || "";
  }

  // Detector de "about lixo": quando o DOM scrape capturou a página
  // inteira (Atividade/Mais perfis/footer) em vez do Sobre real.
  function looksLikeJunkAbout(text) {
    const t = clean(text);
    if (!t) return true;
    if (t.length > 1800) return true;
    return /(mais perfis para voc|people also viewed|atividade\s+\d|activity\s+\d|publica[çc][õo]es?\s+do\s+|posts?\s+de\s+|dados de contato|contact info|enviar mensagem|send message|seguidores?\b|followers?\b|conex[õo]es?\s+m[úu]tuas?|mutual connections?|abrir menu|open menu|languages?\s*$|portugu[êe]s\s*\(brasil\)|english\s*\(us\)|para neg[óo]cios|for business|principais compet[êe]ncias|key skills and technologies)/i.test(
      t,
    );
  }

  function ssrExperiences(doc = document) {
    return ssrFind("position", doc)
      .map((it) => {
        const title =
          ssrText(it.title) ||
          ssrText(it.profilePosition?.title) ||
          ssrText(it.position?.title) ||
          ssrFirstLine(it);
        const company =
          ssrText(it.companyName) ||
          ssrText(it.company) ||
          ssrText(it.company?.name) ||
          ssrText(it.profilePosition?.companyName) ||
          ssrFirstLine(it, [title]);
        return {
          title: title || null,
          company: company || null,
          period: ssrDateRange(it.dateRange) || ssrText(it.timePeriod) || null,
          location: ssrText(it.locationName) || null,
          description: ssrText(it.description) || null,
        };
      })
      .filter((x) => x.title || x.company);
  }
  function ssrEducation(doc = document) {
    return ssrFind("education", doc)
      .map((it) => {
        const school =
          ssrText(it.schoolName) ||
          ssrText(it.school) ||
          ssrText(it.school?.name) ||
          ssrFirstLine(it);
        return {
          school: school || null,
          degree:
            [ssrText(it.degreeName), ssrText(it.fieldOfStudy)].filter(Boolean).join(" · ") || null,
          period: ssrDateRange(it.dateRange) || null,
          description: ssrText(it.description) || null,
        };
      })
      .filter((x) => x.school);
  }
  function ssrSkills(doc = document) {
    return ssrFind("skill", doc)
      .map((it) => ({
        name: ssrText(it.name) || ssrText(it.skillName) || ssrFirstLine(it) || null,
        endorsements: null,
      }))
      .filter((x) => x.name);
  }
  function ssrCertifications(doc = document) {
    return ssrFind("certification", doc)
      .map((it) => ({
        name: ssrText(it.name) || ssrText(it.title) || ssrFirstLine(it) || null,
        issuer: ssrText(it.authority) || ssrText(it.issuer) || null,
        issued: ssrDateRange(it.timePeriod) || ssrText(it.issueDate) || null,
      }))
      .filter((x) => x.name);
  }
  function ssrLanguages(doc = document) {
    return ssrFind("language", doc)
      .map((it) => ({
        name: ssrText(it.name) || ssrText(it.language) || ssrFirstLine(it) || null,
        proficiency: ssrText(it.proficiency) || null,
      }))
      .filter((x) => x.name);
  }

  function extractHeadline(card, person, fullName) {
    // 1. JSON SSR included[] do documento atual
    const fromSSR = ssrTopCard(fullName)?.headline;
    if (fromSSR && lower(fromSSR) !== lower(fullName)) return clean(fromSSR);

    const fromH1Block = safe(() => {
      const h1 = document.querySelector("main h1") || document.querySelector("h1");
      if (!h1) return "";
      const scopes = [
        h1.closest(".pv-text-details__left-panel"),
        h1.closest(".ph5.pb5"),
        h1.closest(".mt2.relative"),
        h1.parentElement,
        h1.parentElement?.parentElement,
      ].filter(Boolean);
      for (const scope of scopes) {
        const lines = uniqueLines(getLines(scope).filter((line) => !isNoiseLine(line)));
        const idx = lines.findIndex((line) => looksLikeNameLine(line, fullName));
        const candidates = idx >= 0 ? lines.slice(idx + 1, idx + 5) : lines.slice(0, 5);
        for (const line of candidates) {
          if (line && !looksLikeNameLine(line, fullName) && looksLikeHeadline(line)) return line;
        }
      }
      return "";
    });
    if (fromH1Block && looksLikeHeadline(fromH1Block)) return clean(fromH1Block);

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
    if (og) {
      const head = clean(og.split(/[·•|]/)[0]);
      if (looksLikeHeadline(head)) return head;
    }
    const meta = safe(() => document.querySelector('meta[name="description"]')?.content);
    if (meta) {
      const head = clean(meta.split(/[·•|]/)[0]);
      if (looksLikeHeadline(head)) return head;
    }
    // og:title: "Nome - Cargo | LinkedIn"
    const ogt = safe(() => document.querySelector('meta[property="og:title"]')?.content);
    if (ogt) {
      const parts = ogt.replace(/\s*\|\s*LinkedIn.*$/i, "").split(/\s+-\s+/);
      if (parts.length >= 2) {
        const head = clean(parts.slice(1).join(" - "));
        if (head && head.length > 4 && lower(head) !== lower(fullName)) return head;
      }
    }
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
    // SSR primary: 1ª experiência cobre o "atual" na maioria dos perfis
    const ssrExp = ssrExperiences();
    if (ssrExp[0]?.company) return clean(ssrExp[0].company);
    try {
      const wf = person?.worksFor;
      if (Array.isArray(wf) && wf[0]?.name) return clean(wf[0].name);
      if (wf && typeof wf === "object" && wf.name) return clean(wf.name);
    } catch {
      /* ignore */
    }

    const fromHeadline = companyFromHeadline(headline);
    if (fromHeadline) return fromHeadline;

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

    const lines = extractProfileLines(card, fullName);
    const companyLine = lines.find((line) => line !== headline && looksLikeCompany(line));
    return companyLine ? sanitizeCompany(companyLine) : "";
  }

  function extractLocation(card, person, fullName) {
    const ssrLoc = ssrTopCard(fullName)?.location;
    if (ssrLoc && looksLikeLocation(ssrLoc)) return ssrLoc;
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
        "span.text-body-small.inline.t-black--light, span.text-body-small, .pv-text-details__left-panel .text-body-small",
      );
      for (const el of spans) {
        const txt = clean(el.textContent);
        if (looksLikeLocation(txt)) return txt;
      }
    }

    const line = extractProfileLines(card, fullName).find((candidate) =>
      looksLikeLocation(candidate),
    );
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
    about: ["about"],
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
      if (!a) continue;
      const ownSection = a.closest("section");
      if (ownSection) return ownSection;
      let node = a.nextElementSibling || a.parentElement?.nextElementSibling;
      for (let i = 0; node && i < 8; i += 1, node = node.nextElementSibling) {
        if (node.matches?.("section, .artdeco-card, div.pv-profile-card")) return node;
        const nested = node.querySelector?.("section, .artdeco-card, div.pv-profile-card");
        if (nested) return nested;
      }
      let parent = a.parentElement;
      for (let i = 0; parent && i < 4; i += 1, parent = parent.parentElement) {
        const sibling = parent.nextElementSibling;
        if (sibling?.matches?.("section, .artdeco-card, div.pv-profile-card")) return sibling;
      }
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

  const SECTION_BOUNDARY_RE =
    /^(destaques|highlights|atividade|activity|experi[êe]ncia|experience|forma[çc][ãa]o|education|licen[çc]as|certifica|licenses|certifications|compet[êe]ncias|skills|principais compet[êe]ncias|idiomas|languages|recomenda|recommendations|publica[çc][õo]es|publications|projetos|projects|voluntariado|volunteering|mais perfis|people also viewed)\b/i;

  function cleanAboutCandidate(value, fullName = "") {
    const text = clean(value)
      .replace(/^(sobre|about)\s+/i, "")
      .replace(
        /\s+\b(key skills and technologies|principais compet[êe]ncias|atividade|activity|publica[çc][õo]es|posts|coment[áa]rios|comments|imagens|images)\b.*$/i,
        "",
      )
      .replace(/\s*…\s*mais\s*$/i, "")
      .trim();
    if (!text) return "";
    if (looksLikeNameLine(text, fullName)) return "";
    if (text.length > 1800) return "";
    if (
      /\b(dados de contato|contact info|mais de \d+ conex|connections|enviar mensagem|send message|conectar|connect|atividade|activity|publica[çc][õo]es|posts)\b/i.test(
        text,
      )
    )
      return "";
    return text;
  }

  function extractAboutFromSection(sec, fullName = "") {
    if (!sec) return "";
    const directSelectors = [
      ".pv-shared-text-with-see-more span[aria-hidden='true']",
      ".inline-show-more-text span[aria-hidden='true']",
      ".inline-show-more-text--is-collapsed span[aria-hidden='true']",
      "div.display-flex.ph5.pv3 span[aria-hidden='true']",
    ];
    for (const sel of directSelectors) {
      const candidates = Array.from(sec.querySelectorAll(sel))
        .map((el) => cleanAboutCandidate(el.textContent || "", fullName))
        .filter(Boolean)
        .sort((a, b) => b.length - a.length);
      if (candidates[0]) return candidates[0];
    }

    const lines = getLines(sec).filter((line) => !isNoiseLine(line));
    const start = lines.findIndex((line) => /^(sobre|about)$/i.test(line));
    const afterTitle = start >= 0 ? lines.slice(start + 1) : lines;
    const body = [];
    for (const line of afterTitle) {
      if (SECTION_BOUNDARY_RE.test(line)) break;
      const candidate = cleanAboutCandidate(line, fullName);
      if (candidate) body.push(candidate);
    }
    return cleanAboutCandidate(body.join("\n"), fullName);
  }

  function extractAboutFromMainText(fullName = "") {
    const lines = sliceMainSectionLines(
      /^(sobre|about)$/i,
      /^(destaques|highlights|atividade|activity|experi[êe]ncia|experience|forma[çc][ãa]o|education|key skills and technologies|principais compet[êe]ncias|compet[êe]ncias|skills|licen[çc]as|certifica|licenses|idiomas|languages|publica[çc][õo]es|posts|coment[áa]rios|comments|imagens|images)\b/i,
    );
    return cleanAboutCandidate(lines.join(" "), fullName);
  }

  function extractSkillsFromMainText() {
    const skillLines = [
      ...sliceMainSectionLines(
        /^(key skills and technologies|principais compet[êe]ncias|compet[êe]ncias|skills)$/i,
        /^(atividade|activity|experi[êe]ncia|experience|forma[çc][ãa]o|education|publica[çc][õo]es|posts|coment[áa]rios|comments|imagens|images|idiomas|languages|licen[çc]as|certifica)\b/i,
      ),
    ];
    const aboutLines = sliceMainSectionLines(
      /^(sobre|about)$/i,
      /^(atividade|activity|experi[êe]ncia|experience|forma[çc][ãa]o|education|publica[çc][õo]es|posts|coment[áa]rios|comments|imagens|images)\b/i,
    );
    const aboutSkillLine = aboutLines.find((line) =>
      /key skills and technologies|principais compet[êe]ncias|compet[êe]ncias|skills/i.test(line),
    );
    if (aboutSkillLine)
      skillLines.push(
        aboutSkillLine.replace(
          /.*?(key skills and technologies|principais compet[êe]ncias|compet[êe]ncias|skills)\s*:*/i,
          "",
        ),
      );
    return uniqueLines(
      skillLines
        .join(" · ")
        .split(/[·•,;|]/)
        .map((s) => clean(s.replace(/…\s*mais/gi, "")))
        .filter(
          (s) =>
            s.length >= 2 && s.length <= 80 && !SECTION_BOUNDARY_RE.test(s) && !isLinkedInUiLine(s),
        ),
    )
      .slice(0, 100)
      .map((name) => ({ name, endorsements: null }));
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

  function splitConcatenatedProfileText(text) {
    const raw = clean(text);
    if (!raw) return [];
    const markers = [
      "Sobre",
      "About",
      "Principais competências",
      "Key skills and technologies",
      "Experiência",
      "Experience",
      "Formação",
      "Education",
      "Licenças e certificados",
      "Licenses & certifications",
      "Competências",
      "Skills",
      "Atividades",
      "Activity",
      "Publicações",
      "Posts",
      "Comentários",
      "Comments",
      "Imagens",
      "Images",
    ];
    const markerRe = new RegExp(
      `\\b(${markers.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
      "gi",
    );
    return uniqueLines(
      raw
        .replace(/([a-zá-ú0-9])([A-ZÁ-Ú][a-zá-ú])/g, "$1\n$2")
        .replace(markerRe, "\n$1\n")
        .split(/\n+|\s{2,}|[·•]\s*/)
        .map(clean)
        .filter(Boolean),
    );
  }

  function profileMainLines() {
    const main = document.querySelector("main");
    if (!main) return [];
    const domLines = getLines(main).map(clean).filter(Boolean);
    const textLines = splitConcatenatedProfileText(main.textContent || "");
    return uniqueLines([...domLines, ...textLines].filter((line) => !isLinkedInUiLine(line)));
  }

  function sliceMainSectionLines(startRe, endRe) {
    const lines = profileMainLines();
    const start = lines.findIndex((line) => startRe.test(line));
    if (start < 0) return [];
    const out = [];
    for (const line of lines.slice(start + 1)) {
      if (endRe.test(line)) break;
      if (!line || isLinkedInUiLine(line)) continue;
      out.push(line);
    }
    return uniqueLines(out);
  }

  // Para documentos parseados via fetch (sem layout — innerText não funciona)
  function extractListItemsFromDoc(doc) {
    if (!doc) return [];
    const main = doc.querySelector("main") || doc.body;
    if (!main) return [];
    const items = main.querySelectorAll(
      [
        "li.artdeco-list__item",
        "li.pvs-list__paged-list-item",
        ".pvs-entity",
        ".pvs-list__item--line-separated",
        "[data-view-name*='profile-component-entity']",
        "[data-view-name*='profile-component'] li",
      ].join(", "),
    );
    const out = [];
    for (const li of items) {
      const spans = li.querySelectorAll(
        'span[aria-hidden="true"], span[dir="ltr"], .visually-hidden, time, a[href]',
      );
      const lines = [];
      spans.forEach((s) => {
        const t = clean(s.textContent || "");
        if (t) lines.push(t);
      });
      if (!lines.length) {
        const fallbackLines = clean(li.textContent || "")
          .split(/(?<=\.)\s+|\n+|\s{2,}/)
          .map(clean)
          .filter(Boolean);
        lines.push(...fallbackLines);
      }
      const filtered = uniqueLines(lines.filter((l) => !isNoiseLine(l) && !/^urn:li:/i.test(l)));
      if (filtered.length) out.push(filtered);
    }
    return out;
  }

  function extractDetailsTextLines(doc) {
    const root = doc?.querySelector?.("main") || doc?.body;
    if (!root) return [];
    return uniqueLines(
      clean(root.textContent || "")
        .replace(/([a-zá-ú])([A-ZÁ-Ú])/g, "$1\n$2")
        .split(/\n+|\s{2,}|(?<=\.)\s+(?=[A-ZÁ-Ú])/)
        .map(clean)
        .filter((line) => line && !isNoiseLine(line) && !/^urn:li:/i.test(line)),
    );
  }

  function extractListItemsFromDetailsText(doc, kind) {
    const lines = extractDetailsTextLines(doc);
    if (!lines.length) return [];
    const titleRe = {
      experience: /^(experi[êe]ncia|experience)$/i,
      education: /^(forma[çc][ãa]o|education)$/i,
      skills: /^(compet[êe]ncias|skills|principais compet[êe]ncias)$/i,
      certifications: /(licen[çc]as|certifica|licenses|certifications)/i,
      languages: /^(idiomas|languages)$/i,
      projects: /^(projetos|projects)$/i,
      publications: /^(publica[çc][õo]es|publications)$/i,
      volunteering: /(volunt|volunteer)/i,
    }[kind];
    const start = titleRe ? lines.findIndex((line) => titleRe.test(line)) : -1;
    // v3.1: sem o marcador da seção no documento /details/*, o conteúdo é
    // navegação/rodapé/anúncios — devolver vazio em vez de inventar items.
    if (start < 0) return [];
    const scoped = lines.slice(start + 1);
    if (kind === "skills") {
      return scoped
        .filter((line) => line.length <= 120 && !SECTION_BOUNDARY_RE.test(line))
        .slice(0, 100)
        .map((line) => [line]);
    }
    const groups = [];
    let current = [];
    for (const line of scoped) {
      if (SECTION_BOUNDARY_RE.test(line) && current.length) break;
      const beginsNew =
        current.length >= 2 &&
        (kind === "experience"
          ? looksLikeHeadline(line)
          : kind === "education"
            ? /universidade|university|faculdade|college|instituto|school|escola/i.test(line)
            : false);
      if (beginsNew) {
        groups.push(current);
        current = [];
      }
      if (line.length <= 500) current.push(line);
      if (current.length >= 8) {
        groups.push(current);
        current = [];
      }
      if (groups.length >= 100) break;
    }
    if (current.length) groups.push(current);
    return groups;
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function triggerLazyLoad() {
    return safe(async () => {
      const origin = window.scrollY;
      const totalHeight = () =>
        Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
      const hasItems = (id) => {
        const el = document.getElementById(id);
        return !!el
          ?.closest("section")
          ?.querySelectorAll("li.artdeco-list__item, li.pvs-list__paged-list-item, .pvs-entity")
          .length;
      };
      // Sweep 1: step-scroll through the whole page so every section's
      // IntersectionObserver fires and hydrates (about, experience, education, skills, ...).
      const step = Math.max(400, Math.floor(window.innerHeight * 0.6));
      for (let y = 0; y <= totalHeight(); y += step) {
        window.scrollTo(0, y);
        await wait(280);
      }
      // Sweep 2: keep nudging bottom + mid-page until exp/edu have items
      // or we hit a hard cap (~12s).
      for (let i = 0; i < 18; i++) {
        window.scrollTo(0, totalHeight());
        await wait(380);
        if (hasItems("experience") && hasItems("education")) break;
        window.scrollTo(0, Math.floor(totalHeight() / 2));
        await wait(220);
      }
      window.scrollTo(0, origin);
      await wait(150);
    });
  }

  // Parser auxiliar: LinkedIn SSR embute JSON em <code> com array `included`.
  // Quando o DOM da página /details/* vier sem spans renderizados, caímos para o JSON.
  function extractListItemsFromCodeJson(doc, kind) {
    if (!doc) return [];
    const typeMatchers = {
      experience: /Position($|\b)/,
      education: /Education($|\b)/,
      skills: /\.Skill($|\b)/,
      certifications: /Certification($|\b)/,
      languages: /Language($|\b)/,
      projects: /Project($|\b)/,
      publications: /Publication($|\b)/,
      volunteering: /Volunteer/,
    };
    const re = typeMatchers[kind];
    if (!re) return [];
    const codes = doc.querySelectorAll('code[id^="bpr-guid"], code[style*="display: none"]');
    const out = [];
    for (const c of codes) {
      const raw = c.textContent || "";
      if (raw.length < 50 || !raw.includes("{")) continue;
      let json;
      try {
        json = JSON.parse(raw);
      } catch {
        continue;
      }
      const included = Array.isArray(json?.included) ? json.included : [];
      for (const it of included) {
        const t = it?.$type || it?.["$type"] || "";
        if (!re.test(t)) continue;
        const lines = [];
        const push = (v) => {
          const s = clean(v);
          if (s) lines.push(s);
        };
        // Coletar campos textuais comuns, incluindo objetos nested do Voyager.
        push(ssrText(it.title) || ssrText(it.name) || ssrText(it.schoolName));
        push(
          ssrText(it.companyName) ||
            ssrText(it.subtitle) ||
            ssrText(it.degreeName) ||
            ssrText(it.fieldOfStudy) ||
            ssrText(it.issuer) ||
            ssrText(it.publisher),
        );
        push(
          ssrDateRange(it.dateRange) ||
            ssrText(it.timePeriod) ||
            ssrText(it.issuedOn) ||
            ssrText(it.publishedOn),
        );
        push(ssrText(it.locationName));
        push(ssrText(it.description));
        if (lines.length) out.push(lines);
      }
      if (out.length) break;
    }
    return out;
  }

  async function fetchDetailsHtml(slug, sectionPath) {
    try {
      const url = `https://www.linkedin.com/in/${encodeURIComponent(slug)}/details/${sectionPath}/`;
      parserDiagnostics.details.attempted += 1;
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const resp = await fetch(url, { credentials: "include", signal: ctrl.signal });
      clearTimeout(t);
      pushDiagnosticStatus(parserDiagnostics.details, {
        section: sectionPath,
        status: resp.status,
      });
      if (!resp.ok) {
        parserDiagnostics.details.failed += 1;
        return null;
      }
      parserDiagnostics.details.ok += 1;
      const html = await resp.text();
      return new DOMParser().parseFromString(html, "text/html");
    } catch {
      return null;
    }
  }

  function linkedInCsrfToken() {
    const m = document.cookie.match(/(?:^|;\s*)JSESSIONID="?([^";]+)"?/i);
    return m?.[1] || "";
  }

  function discoverVoyagerRequests() {
    const urls = [];
    const slug = decodeURIComponent(
      location.pathname.match(/\/in\/([^/?#]+)/i)?.[1] || "",
    ).toLowerCase();
    document
      .querySelectorAll(
        'code[id^="datalet-bpr-guid"], code[id^="bpr-guid"], code[style*="display: none"], code[style*="display:none"]',
      )
      .forEach((c) => {
        const raw = (c.textContent || "").trim();
        if (!raw.startsWith("{")) return;
        try {
          const json = JSON.parse(raw);
          const req = clean(json?.request || json?.url || "");
          if (!req || !/voyager\/api/i.test(req)) return;
          if (!/(profile|skill|education|position|experience)/i.test(req)) return;
          if (
            slug &&
            !decodeURIComponent(req).toLowerCase().includes(slug) &&
            /profiles\//i.test(req)
          )
            return;
          urls.push(
            req.startsWith("http")
              ? req
              : `https://www.linkedin.com${req.startsWith("/") ? "" : "/"}${req}`,
          );
        } catch {
          /* ignore */
        }
      });
    return uniqueLines(urls);
  }

  async function fetchVoyagerJson(url) {
    try {
      const csrf = linkedInCsrfToken();
      const headers = {
        accept: "application/vnd.linkedin.normalized+json+2.1",
        "x-restli-protocol-version": "2.0.0",
      };
      if (csrf) headers["csrf-token"] = csrf;
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      parserDiagnostics.voyager.attempted += 1;
      const resp = await fetch(url, {
        credentials: "include",
        headers,
        signal: ctrl.signal,
      });
      clearTimeout(t);
      pushDiagnosticStatus(parserDiagnostics.voyager, {
        status: resp.status,
        path: url.replace(/^https:\/\/www\.linkedin\.com/i, "").slice(0, 160),
      });
      if (!resp.ok) {
        parserDiagnostics.voyager.failed += 1;
        return null;
      }
      parserDiagnostics.voyager.ok += 1;
      return await resp.json();
    } catch {
      parserDiagnostics.voyager.failed += 1;
      return null;
    }
  }

  async function fetchVoyagerProfile(slug) {
    const candidates = [
      ...discoverVoyagerRequests(),
      `https://www.linkedin.com/voyager/api/identity/profiles/${encodeURIComponent(slug)}/profileView`,
    ];
    for (const url of uniqueLines(candidates)) {
      const json = await fetchVoyagerJson(url);
      if (json) return json;
    }
    return null;
  }

  async function enrichProfileFromVoyager(profile) {
    const m = (location.pathname || "").match(/\/in\/([^/?#]+)/i);
    if (!m) return profile;
    const slug = decodeURIComponent(m[1]).replace(/\/+$/, "");
    if (!slug) return profile;
    const json = await fetchVoyagerProfile(slug);
    if (!json || !mergeSsrJson(json)) return profile;

    const top = ssrTopCard(profile.full_name || "");
    if (!profile.current_position && top?.headline) profile.current_position = top.headline;
    if (!profile.headline && top?.headline) profile.headline = top.headline;
    if (!profile.location && top?.location) profile.location = top.location;

    // v3.0: SSR summary é autoritativo para "Sobre".
    // Sobrescreve DOM se o SSR tiver dados OU se o DOM extraiu lixo.
    const ssrAbout = ssrProfileSummary(profile.full_name || "");
    if (ssrAbout) {
      profile.about = ssrAbout;
      profile.__about_source = "voyager_ssr";
    } else if (looksLikeJunkAbout(profile.about)) {
      profile.about = null;
      profile.__about_source = "discarded_junk";
    }

    const exp = ssrExperiences();
    if (!profile.current_company && exp[0]?.company) profile.current_company = exp[0].company;
    if (!Array.isArray(profile.experiences) || !profile.experiences.length)
      profile.experiences = exp.slice(0, 20);
    const edu = ssrEducation();
    if (!Array.isArray(profile.education) || !profile.education.length)
      profile.education = edu.slice(0, 20);
    const skills = ssrSkills();
    if (!Array.isArray(profile.skills_detailed) || !profile.skills_detailed.length)
      profile.skills_detailed = skills.slice(0, 100);
    const certs = ssrCertifications();
    if (!Array.isArray(profile.certifications) || !profile.certifications.length)
      profile.certifications = certs.slice(0, 30);
    const langs = ssrLanguages();
    if (!Array.isArray(profile.languages) || !profile.languages.length)
      profile.languages = langs.slice(0, 20);
    return profile;
  }

  function extractAbout(fullName = "") {
    return safe(() => {
      const sec = findSection("about", /^(sobre|about)$/i);
      return extractAboutFromSection(sec, fullName) || extractAboutFromMainText(fullName);
    });
  }

  function extractExperiences() {
    const ssr = ssrExperiences();
    if (ssr.length) return ssr.slice(0, 20);
    return (
      safe(() => {
        const sec = findSection("experience", /^(experiência|experiencia|experience)/i);
        const items = extractListItems(sec);
        return items.slice(0, 20).map(mapExperience);
      }) || []
    );
  }

  function extractEducation() {
    const ssr = ssrEducation();
    if (ssr.length) return ssr.slice(0, 20);
    return (
      safe(() => {
        const sec = findSection("education", /^(formação|formacao|educação|educacao|education)/i);
        const items = extractListItems(sec);
        return items.slice(0, 20).map(mapEducation);
      }) || []
    );
  }

  function extractCertifications() {
    const ssr = ssrCertifications();
    if (ssr.length) return ssr.slice(0, 30);
    return (
      safe(() => {
        const sec = findSection(
          "certifications",
          /(licen[çc]as|certifica|licenses|certifications)/i,
        );
        const items = extractListItems(sec);
        return items.slice(0, 30).map(mapCertification);
      }) || []
    );
  }

  function extractLanguages() {
    const ssr = ssrLanguages();
    if (ssr.length) return ssr.slice(0, 20);
    return (
      safe(() => {
        const sec = findSection("languages", /^(idiomas|languages)/i);
        const items = extractListItems(sec);
        return items.slice(0, 20).map(mapLanguage);
      }) || []
    );
  }

  function extractSkills() {
    const ssr = ssrSkills();
    if (ssr.length) return ssr.slice(0, 100);
    return (
      safe(() => {
        const sec = findSection("skills", /^(compet[êe]ncias|skills|habilidades)/i);
        const items = extractListItems(sec);
        const fromSection = items
          .slice(0, 100)
          .map(mapSkill)
          .filter((s) => s.name);
        return fromSection.length ? fromSection : extractSkillsFromMainText();
      }) || []
    );
  }

  function extractProjects() {
    return (
      safe(() => {
        const sec = findSection("projects", /^(projetos|projects)/i);
        const items = extractListItems(sec);
        return items.slice(0, 30).map(mapProject);
      }) || []
    );
  }

  function extractPublications() {
    return (
      safe(() => {
        const sec = findSection("publications", /^(publica[çc][õo]es|publications)/i);
        const items = extractListItems(sec);
        return items.slice(0, 30).map(mapPublication);
      }) || []
    );
  }

  function extractVolunteering() {
    return (
      safe(() => {
        const sec = findSection("volunteering", /(volunt|volunteer)/i);
        const items = extractListItems(sec);
        return items.slice(0, 20).map(mapVolunteering);
      }) || []
    );
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
    endorsements: lines.slice(1).find((l) => /\d+\s*(endosso|endorsement)/i.test(l)) || null,
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
    const m = (location.pathname || "").match(/\/in\/([^/?#]+)/i);
    if (!m) return profile;
    const slug = decodeURIComponent(m[1]).replace(/\/+$/, "");
    if (!slug) return profile;

    await Promise.all(
      DETAILS_SECTIONS.map(async ([field, path, mapper, limit]) => {
        try {
          if (Array.isArray(profile[field]) && profile[field].length > 0) return;
          const doc = await fetchDetailsHtml(slug, path);
          if (!doc) return;
          let items = extractListItemsFromDoc(doc).slice(0, limit);
          if (!items.length) items = extractListItemsFromCodeJson(doc, path).slice(0, limit);
          if (!items.length) items = extractListItemsFromDetailsText(doc, path).slice(0, limit);
          const mapped = items
            .map(mapper)
            .filter((x) => Object.values(x).some((v) => v) && !itemHasJunk(x));
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
        (card ? getVisibleText(card) : "") + " " + getVisibleText(document.querySelector("main"));
      if (/#OpenToWork|aberto a oportunidades|open to work/i.test(text)) return true;
      const selectors = [
        'img[alt*="OpenToWork" i]',
        'img[alt*="#OPENTOWORK" i]',
        '[data-test-icon*="open-to-work" i]',
        '[aria-label*="Open to work" i]',
        '[aria-label*="aberto a oportunidades" i]',
        ".pv-open-to-frame",
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
      const span = card?.querySelector(
        ".dist-value, .distance-badge, .pv-text-details__distance-text",
      );
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
        message:
          /\b(message|mensagem)\b/i.test(text) &&
          !!scope.querySelector(
            'button[aria-label*="Message" i], a[aria-label*="Message" i], button[aria-label*="Mensagem" i]',
          ),
        connect: !!scope.querySelector(
          'button[aria-label*="Connect" i], button[aria-label*="Conectar" i]',
        ),
        inmail: /\bInMail\b/.test(text),
        follow: !!scope.querySelector(
          'button[aria-label*="Follow" i], button[aria-label*="Seguir" i]',
        ),
      };
    });
  }

  function extractExternalLinks() {
    return safe(() => {
      const links = {};
      const anchors = document.querySelectorAll("main a[href]");
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
        else if (!links.website && /(portfolio|\.dev|\.io|\.me|\.com|\.com\.br)/i.test(href))
          links.website = href;
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
    return (
      safe(() => {
        const sec = findSectionByTitle(/(atividade|activity)/i);
        if (!sec) return [];
        const posts = sec.querySelectorAll(
          ".feed-shared-update-v2, .occludable-update, .pvs-list__item--line-separated",
        );
        const out = [];
        for (const p of posts) {
          if (out.length >= 5) break;
          const txt = clean(getVisibleText(p)).slice(0, 280);
          const link = p.querySelector('a[href*="/posts/"], a[href*="/feed/update/"]');
          if (txt)
            out.push({
              excerpt: txt,
              url: link?.href || null,
              type: /comment|comentou/i.test(txt) ? "comment" : "post",
            });
        }
        return out;
      }) || []
    );
  }

  function extractRecommendations() {
    return (
      safe(() => {
        const sec = findSectionByTitle(/(recomenda|recommendation)/i);
        const items = extractListItems(sec);
        return items.slice(0, 10).map((lines) => ({
          author: lines[0] || null,
          relationship: lines[1] || null,
          text: lines.slice(2).join(" ") || null,
        }));
      }) || []
    );
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

    const profile = {
      linkedin_url: url,
      full_name,
      current_position: headline,
      current_company: company,
      location: location_,
      avatar_url: avatar,
      source: "linkedin_extension",
      capture_version: "3.1",
      // Perfil rico
      headline: headline || null,
      about: extractAbout(full_name) || null,
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
    profile.parser_diagnostics = buildParserDiagnostics(profile);
    return profile;
  }

  function buildParserDiagnostics(profile) {
    const codes = Array.from(
      document.querySelectorAll(
        'code[id^="bpr-guid"], code[id^="datalet-bpr-guid"], code[style*="display"]',
      ),
    );
    return {
      url_path: location.pathname,
      title: document.title || "",
      has_main: Boolean(document.querySelector("main")),
      ssr_code_count: codes.length,
      ssr_code_with_included_count: codes.filter((c) => /"included"\s*:/.test(c.textContent || ""))
        .length,
      ssr_object_count: ssrIncluded().length,
      extracted_counts: {
        experiences: Array.isArray(profile.experiences) ? profile.experiences.length : 0,
        education: Array.isArray(profile.education) ? profile.education.length : 0,
        skills: Array.isArray(profile.skills_detailed) ? profile.skills_detailed.length : 0,
      },
      voyager: parserDiagnostics.voyager,
      details: parserDiagnostics.details,
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
      status.textContent = complete
        ? "Detalhes detectados · pronto para capturar."
        : "Detectando detalhes do perfil…";
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
    renderDebug(profile);
  }

  function debugEnabled() {
    return document.getElementById("thh-debug-toggle")?.checked === true;
  }

  function fieldRow(label, value, opts) {
    const status = opts?.status;
    const detail = opts?.detail
      ? ` <span class="thh-muted" style="color:#94a3b8">${escapeHtml(opts.detail)}</span>`
      : "";
    let cls = "thh-debug-ok";
    let text = "ok";
    if (status === "missing") {
      cls = "thh-debug-miss";
      text = "vazio";
    } else if (status === "warn") {
      cls = "thh-debug-warn";
      text = opts?.text || "parcial";
    } else if (status === "ok") {
      cls = "thh-debug-ok";
      text = opts?.text || "ok";
    }
    return `<div class="thh-debug-row"><span class="thh-debug-key">${escapeHtml(label)}${detail}</span><span class="${cls}">${escapeHtml(String(value ?? text))}</span></div>`;
  }

  function renderDebug(profile) {
    const panel = document.getElementById("thh-debug-panel");
    if (!panel) return;
    if (!debugEnabled()) {
      panel.style.display = "none";
      return;
    }
    panel.style.display = "block";

    const d = profile?.parser_diagnostics || {};
    const counts = d.extracted_counts || {};
    const anchors = {
      about: !!document.querySelector('#about, [id="about"], section[data-section="summary"]'),
      experience: !!document.querySelector('#experience, [id="experience"]'),
      education: !!document.querySelector('#education, [id="education"]'),
      skills: !!document.querySelector('#skills, [id="skills"]'),
      languages: !!document.querySelector('#languages, [id="languages"]'),
      certifications: !!document.querySelector(
        '#licenses_and_certifications, [id="licenses_and_certifications"]',
      ),
      activity: !!document.querySelector(
        '#content_collections, [id="content_collections"], section[data-section="recent-activity"]',
      ),
    };

    const coreFields = [
      ["full_name", profile?.full_name],
      ["current_position", profile?.current_position],
      ["current_company", profile?.current_company],
      ["location", profile?.location],
      ["avatar_url", profile?.avatar_url],
      ["about", profile?.about ? `${String(profile.about).length} chars` : ""],
    ];
    const richFields = [
      ["experiences", counts.experiences || (profile?.experiences?.length ?? 0)],
      ["education", counts.education || (profile?.education?.length ?? 0)],
      ["skills_detailed", counts.skills || (profile?.skills_detailed?.length ?? 0)],
      ["languages", profile?.languages?.length ?? 0],
      ["certifications", profile?.certifications?.length ?? 0],
      ["projects", profile?.projects?.length ?? 0],
      ["recent_activity", profile?.recent_activity?.length ?? 0],
      ["external_links", profile?.external_links?.length ?? 0],
    ];

    const renderFields = (rows, kind) =>
      rows
        .map(([k, v]) => {
          if (kind === "core") {
            const status = v ? "ok" : "missing";
            return fieldRow(k, v || "—", { status });
          }
          const n = Number(v) || 0;
          const anchorKey =
            k === "skills_detailed" ? "skills" : k === "recent_activity" ? "activity" : k;
          const anchorOk = anchors[anchorKey];
          const detail = anchorKey in anchors ? `anchor#${anchorKey}: ${anchorOk ? "✓" : "✗"}` : "";
          const status = n > 0 ? "ok" : anchorOk ? "warn" : "missing";
          const text =
            n > 0 ? `${n} itens` : anchorOk ? "anchor visto, 0 extraídos" : "sem anchor / 0";
          return fieldRow(k, "", { status, text, detail });
        })
        .join("");

    const voyager = d.voyager || { attempted: 0, ok: 0, failed: 0, status: [] };
    const details = d.details || { attempted: 0, ok: 0, failed: 0, status: [] };
    const fetchStatus = (b) => `${b.ok}/${b.attempted} ok · ${b.failed} fail`;
    const lastStatus = (arr) =>
      arr && arr.length
        ? arr
            .slice(-6)
            .map((s) => {
              const code = s.code ?? s.status ?? "?";
              const name = s.url || s.endpoint || s.target || "";
              return `<div class="thh-debug-row"><span class="thh-debug-key">${escapeHtml(String(name).slice(0, 48))}</span><span class="${code === 200 ? "thh-debug-ok" : "thh-debug-miss"}">${escapeHtml(String(code))}</span></div>`;
            })
            .join("")
        : `<div class="thh-muted" style="color:#94a3b8">sem tentativas</div>`;

    panel.innerHTML = `
      <h4>Página</h4>
      ${fieldRow("url_path", d.url_path || location.pathname, { status: "ok" })}
      ${fieldRow("has_main", String(d.has_main ?? !!document.querySelector("main")), { status: d.has_main ? "ok" : "missing" })}
      ${fieldRow("ssr_code_count", d.ssr_code_count ?? 0, { status: (d.ssr_code_count || 0) > 0 ? "ok" : "missing" })}
      ${fieldRow("ssr_with_included", d.ssr_code_with_included_count ?? 0, { status: (d.ssr_code_with_included_count || 0) > 0 ? "ok" : "warn" })}
      ${fieldRow("ssr_objects", d.ssr_object_count ?? 0, { status: (d.ssr_object_count || 0) > 0 ? "ok" : "warn" })}
      <h4>Campos principais</h4>
      ${renderFields(coreFields, "core")}
      <h4>Dados ricos (extrator × anchor)</h4>
      ${renderFields(richFields, "rich")}
      <h4>Voyager (${escapeHtml(fetchStatus(voyager))})</h4>
      ${lastStatus(voyager.status)}
      <h4>Details fetch (${escapeHtml(fetchStatus(details))})</h4>
      ${lastStatus(details.status)}
      <div class="thh-debug-actions">
        <button class="thh-btn" id="thh-debug-copy">Copiar JSON</button>
        <button class="thh-btn" id="thh-debug-log">Log no console</button>
      </div>`;

    document.getElementById("thh-debug-copy").onclick = async () => {
      try {
        await navigator.clipboard.writeText(
          JSON.stringify({ profile, diagnostics: d, anchors }, null, 2),
        );
        setStatus("Diagnóstico copiado para a área de transferência.");
      } catch (e) {
        setStatus("Não foi possível copiar: " + (e?.message || e), true);
      }
    };
    document.getElementById("thh-debug-log").onclick = () => {
      console.log("[TechHire Hunter] debug", { profile, diagnostics: d, anchors });
      setStatus("Diagnóstico enviado para o console (DevTools).");
    };
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
        <label class="thh-debug-toggle"><input type="checkbox" id="thh-debug-toggle"/> Modo debug (mostrar diagnóstico de seletores)</label>
        <div id="thh-debug-panel" class="thh-debug-panel" style="display:none"></div>
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
    // Auto rola a página inteira uma vez para hidratar todas as seções (about,
    // experience, education, skills, ...). Sem isso, perfis abertos em background
    // ficam só com o shell + footer e a captura grava lixo.
    (async () => {
      await triggerLazyLoad();
      latestProfile = extractProfile();
      renderPreview(latestProfile, { partial: !isComplete(latestProfile) });
      renderDebug(latestProfile);
    })();
    startExtractionLoop((p, opts) => {
      latestProfile = p;
      if (isComplete(p)) allowPartialOnce = false;
      renderPreview(p, opts);
    });

    const debugToggle = document.getElementById("thh-debug-toggle");
    try {
      chrome.storage?.local?.get?.(["thh:debug"], (res) => {
        if (debugToggle && res && res["thh:debug"]) debugToggle.checked = true;
        renderDebug(latestProfile);
      });
    } catch {
      /* storage indisponível */
    }
    debugToggle?.addEventListener("change", () => {
      try {
        chrome.storage?.local?.set?.({ "thh:debug": debugToggle.checked });
      } catch {
        /* ignore */
      }
      renderDebug(latestProfile);
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
      const btn = document.getElementById("thh-capture");
      btn.disabled = true;
      try {
        btn.textContent = "Coletando perfil…";
        await triggerLazyLoad();
        latestProfile = extractProfile();
        btn.textContent = "Consultando detalhes…";
        latestProfile = await enrichProfileFromVoyager(latestProfile);
        btn.textContent = "Enriquecendo…";
        latestProfile = await enrichProfileFromDetails(latestProfile);
        renderPreview(latestProfile, { partial: !isComplete(latestProfile) });
      } catch {
        /* segue para salvar mesmo se enrichment falhar */
      }
      // v3.1 — Sanitização final: remove items de qualquer seção que
      // tenham caído no rodapé/anúncios do LinkedIn (Opções de anúncios,
      // Termos e Privacidade, LinkedIn Corporation, etc.).
      try {
        const arrFields = [
          "experiences",
          "education",
          "certifications",
          "languages",
          "skills_detailed",
          "projects",
          "publications",
          "volunteering",
          "recent_activity",
          "recommendations",
        ];
        for (const f of arrFields) {
          if (Array.isArray(latestProfile?.[f])) {
            latestProfile[f] = latestProfile[f].filter((x) => !itemHasJunk(x));
          }
        }
        if (latestProfile?.about && LINKEDIN_JUNK_RE.test(latestProfile.about)) {
          latestProfile.about = null;
        }
        // Recalcula contagens do diagnóstico após o filtro.
        if (latestProfile?.parser_diagnostics?.extracted_counts) {
          latestProfile.parser_diagnostics.extracted_counts = {
            experiences: latestProfile.experiences?.length || 0,
            education: latestProfile.education?.length || 0,
            skills: latestProfile.skills_detailed?.length || 0,
          };
        }
      } catch {
        /* não bloquear captura por falha do filtro */
      }
      // v3.0 — Guard rígido: aborta se não temos sinal estruturado real
      // (about do SSR, experiências OU educação). Sem isso o parser
      // está pegando shell/footer e mandando lixo pro TechHire.
      const d = latestProfile?.parser_diagnostics || {};
      const anchorsOk = d.anchors && Object.values(d.anchors).some((v) => v === true);
      const richCount =
        (latestProfile?.experiences?.length || 0) +
        (latestProfile?.education?.length || 0) +
        (latestProfile?.skills_detailed?.length || 0);
      const aboutFromSsr = latestProfile?.__about_source === "voyager_ssr";
      const structuredOk =
        aboutFromSsr ||
        (latestProfile?.experiences?.length || 0) > 0 ||
        (latestProfile?.education?.length || 0) > 0;
      const ssrOk = (d.ssr_code_count || 0) > 0;
      if (!structuredOk && !allowPartialOnce) {
        allowPartialOnce = true;
        btn.disabled = false;
        btn.textContent = "Salvar candidato";
        setStatus(
          "Sem dados estruturados (Voyager não retornou Profile/Position/Education). Role a página inteira, aguarde 3-5s e clique em Re-detectar. Para gravar mesmo assim parcial, clique em Salvar novamente.",
          true,
        );
        return;
      }
      if (!ssrOk && !anchorsOk && richCount === 0 && !allowPartialOnce) {
        allowPartialOnce = true;
        btn.disabled = false;
        btn.textContent = "Salvar candidato";
        setStatus(
          "Perfil sem dados estruturados (LinkedIn não hidratou as seções). Role a página até o fim, aguarde 3-5s e clique em Re-detectar. Para gravar mesmo assim, clique em Salvar de novo.",
          true,
        );
        return;
      }
      if (!isComplete(latestProfile) && !allowPartialOnce) {
        allowPartialOnce = true;
        btn.disabled = false;
        btn.textContent = "Salvar candidato";
        const missing = missingFields(latestProfile).filter((field) => field !== "nome");
        setStatus(
          `Perfil incompleto (${missing.join(", ") || "detalhes"}). Clique em Re-detectar ou clique em Salvar novamente para gravar parcial.`,
          true,
        );
        return;
      }
      // Sanity final: nunca deixa "about lixo" sair pro backend.
      if (looksLikeJunkAbout(latestProfile?.about)) {
        latestProfile.about = null;
        latestProfile.__about_source = latestProfile.__about_source || "discarded_pre_send";
      }
      // Limpa marcadores internos
      delete latestProfile.__about_source;
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
      sendRuntimeMessage(
        { type: "RENDER_TEMPLATE", payload: { templateId, profile: latestProfile } },
        (resp) => {
          if (resp?.ok) {
            document.getElementById("thh-message").value = resp.data?.body || "";
            updateCounter?.();
          }
        },
      );
    }

    // ──────────────────────────────────────────────────────────────
    // Envio assistido via window.__thhMessenger (v0.3.0)
    // ──────────────────────────────────────────────────────────────

    const LIMITS = window.__thhMessenger?.LIMITS || {
      connect: 300,
      direct: 1900,
      inmail_body: 1900,
    };
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
      _ssrCache = null;
      _ssrExtraItems = [];
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
