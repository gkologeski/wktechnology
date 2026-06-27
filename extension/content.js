// TechHire Hunter — Content script.
// Injeta sidebar nos perfis do LinkedIn e extrai dados do DOM público
// que o próprio usuário já está vendo (sem scraping em background).

(function () {
  if (window.__techhireHunterInjected) return;
  window.__techhireHunterInjected = true;

  const SIDEBAR_ID = "techhire-hunter-sidebar";

  function text(el) {
    return (el?.textContent || "").trim().replace(/\s+/g, " ");
  }

  function extractProfile() {
    const url = location.href.split("?")[0];
    // Nome
    const name =
      text(document.querySelector("h1.text-heading-xlarge")) ||
      text(document.querySelector("h1"));
    // Headline / cargo atual
    const headline = text(document.querySelector(".text-body-medium.break-words"));
    // Localização
    const location_ =
      text(document.querySelector(".text-body-small.inline.t-black--light.break-words")) ||
      text(document.querySelector('[data-test-id="profile-location"]'));
    // Empresa atual — primeiro item da seção Experience
    let company = "";
    const expSection = document.querySelector('section[data-view-name="profile-card"] [aria-label*="Experiênc" i], section#experience');
    if (expSection) {
      const firstCompany = expSection.querySelector("span[aria-hidden='true']");
      company = text(firstCompany);
    }
    return {
      linkedin_url: url,
      full_name: name,
      current_position: headline,
      current_company: company,
      location: location_,
      source: "linkedin_extension",
    };
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
        <div id="thh-preview" class="thh-preview"></div>
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

    const profile = extractProfile();
    document.getElementById("thh-preview").innerHTML = `
      <div><b>${profile.full_name || "(sem nome detectado)"}</b></div>
      <div class="thh-muted">${profile.current_position || ""}</div>
      <div class="thh-muted">${profile.current_company || ""}</div>
      <div class="thh-muted">${profile.location || ""}</div>`;

    // Estado de pareamento
    chrome.runtime.sendMessage({ type: "PING" }, (resp) => {
      const status = document.getElementById("thh-status");
      if (!resp?.paired) {
        status.innerHTML = `<span class="thh-warn">Extensão não pareada.</span>`;
      } else {
        status.textContent = "Pareada · pronta para capturar.";
        loadTemplates(profile);
      }
    });

    document.getElementById("thh-capture").onclick = async () => {
      const btn = document.getElementById("thh-capture");
      btn.disabled = true;
      btn.textContent = "Salvando…";
      chrome.runtime.sendMessage(
        { type: "CAPTURE_CANDIDATE", payload: profile },
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

    function loadTemplates(profile) {
      chrome.runtime.sendMessage({ type: "LIST_TEMPLATES" }, (resp) => {
        if (!resp?.ok) return;
        const sel = document.getElementById("thh-template");
        for (const t of resp.data?.templates || []) {
          const opt = document.createElement("option");
          opt.value = t.id;
          opt.textContent = `${t.name} (${t.channel})`;
          sel.appendChild(opt);
        }
        sel.onchange = () => renderTemplate(sel.value, profile);
      });
    }

    function renderTemplate(templateId, profile) {
      if (!templateId) return;
      chrome.runtime.sendMessage(
        { type: "RENDER_TEMPLATE", payload: { templateId, profile } },
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
            linkedin_url: profile.linkedin_url,
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

  setTimeout(injectSidebar, 1200);
})();
