
# Plano — Corrigir scraping do TechHire Hunter e adicionar captura em lote a partir de busca

## 1. O que aprendi das referências

**Scrapfly (how-to-scrape-linkedin)** e **luminati-io/LinkedIn-Scraper**
- O HTML público do LinkedIn é ofuscado (classes hash, lazy-load, virtualização). Raspar o DOM "renderizado" gera exatamente o tipo de lixo que estamos vendo no print (linhas misturadas de "Atividade", "Mais perfis", footer).
- A fonte confiável é o **payload SSR embutido** (`<code id="bpr-guid-*">`) que segue o modelo Voyager: `com.linkedin.voyager.dash.identity.profile.Profile`, `...Position`, `...Education`, `...Skill`, `...Certification`, `...Language`, `...Project`, `...Publication`, `...VolunteerExperience`, `...Honor`.
- Para perfis logados, as **rotas `/details/<section>/`** (experience, education, skills, certifications, languages, projects, publications, volunteering, honors, recommendations) retornam HTML com SSR completo da seção — é assim que o Voyager hidrata em produção.
- Headers obrigatórios em fetch interno: `csrf-token` (cookie `JSESSIONID` sem aspas), `x-restli-protocol-version: 2.0.0`, `accept: application/vnd.linkedin.normalized+json+2.1`.

**joeyism/linkedin_scraper**
- Modelo de dados canônico por seção (Experience, Education, Interest, Accomplishment, Contact). Vamos espelhar esse shape no `ats_candidates` para padronizar.
- Estratégia de "abrir cada `/details/...` em background" antes de extrair — exatamente o que falta hoje (hoje só fazemos um fetch best-effort).

**Extensão "Profile Scraper for LinkedIn" (Chrome Store)**
- Fluxo: usuário roda uma busca no LinkedIn → extensão enfileira os resultados → para cada perfil abre aba oculta → espera SSR/hidratação → extrai → fecha. Progresso e resultado salvo ao final.
- Não usa Sales Navigator obrigatoriamente — funciona em `/search/results/people/` e `/in/<slug>`.

## 2. Problemas concretos na nossa extensão hoje

Diagnóstico do `extension/content.js` (2.133 linhas) frente ao print:
1. O `about`/`headline` cai no fallback `innerText` da página inteira quando o SSR não bate de primeira → captura blocos de "Atividade", "Mais perfis", rodapé.
2. `skills`, `education`, `experience` dependem de `extractListItemsFromDetailsText` (regex em texto puro do `/details/...`) — funciona às vezes, mas perdemos campos estruturados (datas, empresa, URL, descrição).
3. Não há varredura por **todas** as âncoras Voyager conhecidas — só algumas. Sem Position/Education/Skill estruturados, caímos no parser de texto.
4. Não temos fila de captura em lote a partir de uma página de busca.
5. `parser_diagnostics` registra falhas mas não bloqueia salvar payload ruim — o guard atual ("rigid data guard" v1.0.9) só checa "existe algum SSR", não "tem Position/Education".

## 3. Nova arquitetura de extração (perfil único)

Pipeline determinístico, em ordem, **sem cair pro innerText**:

```text
1. Coletar TODOS os <code id="bpr-guid-*"> da página + responses já em cache.
2. Indexar por urn (Profile, Position, Education, Skill, Certification,
   Language, Project, Publication, VolunteerExperience, Honor, Recommendation).
3. Buscar /in/<slug>/details/<section>/ em paralelo (experience, education,
   skills, certifications, languages, projects, publications, volunteering,
   honors, recommendations, contact-info) — reaproveitando csrf-token do
   cookie JSESSIONID e headers Voyager.
4. Re-extrair âncoras SSR de cada resposta de /details/.
5. Montar objetos canônicos (shape joeyism):
   - experiences[]: { title, company, company_url, location, start, end,
     duration, description, employment_type }
   - education[]:   { school, school_url, degree, field, start, end,
     activities, description }
   - skills[]:      { name, endorsements, top_skill }
   - certifications[], languages[], projects[], publications[],
     volunteering[], honors[], recommendations[]
6. Top-card a partir do Profile urn + photo (vector image highest res).
7. About = Profile.summary do SSR. NUNCA recortar do innerText.
8. Sinais: openToWork, hiring, premium, connectionDegree, contactInfo
   (quando /details/contact-info estiver acessível).
```

