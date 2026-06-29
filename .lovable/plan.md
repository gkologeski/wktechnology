## Diagnóstico

**Problema 1 — bmsoares / filipekuhnen sem Experiência, Educação e Skills**

A v1.0.3 introduziu `extractListItemsFromCodeJson` para ler o JSON SSR das páginas `/details/<section>/`. Na prática, quando o content script faz `fetch('/in/<slug>/details/experience/')`, o LinkedIn devolve apenas o **shell SPA** — o HTML não traz `<li>` renderizado **nem** o `included[]` da seção. Os dados reais chegam só depois, via XHR para `/voyager-api/` autenticado por CSRF token + cookies — algo que a extensão não consegue replicar.

Resultado: o DOMParser vê 0 itens, o fallback JSON também vê 0, e a seção fica vazia. Não é o `$type` regex; é que o payload simplesmente não existe na resposta HTML.

Porém, a página principal (`/in/<slug>/`) já vem com **todo o `included[]` embutido em `<code id="bpr-guid-*">`** no SSR inicial — é dali que o próprio LinkedIn hidrata a UI. Hoje só lemos esse JSON dentro de `enrichProfileFromDetails` (depois do fetch), não no documento corrente.

**Problema 2 — daniela-santana: "faltam cargo/headline"**

`extractHeadline` depende de seletores DOM (`.text-body-medium.break-words`, etc.) e cai para `og:description`/`meta[name=description]`. Em perfis novos ou layouts A/B, o LinkedIn às vezes não popula `og:description` antes do hidrate e o `.text-body-medium` aparece dentro de um wrapper inesperado. Sem fallback no JSON SSR (mesmo `included[]`), o headline não é detectado e o `isComplete()` falha → toast "Ainda faltam: cargo/headline".

A solução para ambos é a mesma: **parsear o JSON SSR `included[]` do próprio `document` atual**, usando-o como fonte primária para headline, empresa, localização, experiências, educação e skills. O DOM continua como fallback.

## Escopo

Apenas dois arquivos:

1. `extension/content.js` — adicionar leitor robusto do `included[]` no `document`, com mappers específicos por `$type`, e plugá-lo em `extractHeadline`, `extractCompany`, `extractLocation`, e `extractExperiences/Education/Skills/Certifications/Languages` como **fonte primária**.
2. `extension/manifest.json` — bump `1.0.3` → `1.0.4`.
3. Repackage `public/techhire-hunter.zip`.

Sem mudança em `capture.ts`, sem mudança em RLS/schema/server functions/UI do app.

## Plano técnico

### 1. Novo módulo: leitor unificado do SSR `included[]`

Adicionar em `content.js`:

```js
function collectIncludedFromDoc(doc = document) {
  const items = [];
  const codes = doc.querySelectorAll('code[id^="bpr-guid"], code[style*="display:none"]');
  for (const c of codes) {
    const raw = (c.textContent || "").trim();
    if (!raw.startsWith("{") || raw.length < 50) continue;
    try {
      const json = JSON.parse(raw);
      if (Array.isArray(json?.included)) items.push(...json.included);
    } catch { /* ignore */ }
  }
  return items;
}
```

Cache na captura para evitar reparsing.

### 2. Mappers por `$type` (regex amplas, tolerantes a versão dash/voyager)

```js
const TYPE_MATCHERS = {
  position:      /\.Position$/,
  education:     /\.Education$/,
  skill:         /\.Skill$/,
  certification: /\.Certification$/,
  language:      /\.Language$/,
  topCard:       /\.ProfileTopCard|MiniProfile|\.Profile$/,
};
```

Mappers extraem `title/companyName/locationName/dateRange/description/schoolName/degreeName/fieldOfStudy/name/proficiency` direto dos campos do voyager, sem depender de DOM.

### 3. Plugar no `extractProfile`

- `extractHeadline`: ANTES dos seletores DOM, procurar em `included[]` algo com `$type` casando `ProfileTopCard|Profile` e ler `headline` / `occupation` / `subline`.
- `extractCompany` / `extractLocation`: idem, lendo `companyName`/`location.basicLocation.countryCode + city`.
- `extractExperiences` / `Education` / `Skills` / `Certifications` / `Languages`: **fonte primária** = mappers do `included[]`; DOM e enrichment via `/details/*` viram fallback caso o `included[]` tenha 0 itens daquele tipo.

### 4. Manter o enrichment via `/details/*` apenas como fallback

Em `enrichProfileFromDetails`, só executar para campos que continuaram vazios após `extractProfile`. Mesmo comportamento atual, mas agora raramente disparará.

### 5. Reforçar headline com `og:title`

`og:title` no LinkedIn vem como `Nome - Cargo | LinkedIn` em vários layouts. Adicionar parser que extrai a parte após ` - ` e antes de ` | LinkedIn` como fallback final, antes de reportar "faltam cargo/headline".

### 6. Lazy-load adaptativo já existe (v1.0.3), manter.

### 7. Versão e empacotamento

- `manifest.json` → `1.0.4`.
- `capture_version` → `2.3`.
- Repackage:
  ```bash
  rm -f public/techhire-hunter.zip
  cd extension && nix run nixpkgs#zip -- -r ../public/techhire-hunter.zip .
  ```

### 8. Validação manual

1. Recarregar extensão em `chrome://extensions` (deve mostrar **1.0.4**).
2. Recapturar `bmsoares` → Experiência, Educação e Skills preenchidos no `/candidates/<id>`.
3. Recapturar `filipekuhnen` → idem.
4. Capturar `daniela-santana-4a9658236` → headline detectado, sem toast vermelho; ao salvar, demais blocos preenchidos.
5. Regressão: recapturar `wendelmarcosdossantos` para garantir que continua completo.

## Fora do escopo

- `capture.ts` (já tolera truncagem desde v1.0.3).
- Schema do banco, RLS, server functions internas, UI do app.
- Outras rotas de hunting (`bulk-capture`, `enrich`).

## Risco

- A estrutura do `included[]` do voyager pode mudar; mantemos DOM + `/details/*` como fallback, então o pior caso é voltar ao comportamento atual.
- Sem alteração de auth/RLS/schema.

## Relatório final (pós-build)

Resumo, arquivos alterados (`content.js`, `manifest.json`, `techhire-hunter.zip`), validação manual com os 3 perfis citados, riscos remanescentes e próximo passo recomendado (telemetria opcional de quantos perfis ainda dependem do fallback DOM).
