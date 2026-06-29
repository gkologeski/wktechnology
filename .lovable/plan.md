# Expansão da Captura da Extensão LinkedIn Hunter

Hoje a extensão captura apenas 6 campos básicos (nome, cargo, empresa, localização, URL, source). Vou expandir para coletar perfil profissional completo, sinais de recrutamento, contatos, dados da empresa e atividade — respeitando LGPD/TOS (só dados visíveis ao recrutador autenticado, sem scraping em massa).

## 1. Banco de dados (migration)

Adicionar colunas à tabela `ats_candidates` (todas nullable, aditivas — sem impacto em código existente):

**Perfil profissional**

- `headline` (text), `about` (text), `photo_url` (text)
- `experiences` (jsonb) — `[{company, title, start, end, description, location}]`
- `education` (jsonb) — `[{school, degree, field, start, end}]`
- `certifications` (jsonb), `languages` (jsonb), `skills` (jsonb)
- `projects` (jsonb), `publications` (jsonb), `volunteering` (jsonb)

**Sinais de recrutamento**

- `open_to_work` (bool), `connection_degree` (text: `1st|2nd|3rd|out`)
- `available_actions` (jsonb) — `{message, connect, inmail}`

**Contatos/links**

- `external_links` (jsonb) — `{github, portfolio, twitter, website, ...}`
- (email/phone já existem)

**Empresa atual**

- `current_company_data` (jsonb) — `{size, industry, location, tenure_months}`

**Atividade**

- `recent_activity` (jsonb) — `[{type: post|comment, url, excerpt, posted_at}]` (últimos 5)
- `recommendations` (jsonb) — `[{author, relationship, text}]`

**Metadados de captura**

- `captured_at` (timestamptz), `capture_version` (text)

Sem alteração em RLS/policies/grants — a tabela já está protegida por workspace.

## 2. Extensão Chrome (`extension/`)

`**content.js` / scraper LinkedIn** — adicionar extratores para cada bloco do perfil:

- Headline, About, foto (já no DOM do `/in/`)
- Experiências/Educação/Skills/Languages/Certifications — iterar nas seções `section[data-section]`
- `#OpenToWork` — detectar badge/overlay na foto
- Grau de conexão — span `.dist-value`
- Botões disponíveis — presença de "Message", "Connect", "InMail"
- Empresa atual: navegar (opcional) ou ler dados visíveis do hovercard
- Atividade recente: ler até 5 itens da seção "Activity"
- Recomendações: ler bloco "Recommendations received"

Cada extrator isolado e tolerante a falhas (try/catch + fallback `null`) — LinkedIn muda DOM com frequência.

`**popup.html` / `popup.js**` — mostrar preview dos dados capturados antes de enviar (checkboxes para o recrutador escolher o que persistir).

`**manifest.json**` — sem novas permissões (já tem acesso a `linkedin.com/*`).

## 3. Endpoint de captura

`src/routes/api/public/hunting/capture.ts` (já existe) — estender Zod schema para aceitar os novos campos opcionais e gravar em `ats_candidates` via upsert por `linkedin_url`. Manter deduplicação atual. Bump `capture_version` para `"2.0"`.

## 4. UI TechHire (visualização)

Estender o painel lateral/3-col do candidato em `/candidates/$id` para renderizar as novas seções quando presentes:

- Bloco "Sobre" (about + headline)
- Timeline de Experiências e Educação
- Chips de Skills/Languages/Certifications
- Badge `OpenToWork` no header
- Bloco "Atividade recente" (links para posts)
- Bloco "Links externos"

Usa componentes oficiais (`SectionHeader`, `StatusBadge`, etc.) — sem novos paradigmas visuais.

## 5. Empacotar nova versão

Rebuild do zip em `public/techhire-hunter.zip` e bump da versão no `manifest.json` para `1.1.0`.

## Conformidade

- Só dados visíveis na sessão autenticada do recrutador (sem APIs internas do LinkedIn).
- Sem captura em massa — extensão age só na aba ativa quando o recrutador clica.
- Banner no popup: "Você é responsável pelo uso conforme LGPD e Termos do LinkedIn."
- Campos sensíveis (idade, etnia, religião, saúde) **não** são capturados.

## Não incluído (fora do escopo)

- Envio automatizado de mensagens (mantém comportamento atual: abre composer pré-preenchido).
- Enriquecimento via APIs pagas (Apollo, RocketReach).
- Re-scrape periódico — captura permanece manual por perfil.

## Validação manual

1. Recarregar a extensão (`chrome://extensions` → reload).
2. Abrir um perfil `/in/...` no LinkedIn.
3. Conferir preview no popup com os novos blocos.
4. Capturar e abrir o candidato em `/candidates/$id` — verificar render das novas seções.