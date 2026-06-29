## Objetivo

Exibir, em `/candidates/$id`, os 20 novos campos de dados ricos capturados pela extensão TechHire Hunter (Sobre, Experiências, Educação, Skills detalhadas, Sinais de recrutamento, Atividade, Links externos etc.), preservando o layout 3-colunas e os componentes oficiais do TechHire.

## Escopo

- Somente UI: leitura dos campos já persistidos em `ats_candidates`.
- Sem alterar schema, server functions, RLS, captura ou lógica de negócio.
- Sem mexer em outras rotas/telas.

## Arquivos

- Edita: `src/routes/_authenticated/(ats)/candidates.$id.tsx`
- Cria: `src/components/ats/candidate/rich-profile-blocks.tsx` (apresentacional, sem fetch)
- Edita (apenas tipo): `src/lib/ats/ats.functions.ts` (ampliar `CandidateDetail.candidate` para incluir os novos campos retornados pelo `select('*')` já existente — se o select hoje for explícito, adicionar os campos).

## Distribuição no layout 3-colunas

Coluna esquerda (Propriedades — já existe):
- Adicionar abaixo do bloco atual: `photo_url` como avatar maior + `headline` em uma linha discreta.
- Adicionar pequenos chips informativos: `connection_degree` (1st/2nd/3rd) e `open_to_work` (badge verde "Open to work") quando presentes.
- Bloco "Links externos" listando `external_links` (github, portfolio, twitter, site, etc.) como ícones+url.

Coluna central (após `ApplicationsCard`/`InterviewsCard`/`OffersCard`/`EventsCard`, em ordem):
1. `AboutBlock` — `about` em texto longo, com clamp + "ver mais".
2. `ExperienceBlock` — timeline a partir de `experiences[]` (empresa, cargo, período, descrição). Vazio → EmptyState compacto.
3. `EducationBlock` — lista de `education[]` (instituição, curso, período).
4. `ProjectsPublicationsBlock` — duas listas compactas: `projects[]` e `publications[]`.
5. `VolunteeringBlock` — `volunteering[]`.
6. `RecentActivityBlock` — últimos itens de `recent_activity[]` (texto + link + data) com limite de 5 e "ver tudo".
7. `RecommendationsBlock` — `recommendations[]` com autor + trecho.

Coluna direita (após cards já existentes):
- `SignalsBlock` — empilha:
  - `open_to_work` (badge),
  - `connection_degree`,
  - `available_actions` (chips: Mensagem, Conectar, InMail) — somente leitura.
- `SkillsDetailedBlock` — substitui visualmente `SkillsCard` quando `skills_detailed[]` existir (com endorsements), caindo para `SkillsCard` clássico quando vazio.
- `CertificationsLanguagesBlock` — duas listas curtas: `certifications[]` e `languages[]`.
- `CurrentCompanyBlock` — card pequeno com `current_company_data` (tamanho, setor, localização, tempo na vaga calculado a partir das datas de `experiences[0]` quando disponível).
- `CaptureMetaBlock` — rodapé discreto: `captured_at`, `capture_version`, link "Ver no LinkedIn".

## Regras de UX/UI

- Usar `SectionHeader`, `EmptyState`, `LoadingSkeleton`, badges oficiais (`StatusBadge`/`SourceBadge`/`MetaPill`) e `Card` composto do TechHire.
- Tokens semânticos de `src/styles.css` — sem cores hardcoded.
- Cada bloco com 3 estados: vazio (EmptyState com microcopy "Sem dados — capture pelo TechHire Hunter"), preenchido, e parcial (alguns campos ausentes).
- Responsivo: em viewports < `lg`, empilhar tudo numa coluna mantendo a ordem (esquerda → centro → direita).
- Acessibilidade: links externos com `rel="noopener noreferrer"`, `aria-label` em ícones, foco visível.
- Sem queries/mutations dentro dos novos componentes — eles recebem `candidate` por props.

## Detalhes técnicos

- Tipos: estender `CandidateDetail['candidate']` localmente com os campos JSONB (`experiences`, `education`, `skills_detailed`, `external_links`, `available_actions`, `current_company_data`, `recent_activity`, `recommendations`, `certifications`, `languages`, `projects`, `publications`, `volunteering`) usando shapes tolerantes (`unknown[]` + parsers defensivos). Render sempre via type guards — campo desconhecido cai pra empty silencioso.
- Parser utilitário em `rich-profile-blocks.tsx`: `asArray`, `asString`, `asRecord` para normalizar JSONB sem quebrar quando vier de versões antigas da extensão (`capture_version != "2.0"`).
- "Tempo na empresa atual" calculado client-side a partir de `experiences[0].start_date` (sem mutar dado).
- Ordem visual respeitando a Design Foundation (densidade alta na coluna direita, leitura confortável na central).

## Validação manual

1. `/candidates/$id` de candidato capturado com a extensão v1.0.1 → todos os blocos aparecem populados.
2. Candidato manual sem dados ricos → blocos exibem EmptyState e não quebram layout.
3. Candidato com captura antiga (v1.0.0) → blocos novos vazios, blocos clássicos (Skills/Tags) inalterados.
4. Light/dark mode e viewport mobile/tablet/desktop.

## Fora de escopo (próximas entregas)

- Editar inline os novos campos.
- Sincronizar atualizações automáticas via re-captura.
- Match score reaproveitando `skills_detailed`/`experiences`.
