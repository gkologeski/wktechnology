## Diagnóstico

**Erro 1 — `about` > 8000 caracteres (bmsoares, filipekuhnen)**
O schema em `src/routes/api/public/hunting/capture.ts` declara `about: z.string().max(8000)`. Quando o LinkedIn entrega um "Sobre" mais longo (resumos extensos são comuns em perfis sêniores), o Zod rejeita o payload inteiro com HTTP 400 e **nada** é gravado — o usuário perde a captura por causa de um único campo.

**Erro 2 — campos vazios (daniela-santana-4a9658236)**
O perfil tem layout completo no LinkedIn, mas chega vazio no banco. Causas prováveis, em ordem:
1. O perfil tem `?locale=pt` ou URL canônica diferente, e o `enrichProfileFromDetails` monta `/in/<slug>/details/...` a partir de `location.pathname` — se houver querystring ou trailing slash, o slug pode sair errado.
2. Headline/cargo no topo do card agora vem dentro de `div.text-body-medium.break-words` sem âncora estável; o extractor atual depende de `h2` ou de classes que mudam.
3. As páginas `/details/experience/` e `/details/education/` exigem cookies de 1ª parte e às vezes retornam HTML com `<code>` JSON embutido (estrutura SSR do LinkedIn) em vez de DOM renderizado — o `DOMParser` atual não lê esse JSON.
4. O `triggerLazyLoad` espera 800ms fixos; em perfis longos isso é insuficiente e a extração roda antes do render.

## Escopo

Dois pontos cirúrgicos, sem mexer em render, schema do banco, RLS ou outros módulos:

1. `src/routes/api/public/hunting/capture.ts` — tolerância no campo `about` (e outros textos longos).
2. `extension/content.js` — robustecer slug, headline/cargo, lazy-load e parser das páginas `/details/*`. Repackage de `public/techhire-hunter.zip` + bump `manifest.json` → `1.0.3`.

Sem alterações em backend além do schema do endpoint público. Sem mudanças em outros endpoints.

## Plano técnico

### 1. Backend — `capture.ts` deixa de rejeitar por tamanho

Trocar `max(8000)` por **truncagem tolerante** nos campos de texto longo, preservando o resto do payload:

- `about`: `z.preprocess((v) => typeof v === "string" ? v.slice(0, 8000) : v, z.string().max(8000).nullable().optional())`
- `headline`: idem com 500.
- `current_position`: idem com 400.
- Aplicar o mesmo padrão em `location` (200) e `current_company` (200) por simetria.

Adicionar no response um campo `warnings: string[]` listando quais campos foram truncados, para o usuário ter feedback (a extensão já mostra `setStatus`). Sem mudança de contrato — `warnings` é aditivo e ignorado por clients antigos.

### 2. Extensão — slug robusto

Em `extractProfile` / `enrichProfileFromDetails`:
- Derivar o slug ignorando querystring, hash e trailing slash:
  ```js
  const m = location.pathname.match(/\/in\/([^/?#]+)/i);
  const slug = m?.[1];
  ```
- Se `slug` ausente, abortar enrichment silenciosamente em vez de gerar URLs malformadas.

### 3. Extensão — headline/cargo no topo

Adicionar fallbacks em `extractHeadline` e `extractCurrentPosition`:
- `main section:first-of-type div.text-body-medium`
- `main section:first-of-type .pv-text-details__left-panel div:nth-child(2)`
- `meta[name="description"]` (a primeira linha geralmente é "Cargo na Empresa · Cidade").
- Para `current_position`/`current_company`, se a 1ª experiência existir, usar `experiences[0].title` e `experiences[0].company` como último fallback.

### 4. Extensão — parser das páginas `/details/*`

O LinkedIn entrega essas páginas com `<code id="...">` contendo JSON SSR. Adicionar em `fetchDetailsHtml`:
- Após `DOMParser`, varrer todos os `<code>` com JSON parseável e, se o DOM principal vier vazio, extrair itens de `included[]` com `$type` em (`com.linkedin.voyager.dash.identity.profile.Position`, `Education`, `Skill`, `Certification`, `Language`).
- Mapear para o formato já consumido pelos blocos: `{ title, company, start_date, end_date, description }` etc.
- Manter fallback DOM atual; só usar JSON se DOM vier com 0 itens.

### 5. Extensão — lazy-load adaptativo

Substituir `await wait(800)` por loop curto:
- até 5 iterações de `scrollTo(bottom) → wait(400) → scrollTo(top) → wait(200)`;
- parar antes se `document.querySelector('#experience')` e `#education` já tiverem `li` filhos.

### 6. Versão e empacotamento

- `extension/manifest.json` → `1.0.3`.
- `capture_version` no payload → `2.2`.
- Repackage: `cd extension && nix run nixpkgs#zip -- -r ../public/techhire-hunter.zip .`

### 7. Validação manual

1. Recarregar extensão (`chrome://extensions` → Recarregar; deve mostrar 1.0.3).
2. Capturar `bmsoares` e `filipekuhnen` → esperado: salvar com sucesso, status mostra "about truncado".
3. Capturar `daniela-santana-4a9658236` → esperado: cargo, experiências, educação, skills preenchidos no `/candidates/<id>`.
4. Recapturar `wendelmarcosdossantos` para garantir não-regressão.

## Fora do escopo

- Render dos blocos em `rich-profile-blocks.tsx` (já funciona quando o dado chega).
- Schema do banco (`ats_candidates.about` é `text`, sem limite).
- Outras rotas de hunting (`bulk-capture`, `enrich`).

## Risco

- Truncagem silenciosa de `about`: mitigado por `warnings[]` retornado ao cliente e exibido no status da sidebar.
- Parser JSON SSR do LinkedIn pode mudar: o fallback é o DOM atual, então a regressão máxima é voltar ao comportamento de hoje.
- Sem alterações em RLS, auth, schema, server functions internas ou outros módulos.

## Relatório final (a entregar após build)

Resumo, arquivos alterados (`capture.ts`, `content.js`, `manifest.json`, `techhire-hunter.zip`), validação manual com os 3 perfis citados, riscos remanescentes e próximo passo recomendado (telemetria opcional de quais campos mais truncam).
