// TechHire Hunter — Messenger (v0.3.0)
// Pré-preenche o composer do LinkedIn (mensagem direta / convite com nota / InMail).
// NUNCA clica em "Enviar". O recrutador confirma manualmente; o envio é detectado
// via MutationObserver para registrar atividade na timeline.
//
// Exporta window.__thhMessenger = { prepare(mode, { subject, body }) }
// onde mode ∈ "direct" | "connect" | "inmail" | "auto".

(function () {
  if (window.__thhMessengerInjected) return;
  window.__thhMessengerInjected = true;

  const LIMITS = {
    connect: 300, // nota do convite
    direct: 1900, // mensagem direta
    inmail_subject: 200,
    inmail_body: 1900,
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
  const norm = (s) => clean(s).toLowerCase();

  async function waitFor(predicate, { timeout = 8000, interval = 150 } = {}) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const value = predicate();
        if (value) return value;
      } catch {
        /* ignore */
      }
      await sleep(interval);
    }
    return null;
  }

  function findByAriaLabel(root, regex) {
    const nodes = root.querySelectorAll("[aria-label]");
    for (const el of nodes) {
      if (regex.test(el.getAttribute("aria-label") || "")) return el;
    }
    return null;
  }

  function findButtonByText(root, regex) {
    const buttons = root.querySelectorAll("button, a[role='button']");
    for (const el of buttons) {
      if (regex.test(clean(el.textContent))) return el;
    }
    return null;
  }

  // ──────────────────────────────────────────────────────────────────
  // Detecção de contexto: o que dá pra fazer neste perfil?
  // ──────────────────────────────────────────────────────────────────

  function detectMode() {
    const main = document.querySelector("main") || document.body;

    const messageBtn = findByAriaLabel(main, /^(mensagem|message)( |\b)/i);
    const inmailBtn = findByAriaLabel(main, /inmail/i);
    const connectBtn =
      findByAriaLabel(main, /^(conectar|connect)$/i) ||
      findButtonByText(main, /^(conectar|connect)$/i);

    // O botão Mais costuma esconder "Conectar" e "InMail" nos perfis com muitos botões
    const moreBtn = findByAriaLabel(main, /^(mais a[çc][õo]es|more actions|mais)$/i);

    return {
      canDirect: Boolean(messageBtn),
      canInMail: Boolean(inmailBtn),
      canConnect: Boolean(connectBtn) || Boolean(moreBtn),
      messageBtn,
      inmailBtn,
      connectBtn,
      moreBtn,
    };
  }

  function pickAuto(ctx) {
    if (ctx.canDirect) return "direct";
    if (ctx.canConnect) return "connect";
    if (ctx.canInMail) return "inmail";
    return null;
  }

  // ──────────────────────────────────────────────────────────────────
  // Inserção em contenteditable / textarea respeitando React/Quill
  // ──────────────────────────────────────────────────────────────────

  function setNativeValue(el, value) {
    const proto = Object.getPrototypeOf(el);
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
  }

  function fillTextarea(el, text) {
    el.focus();
    setNativeValue(el, text);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function fillContentEditable(el, text) {
    el.focus();
    // Limpa
    el.innerHTML = "";
    // Insere parágrafo (LinkedIn usa Quill-like)
    const p = document.createElement("p");
    p.textContent = text;
    el.appendChild(p);
    el.dispatchEvent(
      new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }),
    );
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function fill(el, text) {
    if (!el) return false;
    const tag = (el.tagName || "").toLowerCase();
    if (tag === "textarea" || tag === "input") fillTextarea(el, text);
    else fillContentEditable(el, text);
    return true;
  }

  function truncate(text, max) {
    const t = clean(text);
    if (t.length <= max) return { text: t, truncated: false };
    return { text: t.slice(0, max - 1) + "…", truncated: true };
  }

  // ──────────────────────────────────────────────────────────────────
  // Modos
  // ──────────────────────────────────────────────────────────────────

  async function prepareDirect(text) {
    const ctx = detectMode();
    if (!ctx.messageBtn) throw new Error("Botão Mensagem não encontrado neste perfil.");
    const { text: clipped, truncated } = truncate(text, LIMITS.direct);
    ctx.messageBtn.click();

    const editor = await waitFor(() => {
      const candidates = document.querySelectorAll(
        '.msg-overlay-conversation-bubble div[role="textbox"][contenteditable="true"], .msg-form__contenteditable[contenteditable="true"]',
      );
      for (const el of candidates) {
        if (el.offsetParent !== null) return el;
      }
      return null;
    });
    if (!editor) throw new Error("Composer de mensagem não abriu.");
    fill(editor, clipped);

    return {
      ok: true,
      mode: "direct",
      channel: "linkedin_message",
      truncated,
      final_length: clipped.length,
      editor,
    };
  }

  async function prepareConnect(text) {
    const ctx = detectMode();
    const { text: clipped, truncated } = truncate(text, LIMITS.connect);

    let clicked = false;
    if (ctx.connectBtn && ctx.connectBtn.offsetParent !== null) {
      ctx.connectBtn.click();
      clicked = true;
    } else if (ctx.moreBtn) {
      ctx.moreBtn.click();
      await sleep(250);
      const menuItem = await waitFor(
        () => {
          const items = document.querySelectorAll(
            '[role="menu"] [role="menuitem"], .artdeco-dropdown__content [role="button"]',
          );
          for (const el of items) {
            if (/^(conectar|connect)$/i.test(clean(el.textContent))) return el;
          }
          return null;
        },
        { timeout: 4000 },
      );
      if (!menuItem) throw new Error("Opção Conectar não encontrada no menu Mais.");
      menuItem.click();
      clicked = true;
    }
    if (!clicked) throw new Error("Botão Conectar não disponível neste perfil.");

    // Modal "Adicionar nota"
    const addNoteBtn = await waitFor(() =>
      findByAriaLabel(document, /(adicionar uma nota|add a note)/i),
    );
    if (addNoteBtn) addNoteBtn.click();

    const noteEl = await waitFor(() =>
      document.querySelector('textarea[name="message"], #custom-message'),
    );
    if (!noteEl) throw new Error("Campo de nota do convite não apareceu.");
    fillTextarea(noteEl, clipped);

    return {
      ok: true,
      mode: "connect",
      channel: "linkedin_connect",
      truncated,
      final_length: clipped.length,
      editor: noteEl,
    };
  }

  async function prepareInMail(subject, body) {
    const ctx = detectMode();
    if (!ctx.inmailBtn) throw new Error("InMail não disponível (requer Premium/Recruiter).");
    const { text: subj, truncated: subjT } = truncate(subject || "", LIMITS.inmail_subject);
    const { text: bd, truncated: bdT } = truncate(body || "", LIMITS.inmail_body);
    ctx.inmailBtn.click();

    const subjectInput = await waitFor(() =>
      document.querySelector(
        'input#openmail-subject, input[name="subject"], input[aria-label*="Assunto" i], input[aria-label*="Subject" i]',
      ),
    );
    if (subjectInput && subj) fillTextarea(subjectInput, subj);

    const bodyEl = await waitFor(() =>
      document.querySelector(
        'div[role="textbox"][contenteditable="true"][aria-label*="Mensagem" i], div[role="textbox"][contenteditable="true"][aria-label*="Message" i], textarea[name="body"]',
      ),
    );
    if (!bodyEl) throw new Error("Composer InMail não abriu.");
    fill(bodyEl, bd);

    return {
      ok: true,
      mode: "inmail",
      channel: "linkedin_inmail",
      truncated: subjT || bdT,
      final_length: (subj?.length || 0) + bd.length,
      editor: bodyEl,
    };
  }

  // ──────────────────────────────────────────────────────────────────
  // Detecção de envio
  // ──────────────────────────────────────────────────────────────────

  function watchSend(mode, expectedText, onResolved, { timeoutMs = 5 * 60 * 1000 } = {}) {
    let resolved = false;
    const expected = norm(expectedText).slice(0, 80);
    const observers = [];
    let timeoutHandle = null;

    function finish(result) {
      if (resolved) return;
      resolved = true;
      observers.forEach((o) => o.disconnect());
      if (timeoutHandle) clearTimeout(timeoutHandle);
      onResolved(result);
    }

    // 1. Toasts globais (válido para connect e inmail)
    const toastObserver = new MutationObserver(() => {
      const toasts = document.querySelectorAll(
        '[role="alert"], .artdeco-toast-item__message, .Toastify__toast',
      );
      for (const t of toasts) {
        const text = norm(t.textContent);
        if (!text) continue;
        if (mode === "connect" && /(convite enviado|invitation sent|invite sent)/i.test(text)) {
          return finish({ ok: true, detected: true, evidence: "toast" });
        }
        if (mode === "inmail" && /(inmail enviado|message sent|mensagem enviada)/i.test(text)) {
          return finish({ ok: true, detected: true, evidence: "toast" });
        }
        if (mode === "direct" && /(mensagem enviada|message sent)/i.test(text)) {
          return finish({ ok: true, detected: true, evidence: "toast" });
        }
      }
    });
    toastObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
    observers.push(toastObserver);

    // 2. Para mensagem direta: lista de mensagens da bolha
    if (mode === "direct") {
      const listObserver = new MutationObserver(() => {
        const items = document.querySelectorAll(
          ".msg-overlay-conversation-bubble li.msg-s-message-list__event, .msg-s-message-list__event",
        );
        for (const li of items) {
          const txt = norm(li.textContent);
          if (expected && txt && txt.includes(expected.slice(0, 40))) {
            return finish({ ok: true, detected: true, evidence: "list" });
          }
        }
      });
      listObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
      observers.push(listObserver);
    }

    timeoutHandle = setTimeout(
      () => finish({ ok: false, detected: false, evidence: "timeout" }),
      timeoutMs,
    );

    return () => finish({ ok: false, detected: false, evidence: "cancelled" });
  }

  // ──────────────────────────────────────────────────────────────────
  // API pública
  // ──────────────────────────────────────────────────────────────────

  window.__thhMessenger = {
    detect: detectMode,
    pickAuto,
    LIMITS,
    async prepare(mode, { subject, body } = {}) {
      const actualMode = mode === "auto" ? pickAuto(detectMode()) : mode;
      if (!actualMode) throw new Error("Nenhum canal disponível neste perfil.");
      if (actualMode === "direct") return prepareDirect(body || "");
      if (actualMode === "connect") return prepareConnect(body || "");
      if (actualMode === "inmail") return prepareInMail(subject || "", body || "");
      throw new Error(`Modo desconhecido: ${actualMode}`);
    },
    watchSend,
  };
})();
