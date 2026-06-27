# Captura completa do LinkedIn + auto-refresh ao voltar para o TechHire

Dois ajustes isolados, sem mexer em RLS, schema, server functions ou regras de negócio.

## 1) Extensão — extrair cargo, empresa e localização (não só nome)

**Sintoma:** o card mostra apenas `full_name`; `current_position`, `current_company`, `location` chegam vazios.

**Causa:** hoje o `startExtractionLoop` para assim que `full_name` é preenchido (linha 159 de `extension/content.js`). Como `full_name` aparece quase imediatamente via `<title>` / `og:title`, o loop encerra antes do LinkedIn hidratar o card do perfil, e os seletores de headline/empresa/local rodam contra um DOM ainda vazio. Além disso os seletores atuais (`.text-body-medium`, `[class*="text-body-small"]`) são frágeis no layout atual do `/in/`.

**Mudanças em `extension/content.js`:**

- Trocar a condição de parada do loop: só considera "resolvido" quando `full_name` **e** pelo menos todos entre `current_position` / `current_company` / `location` estiverem preenchidos — ou ao atingir o timeout. Mantém o `MutationObserver` rodando até lá.
- Reforçar seletores DOM (todos com fallback, em ordem):
  - **Headline:** `main section.artdeco-card .text-body-medium.break-words`, `main section div.text-body-medium`, primeiro `div.text-body-medium` dentro do bloco do `h1`.
  - **Empresa:** `button[aria-label^="Empresa atual"]`, `a[href*="/company/"][aria-label]`, primeiro `a[href*="/company/"]` no card do `h1`, fallback heurístico do headline (`at|na|no|@`).
  - **Localização:** segundo `span.text-body-small.inline.t-black--light` no card do `h1`, depois varredura atual filtrando "seguidores/conexões".
  - **Foto:** `img.pv-top-card-profile-picture__image`, `main img[width="200"]` → enviar como `avatar_url` (campo novo, opcional).
- Manter `og:image` como fallback de avatar.
- Atualizar o preview da sidebar em tempo real (já faz) e exibir um aviso quando algum campo continuar vazio após o timeout.
- Bump `version` para `0.2.3` em `extension/manifest.json` e regerar `public/techhire-hunter.zip`.

> Observação: o endpoint `/api/public/hunting/capture.ts` já aceita `current_position`, `current_company`, `location` (Zod opcionais) e faz upsert por `linkedin_url`. Não precisa de migration nem mudança de RLS. `avatar_url` só será incluído no payload se a coluna existir — caso contrário fica como melhoria futura e o `Zod` o ignora.

## 2) `/candidates` — atualizar automaticamente ao voltar para o TechHire

**Sintoma:** após capturar pela extensão, o usuário volta para `/candidates` e a lista não mostra os novos perfis até dar F5.

**Causa:** `src/routes/_authenticated/(ats)/candidates.tsx` usa `useState` + `useEffect` para carregar a lista (linhas 73–117). Não há refetch quando a aba recupera foco nem polling.

**Mudança (frontend apenas):**

- Substituir o estado manual por `useQuery` do TanStack Query, com:
  - `queryKey: ["ats-candidates", search]`
  - `queryFn` chamando `listAtsCandidates({ data: { search } })`
  - `refetchOnWindowFocus: true`
  - `refetchOnMount: "always"`
  - `staleTime: 10_000`
- Após `save`, `delete`, `parseCv` e `parsePdf`, invalidar `["ats-candidates"]` via `queryClient.invalidateQueries`.
- Manter o debounce de busca controlando apenas o estado local `search` (a query refaz sozinha quando a key muda).
- Adicionar também `refetchOnWindowFocus: true` ao `useQuery` de `src/routes/_authenticated/(ats)/hunting/captures.tsx` (já usa `useQuery`; basta o flag) para a tela de capturas se atualizar instantaneamente no retorno.

Sem mudanças em design system, layout, componentes oficiais (`AtsPageHeader`, `FilterBar`, `EmptyState`, `Skeletons`, `MetaPill`) ou em qualquer regra de negócio.

## Arquivos alterados

- `extension/content.js` — loop de extração + seletores
- `extension/manifest.json` — version bump 0.2.3
- `public/techhire-hunter.zip` — repackage
- `src/routes/_authenticated/(ats)/candidates.tsx` — `useQuery` + refetch on focus
- `src/routes/_authenticated/(ats)/hunting/captures.tsx` — `refetchOnWindowFocus`

## Como validar

1. Recarregar a extensão em `chrome://extensions` (0.2.3), abrir um perfil `/in/...` e confirmar que headline, empresa e localização aparecem no preview antes de clicar **Salvar candidato**.
2. Capturar 1–2 perfis, voltar para a aba do TechHire em `/candidates` — a lista deve atualizar sozinha em ≤1s (refetch on focus) com cargo/empresa preenchidos.
3. Repetir em `/hunting/captures` — mesma atualização ao voltar.