**Guard rígido novo**: só envia ao backend se `experiences.length > 0` OU `education.length > 0` OU `about` veio do SSR. Caso contrário, a sidebar mostra erro com diagnóstico e botão "Re-tentar com auto-scroll".

## 4. Captura em lote a partir de busca → salva direto no TechHire

Nova feature **"Capturar resultados da busca"** (igual à extensão de referência), porém **sem export local — tudo é persistido no TechHire em tempo real**:

- Detectar quando a URL casa `linkedin.com/search/results/people/*` ou `linkedin.com/sales/search/people*`.
- Sidebar ganha aba **Busca** com: total estimado, slider "quantos perfis", campo opcional "Talent pool de destino", campo opcional "Tag da run", botão "Iniciar".
- Coletar slugs `/in/<slug>` por página (paginar via `start=` ou clicar "Próxima" simulando humano).
- Enfileirar em IndexedDB (`hunting_queue`) com status `pending|running|done|error` — apenas controle local de execução, **não é o armazenamento final**.
- Worker no background.js abre uma `chrome.tabs` por vez (com jitter 4-9s), injeta o content script no modo "headless capture", roda o pipeline da seção 3, e **POST imediato em `/api/public/hunting/capture`** (perfil completo, igual fluxo individual) com o campo extra `hunting_run_id`. Fecha a aba ao receber 2xx.
- Concorrência fixa = 1 aba, respeitando rate. Pausa automática se aparecer challenge/captcha.
- UI mostra progresso (X/Y salvos no TechHire, X/Y com erro), link "Abrir no TechHire" que leva para `/candidates?hunting_run=<id>` filtrado pela run.
- Sem botão de export CSV — o resultado vive no TechHire.

## 5. Backend / endpoints

Reaproveitamos `/api/public/hunting/capture` (já valida `experiences`, `education`, etc. via Zod). Ajustes:
- Aceitar campos opcionais `hunting_run_id` (uuid) e `contact_info` (jsonb) no Zod.
- Persistir `hunting_run_id` em `ats_hunting_captures` (nova coluna) e marcar `ats_candidates.source = 'linkedin_bulk'` quando vier de run em lote.
- Novo endpoint `POST /api/public/hunting/runs` (cria run com nome/tag/pool opcional e devolve `run_id`) e `POST /api/public/hunting/runs/:id/finish` (marca conclusão e totais). Autenticação por API key (mesmo middleware da `capture`).
- Nova tabela `ats_hunting_runs` (id, owner_id, label, source_url, status, totals_jsonb, started_at, finished_at) com RLS por `owner_id` e GRANTs padrão.
- Coluna aditiva `contact_info jsonb` em `ats_candidates`.
- Filtro `?hunting_run=<id>` na lista `/candidates` (já existe paginação; só adicionar where).
- **Bulk-capture antigo (`/api/public/hunting/bulk-capture`) fica deprecated** — a nova captura em lote usa o mesmo `/capture` por perfil, garantindo dados ricos.

Nenhuma alteração de RLS de tabelas existentes, auth, schema fora das colunas/tabela aditivas acima.

## 6. Entregas faseadas

**Fase A — Extrator confiável de perfil único**
- Reescrever `extension/content.js` em módulos: `voyager-index.js`, `details-fetcher.js`, `profile-builder.js`, `guard.js`.
- Remover heurísticas de innerText do caminho feliz (manter só como diagnóstico).
- Atualizar `capture_version` para `3.0`.
- Validar manualmente em 5 perfis (1º grau, 2º grau, fora da rede, Premium, OpenToWork) e anexar diagnóstico.

