
## Problema

Na sidebar da extensão aparece "(sem nome detectado)" mesmo com o perfil de Rafaela Correa visível. Causas prováveis no `extension/content.js` atual:

1. **Seletores defasados** — usa `h1.text-heading-xlarge`, `.text-body-medium.break-words` e `.text-body-small.inline.t-black--light.break-words`. O LinkedIn troca classes utilitárias com frequência e em muitos layouts esses nós não existem mais.
2. **Extração roda uma única vez** — `extractProfile()` é chamado dentro de `injectSidebar()` no `setTimeout` de 1.2s. Em perfis pesados o bloco principal ainda não montou, e não há retry/observer.
3. **Sem fallback** — se o seletor primário falha, o campo fica vazio (sem cair pra `<title>`, og tags, JSON-LD ou texto da seção principal).
4. **Empresa atual** — depende de `section#experience` ou `aria-label*="Experiênc"`, que hoje raramente bate.

## Escopo

Apenas `extension/content.js` (lógica de extração e ciclo de injeção) e re-empacotamento do zip em `public/techhire-hunter.zip`. Sem mudanças em UI da app, backend, RLS, server functions, schema, permissões, regras de negócio ou nas APIs públicas `/api/public/hunting/*`. Mantém o contrato de payload enviado ao `background.js` (`linkedin_url`, `full_name`, `current_position`, `current_company`, `location`, `source`).

## Mudanças

### 1. `extractProfile()` com fallbacks em camadas

Cada campo tenta múltiplas fontes na ordem; primeiro não-vazio vence.

- **full_name**:
  1. `main h1` (qualquer classe);
  2. `document.title` removendo sufixos `" | LinkedIn"`, `" - LinkedIn"`, `"(número) "`;
  3. `meta[property="og:title"]`;
  4. JSON-LD `application/ld+json` → primeiro objeto com `@type` "Person" → `name`.
- **current_position (headline)**:
  1. nó irmão do `h1` dentro do mesmo bloco que contenha `.text-body-medium`;
  2. `meta[property="og:description"]` (primeira linha antes de " | ");
  3. JSON-LD `Person.jobTitle`.
- **current_company**:
  1. JSON-LD `Person.worksFor[0].name`;
  2. primeiro link `a[href*="/company/"]` dentro do bloco principal cujo texto não esteja vazio;
  3. heurística: segunda parte da headline após " at " / " na " / " @ ".
- **location**:
  1. JSON-LD `Person.address` (string ou `addressLocality`);
  2. primeiro nó com `class*="text-body-small"` que esteja após o `h1` no mesmo card.
- **linkedin_url**: mantém `location.href.split("?")[0]`, mas normaliza trailing slash.

Toda extração usa `try/catch` por campo — falha de um campo nunca derruba os demais. Strings são trim + collapse de whitespace.

### 2. Ciclo de injeção resiliente

- Substituir o `setTimeout(injectSidebar, 1200)` único por uma rotina que:
  - aguarda `document.readyState === "complete"`;
  - tenta extrair; se `full_name` vazio, agenda nova tentativa via `MutationObserver` no `main` (ou `body` como fallback) com debounce de 300ms;
  - reextrai e atualiza o preview da sidebar em tempo real até obter `full_name` ou estourar 10s;
  - desconecta o observer depois.
- Re-extrair também no SPA-nav atual (já existe o `setInterval` que detecta `location.href`); manter, mas após remover/reinjetar disparar a mesma rotina com observer.

### 3. Atualização incremental do preview

Extrair render do bloco preview para função `renderPreview(profile)` chamada em cada nova tentativa. Quando ainda não há dados, mostrar "Detectando perfil…" em vez de "(sem nome detectado)".

### 4. Re-empacotar a extensão

- Bump de versão em `extension/manifest.json` para `0.2.2`.
- Regerar `public/techhire-hunter.zip` via nix zip (mesmo comando já usado no projeto).
- `PairingStatusPanel` continua funcionando — não mexemos no `status-bridge.js` nem no `pair-bridge.js`.

## Não faz parte (pendências)

- Não tenta scraping de seções completas (Experiência detalhada, Educação, Skills) — escopo é apenas destravar a detecção básica.
- Não altera `background.js`, popup, API pública nem schema de `ats_hunting_captures`.
- LinkedIn Recruiter / Sales Navigator (`/sales/lead/*`) seguem com os mesmos seletores best-effort; melhorias específicas ficam para próxima iteração se necessário.

## Validação manual

1. Recarregar extensão em `chrome://extensions` (Atualizar) ou reinstalar o zip novo.
2. Abrir um perfil `linkedin.com/in/...`; sidebar deve mostrar nome, headline, empresa e localização preenchidos em até 2-3s.
3. Navegar para outro perfil sem reload (SPA); sidebar reextrai.
4. Em `/hunting/install`, status de pareamento permanece "Pareada".

## Próximo passo recomendado (sem implementar)

Coletar amostras de perfis onde algum campo continua vazio para evoluir os seletores; opcionalmente expor um modo debug que logue qual fonte (DOM/JSON-LD/og) preencheu cada campo.
