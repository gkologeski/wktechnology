
# Hunting LinkedIn — extensão Chrome + área /hunting no TechHire

Permitir que a recrutadora navegue normalmente no LinkedIn (logada com a conta dela) e, com uma extensão oficial TechHire injetada na página, capture candidatos um-a-um para dentro do ATS: cria/dedupe candidato, vincula a vaga, adiciona a Talent Pool, gera template de mensagem copiável, e dispara entrevista (link de self-schedule ou agendamento manual).

Nada de iframe do LinkedIn dentro do TechHire (bloqueado por X-Frame-Options). Nada de scraping automatizado server-side (viola ToS, risco de ban). A captura é sempre **acionada pela recrutadora**, sobre a página que ela já está vendo — padrão Gem/hireEZ.

---

## Entregas

### 1. Extensão Chrome/Edge (Manifest V3)
Pasta `extension/` no repo, empacotada em `public/techhire-hunter.zip`.

- **Content script** injetado em `linkedin.com/in/*`, `linkedin.com/sales/lead/*` e páginas de busca (`linkedin.com/search/results/people/*`):
  - Sidebar flutuante (toggle no canto) com branding TechHire.
  - Lê do DOM do perfil aberto: nome, headline, localização, empresa atual, cargo atual, URL canônica do perfil, foto (URL pública), about (quando visível). Em páginas de busca, lista os resultados visíveis com checkbox para captura em lote leve (1 click = 1 candidato — sem varredura automática).
  - **Não lê** dados privados (mensagens, conexões, email/telefone ocultos).
- **Popup da extensão**: login com a conta TechHire (OAuth via mesma sessão Supabase do app — token salvo em `chrome.storage.local`), seleção de workspace ativo.
- **Ações da sidebar** (todas chamam server functions do TechHire):
  - Salvar candidato (dedupe por `linkedin_url`).
  - Vincular a uma vaga ativa (dropdown busca em `ats_jobs` status=open).
  - Adicionar a uma Talent Pool (dropdown busca em `ats_talent_pools`).
  - Inscrever em sequência de sourcing (lista `ats_sourcing_sequences`; aviso quando candidato sem email — sequência email-only fica desabilitada).
  - Copiar template de mensagem (renderiza variáveis `{{nome}}`, `{{vaga}}`, `{{empresa_atual}}` e copia para clipboard pronto pra colar no chat do LinkedIn).
  - Marcar "Mensagem enviada" → cria atividade `type=outreach` na timeline do candidato.

### 2. Área `/hunting` no TechHire (Quiet Premium)
Hub web para acompanhar o que a extensão captura.

- `/hunting` — overview tipo `/sourcing/index.tsx`: tiles para Sessão atual, Capturados hoje, Templates, Instalar extensão.
- `/hunting/captures` — lista (DataTable) dos candidatos capturados via extensão com filtros (vaga, pool, status do outreach, data). Reaproveita `ats_candidates` + novo flag `source='linkedin_hunter'`.
- `/hunting/templates` — CRUD de templates de mensagem inicial (LinkedIn InMail / conexão). Reaproveita visual de `/stage-emails`.
- `/hunting/install` — página com botão "Baixar extensão" (fetch+blob), instruções passo-a-passo de "Load unpacked", screenshots.
- Item "Hunting" no sidebar ATS, grupo "Sourcing", abaixo de Inbox.

### 3. Backend — server functions e schema

**Migration nova:**
- `ats_hunting_templates` (workspace_id, name, channel `linkedin_inmail|linkedin_connect|linkedin_message`, subject, body, variables jsonb, created_by, created_at, updated_at). RLS workspace-escopado + GRANT padrão.
- `ats_hunting_captures` (id, workspace_id, owner_id, candidate_id FK, source_url, raw_payload jsonb com snapshot do DOM extraído, session_id, captured_at). Append-only audit do que a extensão mandou. RLS workspace + GRANT.
- Em `ats_candidates`: aproveitar coluna `source` existente (não cria nova) usando valor `linkedin_hunter`. Garantir índice único parcial em `(workspace_id, lower(linkedin_url)) WHERE linkedin_url IS NOT NULL` se ainda não existir, para dedupe.

**Server functions novas em `src/lib/ats/hunting.functions.ts`:**
- `captureCandidate({ linkedin_url, full_name, headline, location, current_company, current_role, avatar_url, about, source_url, raw_payload })` — upsert em `ats_candidates` por `linkedin_url`, grava `ats_hunting_captures`, retorna `candidate_id` + flag `created|updated`.
- `linkCaptureToJob({ candidate_id, job_id, stage_id? })` — cria `ats_applications` (reaproveita lógica existente).
- `addCaptureToPool({ candidate_id, pool_id })` — reaproveita lógica de `talent-pools.functions.ts`.
- `enrollCaptureInSequence({ candidate_id, sequence_id })` — reaproveita `sourcing-sequences.functions.ts`.
- `listHuntingTemplates`, `upsertHuntingTemplate`, `deleteHuntingTemplate`.
- `renderHuntingTemplate({ template_id, candidate_id, job_id? })` — substitui variáveis server-side, retorna string pronta.
- `logOutreachSent({ candidate_id, template_id?, channel, body })` — cria `activities` type=outreach na timeline do candidato.