**Fase B — `contact_info`, `ats_hunting_runs` e endpoints de run**
- Migration aditiva: `alter table ats_candidates add column contact_info jsonb`; `create table ats_hunting_runs (...)` com RLS + GRANT; `alter table ats_hunting_captures add column hunting_run_id uuid`.
- Estender Zod do `capture.ts` para aceitar `contact_info` e `hunting_run_id`.
- Criar `runs.ts` (POST create + POST finish).
- Renderizar `contact_info` na tela de detalhes do candidato (read-only).
- Adicionar filtro `?hunting_run=<id>` em `/candidates`.

**Fase C — Captura em lote da busca (salva no TechHire)**
- Detector de página de busca + nova aba "Busca" na sidebar.
- Fila em IndexedDB + worker no background.js.
- Cria `hunting_run` ao iniciar, posta cada perfil completo em `/capture` com `hunting_run_id`, finaliza a run ao terminar.
- Progresso/erros visíveis na sidebar com link "Abrir no TechHire" filtrado pela run.
- Throttle, jitter e pausa em captcha.
- Botão "Parar" (marca run como `aborted`).

**Fase D — Refinos**
- Toggle "modo silencioso" (abas em background sem foco).
- Tela `/hunting/runs` no app com histórico de runs (lista, KPIs por run, link para candidatos da run).
- Documentar em `extension/README.md` v2.0 e atualizar página `/hunting` no app.

## 7. Limites e honestidade

- O LinkedIn rejeita scraping em massa; manteremos concorrência 1 e jitter humano. Mesmo assim o usuário pode tomar challenge/restrição — vamos comunicar isso na UI ("você é o responsável pela conta usada").
- Não vamos burlar login, paywall do Sales Navigator nem captcha.
- Sem credenciais novas, sem secrets, sem mudança de auth/RLS de tabelas existentes.
- Nada de IA nesta entrega — extração é puramente determinística.
- Sem export CSV — todo dado capturado é gravado no TechHire (ats_candidates + ats_hunting_captures + ats_hunting_runs).

## 8. Arquivos previstos

Criar: `extension/lib/voyager-index.js`, `extension/lib/details-fetcher.js`, `extension/lib/profile-builder.js`, `extension/lib/guard.js`, `extension/lib/search-queue.js`, `extension/sidebar-search.html` (parcial), migration `*_ats_hunting_runs_and_contact_info.sql`, `src/routes/api/public/hunting/runs.ts`, `src/routes/_authenticated/(ats)/hunting.runs.tsx` (Fase D).

Alterar: `extension/content.js` (reduzir drasticamente), `extension/background.js` (worker da fila + chamadas de run), `extension/manifest.json` (versão 2.0.0), `extension/sidebar.css`, `extension/popup.html/js` (toggle headless), `src/routes/api/public/hunting/capture.ts` (Zod + `contact_info` + `hunting_run_id`), `src/routes/_authenticated/(ats)/candidates.$id.tsx` (render `contact_info`), `src/routes/_authenticated/(ats)/candidates.index.tsx` (filtro `?hunting_run=<id>`), `extension/README.md`.

Deprecar (sem remover ainda): `src/routes/api/public/hunting/bulk-capture.ts` — adicionar header de deprecação no response e log.

Sem alterações em RLS, auth ou schema de tabelas existentes além das colunas aditivas acima.

## 9. Como validar manualmente

1. Recarregar a extensão em `chrome://extensions`.
2. Abrir um perfil e conferir no painel "Diagnóstico" que `experiences` e `education` vieram de `voyager` (não `text-fallback`).
3. Conferir em `/candidates/<id>` que About, Experiência, Educação, Skills e Contact Info aparecem estruturados.
4. Ir em `linkedin.com/search/results/people/?keywords=...`, clicar "Capturar resultados", definir 5 perfis, iniciar.
5. Acompanhar progresso na sidebar (5/5 salvos no TechHire).
6. Clicar "Abrir no TechHire" e ver os 5 candidatos da run com dados completos em `/candidates?hunting_run=<id>`.
7. (Fase D) Conferir a run em `/hunting/runs` com totais e timestamps.

## 10. Próximo passo recomendado

Aprovar este plano para eu iniciar pela **Fase A** (extrator confiável de perfil único) — é o que resolve o print que você mandou. Fases B/C/D em sequência, sem misturar com a Fase A.
