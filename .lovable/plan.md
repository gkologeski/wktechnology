# Correção da Captura — Experiências, Educação, Skills e Sinais

## Diagnóstico

Consultei o candidato `b23f4a4a-…` no banco. Os dados confirmam que o problema é **na captura, não no render**:

| Campo                | Estado no DB                                   |
| -------------------- | ---------------------------------------------- |
| `headline`, `about`  | Preenchidos corretamente                       |
| `available_actions`  | Objeto preenchido                              |
| `experiences`        | Array **vazio** (`length = 0`)                 |
| `education`          | Array **vazio**                                |
| `skills_detailed`    | Array **vazio**                                |
| `certifications`     | Array **vazio**                                |
| `photo_url`          | `null`                                         |
| `open_to_work`       | `null` (deveria ser boolean)                   |
| `current_company_data` | `null`                                       |

Os blocos `ExperienceBlock`, `EducationBlock`, `SkillsDetailedBlock` e `SignalsBlock` em `rich-profile-blocks.tsx` já tratam estado vazio com mensagem "Sem … capturadas." — então o que o usuário vê reflete fielmente o banco.

A causa raiz está em `extension/content.js`:

1. `findSectionByTitle` procura `main section` e exige `h2` no topo. O LinkedIn atual envolve as seções em `section.artdeco-card` e o título fica em `div.pvs-header__container h2 span[aria-hidden="true"]`, frequentemente não detectado pela regex.
2. As seções de Experiências/Educação/Skills no perfil principal vêm **truncadas** ("Mostrar todas as N experiências") e os itens completos só existem em `/details/experience`, `/details/education`, `/details/skills`. A extensão não navega para essas páginas nem aguarda a lazy-load.
3. `extractOpenToWork` depende de texto visível — quando o badge `#OpenToWork` está no avatar como overlay/SVG, não é capturado.
4. `extractAvatar` usa seletores antigos (`pv-top-card-profile-picture__image`); o LinkedIn migrou para `img.evi-image.profile-photo-edit__preview` e wrappers `EntityPhoto`.

## Escopo

Apenas `extension/content.js` (extratores) + repackage do ZIP em `public/techhire-hunter.zip`. Sem mexer em backend, API, schema, RLS, render ou tipos.

## Plano técnico

### 1. Robustecer `findSectionByTitle`
- Ampliar o seletor para `main section, main div.artdeco-card`.
- Procurar o título em qualquer descendente: `h2, h2 span[aria-hidden="true"], .pvs-header__container, .pv-profile-card__header`.
- Considerar também a presença de âncoras: `div#experience`, `div#education`, `div#skills`, `div#licenses_and_certifications`, `div#languages`, `div#projects`, `div#publications`, `div#volunteer_experience` — quando achados, retornar o `closest("section")` ou o próximo container irmão.
- Fallback: se a seção for encontrada via âncora, dispensar o regex de título.

### 2. Coletar dados das páginas `/details/*`
Para superar a truncagem do perfil principal:

- Detectar o slug do perfil a partir de `location.pathname` (`/in/<slug>/`).
- Para cada seção que retornar 0 itens na página principal, fazer `fetch` em segundo plano de:
  - `/in/<slug>/details/experience/`
  - `/in/<slug>/details/education/`
  - `/in/<slug>/details/skills/`
  - `/in/<slug>/details/certifications/`
  - `/in/<slug>/details/languages/`
  - `/in/<slug>/details/projects/`
  - `/in/<slug>/details/publications/`
  - `/in/<slug>/details/volunteering/`
- Parsear o HTML retornado com `DOMParser` e rodar `extractListItems` sobre `main`.
- Limitar a 8 requisições paralelas com `Promise.all` e timeout de 8s por request; falhas silenciosas (mantém array vazio).
- Cabeçalho: usa cookies da sessão do usuário (mesma origem `linkedin.com`), o que já funciona dentro do content script.

### 3. Pequena melhoria de scroll/lazy-load
Antes da extração principal, fazer `window.scrollTo(0, document.body.scrollHeight)` seguido de `scrollTo(0,0)` com um `await wait(800ms)` para forçar render das seções lazy. Já evita boa parte dos casos em que o usuário não rolou a página.

### 4. `extractOpenToWork`
- Além do regex no texto, verificar:
  - `document.querySelector('[aria-label*="Open to work"], [aria-label*="aberto a oportunidades"]')`
  - `img[alt*="#OPENTOWORK" i]`
  - Frame SVG do badge: `.pv-top-card-profile-picture__container .pv-open-to-frame, [data-test-id*="OPEN_TO_WORK"]`
- Retornar `true` se qualquer um existir; `false` quando explicitamente não encontrado (em vez de `null`) somente após confirmar que a seção topo carregou.

### 5. `extractAvatar`
- Adicionar seletores novos: `img.evi-image.profile-photo-edit__preview`, `.pv-top-card-profile-picture img`, `button[aria-label*="foto" i] img`, e fallback `meta[property="og:image"]`.

### 6. `current_company_data`
- Quando a 1ª experiência tiver `company` + link, extrair `name`, `linkedin_url` (`a[href*="/company/"]`) e logo (`img` dentro do `<li>`).

### 7. Versão e bump
- `capture_version` → `2.1`.
- `manifest.json` → `1.0.2`.
- Repackagem do ZIP via `nix run nixpkgs#zip` em `public/techhire-hunter.zip`.

### 8. Validação manual
1. Recarregar a extensão (`chrome://extensions` → Recarregar).
2. Abrir `https://www.linkedin.com/in/wendelmarcosdossantos/`.
3. Disparar a captura na sidebar.
4. Verificar no `/candidates/<id>`: Experiências, Educação, Skills, Sinais e foto.
5. Repetir em mais 2 perfis com layouts diferentes (1º grau e 3º grau).

## Fora do escopo

- Mudanças no endpoint `/api/public/hunting/capture.ts` (já tolera arrays/objetos/strings após o fix anterior).
- Render dos blocos (`rich-profile-blocks.tsx`) — está correto, apenas reflete dados vazios.
- Schema do banco e RLS.

## Risco

- O `fetch` para `/in/<slug>/details/*` é feito pelo browser do usuário com a sessão dele — sem violar ToS além do que a captura principal já faz.
- Se o LinkedIn alterar a estrutura das páginas `/details/*`, cada extractor falha de forma isolada e o restante continua funcionando.