Todas com `requireSupabaseAuth`. Token bearer da extensão atacha via header `Authorization: Bearer <access_token Supabase>` — reaproveita middleware existente.

### 4. Autenticação da extensão
- Popup abre `https://ats.wktechnology.com.br/auth/extension-link` (rota nova, pública por design mas dentro do `_authenticated` — usa página intermediária que, uma vez logado, exibe um botão "Autorizar extensão" que envia `supabase.auth.getSession()` via `window.postMessage` para a aba popup, ou via fluxo de copy-paste de token curto). Token salvo em `chrome.storage.local`.
- Refresh: extensão usa `refresh_token` do Supabase para renovar, igual ao client web.

### 5. Agendamento de entrevista
- Botão "Agendar" na sidebar e em `/hunting/captures` abre duas opções:
  - **Self-schedule**: copia link `/schedule/$token` já existente, pronto pra colar no LinkedIn.
  - **Manual**: abre o `schedule-interview-dialog.tsx` já existente, pré-preenchido com o candidato.

---

## Detalhes técnicos

**Estrutura da extensão (`extension/`):**
```
manifest.json
background.js          // service worker: orquestra auth, refresh de token
content-script.js      // injeta sidebar em linkedin.com/in/*
sidebar.css            // estilos isolados (shadow DOM pra não conflitar)
popup.html / popup.js  // login, escolha de workspace
icons/                 // 16/48/128
lib/api.js             // wrapper fetch para TechHire (Authorization: Bearer)
lib/parser.js          // extrai dados do DOM do LinkedIn (seletores resilientes com fallback)
```

`manifest.json` com `host_permissions: ["https://*.linkedin.com/*"]`, `permissions: ["storage", "activeTab", "scripting"]`, `content_scripts` para `linkedin.com/in/*`. CSP padrão MV3 (sem `eval`, sem inline scripts).

**Parser LinkedIn** — seletores hierárquicos por `data-*` quando disponível, fallback por estrutura semântica (h1 do perfil, section "experience" etc). Inclui camada de degradação: se um campo não existir, manda `null` em vez de quebrar. LinkedIn muda DOM com frequência — versionar `parser.js` e expor `parser_version` no `raw_payload` pra debugar capturas antigas.

**Empacotamento:** script bash em `scripts/build-extension.sh` que roda `nix run nixpkgs#zip -- -r public/techhire-hunter.zip extension/`. Rodado manualmente quando atualizar a extensão (não no build do app).

**Download via fetch+blob** na página `/hunting/install` (não usar `<a download>` direto por causa do preview Lovable).

**LGPD/Compliance**:
- `raw_payload` em `ats_hunting_captures` armazena snapshot dos campos públicos do perfil — usar como auditoria, não exibir cru na UI. Mesma base legal de "interesse legítimo recrutamento" que já cobre o restante do ATS.
- Footer da sidebar da extensão: "TechHire só captura dados públicos visíveis a você. Dados privados (mensagens, conexões) nunca são lidos."
- Não persistir cookies do LinkedIn no servidor. Nunca enviar a sessão LinkedIn da recrutadora.

**Não escopo desta entrega** (pendências documentadas para próximas ondas):
- Captura em lote de toda uma página de busca sem 1-click por candidato (risco ToS — fica como pendência manual).
- Descoberta de email/telefone via enrichment (Lusha/Hunter/Apollo) — adapter pattern depois.
- Suporte a Recruiter / Sales Navigator avançado (DOM mais complexo — fase 2).
- Bookmarklet alternativo para Safari/Firefox (extensão é Chromium-only por enquanto).
- Publicação na Chrome Web Store (instalação fica como "Load unpacked" / unpacked dev).

---

## Ordem de implementação (uma fase por vez, com revisão entre cada)

1. **Schema + server functions** (`hunting.functions.ts`, migration, RLS, GRANTs). Validar com typecheck.
2. **Área `/hunting` no TechHire** (overview, captures, templates, install) — Quiet Premium, componentes oficiais, sidebar atualizado.
3. **Extensão MV3** (manifest, content-script com sidebar, popup, parser, api). Empacotar zip em `public/`.
4. **Fluxo de auth da extensão** (rota `/auth/extension-link`, armazenamento de token, refresh).
5. **Validação manual** (instruções de teste passo-a-passo no relatório final).

Cada fase termina com: revisão de diff, typecheck, lint, listagem de arquivos alterados, riscos, pendências.

---

## Riscos conhecidos

- **LinkedIn pode alterar DOM** quebrando o parser — mitigado com seletores resilientes + `parser_version` no payload + fácil hotfix da extensão.
- **LinkedIn pode banir contas que automatizam ações** — mitigado mantendo TUDO acionado por clique humano da recrutadora; sem polling, sem ações em massa, sem auto-scroll.
- **Chrome Web Store review** — não no escopo agora; entrega como "unpacked".
- **Token Supabase da recrutadora vive no `chrome.storage.local`** — mesmo nível de risco do localStorage do app. Documentar.

Após aprovação eu sigo na ordem acima, fase por fase, com revisão e relatório no final de cada.
