## Onde estamos hoje (TechHire)

Mapeado a partir de `src/routes/_authenticated/(ats)/*`, `src/lib/ats/*` e tabelas `ats_*` no banco.

**Já entregue:**

- Vagas, Candidatos, Aplicações, **Pipelines visuais** com editor drag-and-drop
- **Scorecards** estruturados + **Kits de entrevista**
- **Entrevistas** com **self-schedule** por token público
- **Ofertas com eSign** + portal público da oferta
- **E-mails por etapa** automáticos
- Site de **Carreiras** público + SEO/OG dinâmico
- **CV Parser** (PDF text + Gemini multimodal)
- **IA**: Match Scores, JD Generator, **Notetaker** de entrevista, Flags de fraude
- **DEI Analytics**, Insights ATS, Audit Log, Team-based RLS
- Async video responses

---

## Comparação com ATS líderes mundiais

Referência: Greenhouse, Lever, Ashby, Workday Recruiting, SmartRecruiters, iCIMS, Gem, Teamtailor, Pinpoint.

Legenda: ✅ paridade · 🟡 parcial · ❌ falta


| Capacidade                                                                                             | Líderes                  | TechHire                             |
| ------------------------------------------------------------------------------------------------------ | ------------------------ | ------------------------------------ |
| **Sourcing & Talent CRM** (talent pools, nurture, extensão Chrome, dedupe global)                      | Gem, Greenhouse, Ashby   | ❌                                    |
| **Programas de Indicação** (referrals com bônus, tracking, leaderboard)                                | Greenhouse, Lever        | ❌                                    |
| **Requisições + workflows de aprovação** (multi-aprovador, headcount, budget)                          | Workday, SmartRecruiters | ❌                                    |
| **Multi-posting em job boards** (LinkedIn, Indeed, Glassdoor, Vagas.com, Catho) + **programmatic ads** | Todos                    | ❌                                    |
| **Apply with LinkedIn / Indeed Easy Apply** + apply mobile-first                                       | Todos                    | 🟡 (form próprio)                    |
| **Knockout questions / triagem com regras**                                                            | Greenhouse, Pinpoint     | 🟡 (custom fields)                   |
| **Assessments integrados** (HackerRank, Codility, iMocha, Plum, Pymetrics)                             | Greenhouse, Ashby        | ❌                                    |
| **Background check** (Checkr, HireRight, GupY equivalente BR)                                          | Greenhouse, Lever        | ❌                                    |
| **Pipelines visuais** + automações por estágio                                                         | Lever, Ashby             | ✅                                    |
| **Scorecards estruturados + competências**                                                             | Greenhouse, Ashby        | ✅                                    |
| **Kits de entrevista + treinamento de entrevistador**                                                  | Greenhouse               | 🟡 (sem treinamento)                 |
| **Scheduling avançado** (panel, round-robin, load balancing, salas/Zoom, conflito)                     | Goodtime, Ashby          | 🟡 (self-schedule simples)           |
| **Sequências de comunicação** (e-mail + SMS + WhatsApp em cadência)                                    | Gem, Lever               | 🟡 (stage-emails one-shot)           |
| **Two-way email/calendar sync** por recrutador                                                         | Todos                    | 🟡 (parcial via /settings/calendars) |
| **AI screening / ranking automático**                                                                  | Ashby, Eightfold, Gem    | ✅ (Match Scores)                     |
| **AI Notetaker + sumarização**                                                                         | Metaview, Hume, Ashby    | ✅                                    |
| **AI copilot** (escrever JD, e-mail, feedback)                                                         | Ashby, Gem               | 🟡 (JD apenas)                       |
| **Detecção de fraude / deepfake**                                                                      | Karat, novos players     | ✅ (flags)                            |
| **Async video screening**                                                                              | HireVue, Spark Hire      | ✅                                    |
| **Ofertas com aprovação multi-nível + templates dinâmicos + eSign**                                    | Greenhouse, Workday      | 🟡 (eSign sem aprovação)             |
| **Onboarding handoff** para HRIS (Workday, BambooHR, Gupy People, Sólides)                             | Workday, SmartRecruiters | ❌                                    |
| **DEI Analytics + relatórios de viés**                                                                 | Greenhouse, Pinpoint     | ✅                                    |
| **Relatórios customizáveis + dashboards salvos + benchmarks**                                          | Ashby, Workday           | 🟡 (Insights fixos)                  |
| **Source-of-hire, custo por contratação, time-to-fill, quality-of-hire**                               | Todos                    | 🟡 (parcial)                         |
| **Compliance**: GDPR consent, LGPD, right-to-erasure, EEOC/OFCCP, retenção configurável                | Todos                    | 🟡 (audit log apenas)                |
| **Permissões granulares** (hiring team por vaga, vagas confidenciais, visualização redatada)           | Greenhouse, Workday      | 🟡 (RLS por team)                    |
| **Portal de agências / vendor management**                                                             | Workday, iCIMS           | ❌                                    |
| **App mobile para recrutador/gestor** (aprovar, avaliar, avançar)                                      | Greenhouse, Workday      | ❌                                    |
| **Internal mobility / marketplace interno**                                                            | Workday, Eightfold       | ❌                                    |
| **API pública + webhooks + Zapier/Make**                                                               | Todos                    | 🟡 (webhooks internos)               |
| **Multi-idioma + multi-moeda + multi-localidade**                                                      | Workday, SmartRecruiters | ❌                                    |
| **Glassdoor/LinkedIn reviews ingest + employer brand**                                                 | SmartRecruiters          | ❌                                    |


---

## Resumo executivo

TechHire já tem **núcleo completo** (jobs → pipeline → scorecards → ofertas) e está **acima da média** em IA (notetaker, match, fraude, JD, multimodal CV) e DEI — áreas onde a maioria dos ATS legados ainda corre atrás.

As **maiores lacunas competitivas** são:

1. **Distribuição & Sourcing** — sem multi-posting, sem talent CRM, sem extensão de sourcing, sem referrals. Hoje o recrutador depende de tráfego orgânico no site de Carreiras.
2. **Scheduling de alto volume** — falta panel/round-robin/load-balance que define a experiência Ashby/Goodtime.
3. **Assessments & Background check** — sem integrações, exige planilha paralela.
4. **Workflows de aprovação** — requisições e ofertas sem cadeia de aprovação configurável.
5. **Plataforma & integrações** — falta API pública, multi-idioma, handoff para HRIS, app mobile.
6. **Compliance LGPD/GDPR** completa (consent explícito, retenção, DSAR).

---

## Evolução proposta — 4 ondas

### Onda 5 — Distribuição & Sourcing (maior ROI imediato)

1. **Multi-posting** para LinkedIn, Indeed, Vagas.com, Catho, Glassdoor (XML feed + API onde possível)
2. **Apply with LinkedIn** (OAuth) e **Easy Apply Indeed**
3. **Talent CRM**: talent pools, tags, nurture campaigns reaproveitando `stage-emails` + sequences
4. **Extensão Chrome de sourcing** (capturar perfil LinkedIn → candidato)
5. **Programa de indicação** com bônus, tracking de origem e leaderboard

### Onda 6 — Scheduling & Avaliação profissional

1. **Scheduler avançado**: panel, round-robin, load balancing, detecção de conflito, salas/Zoom/Meet
2. **Knockout questions** com regras (auto-reject / auto-advance)
3. **Integração de assessments**: HackerRank, Codility, iMocha (webhooks bidirecionais)
4. **Background check**: Checkr (global) + provider BR
5. **Treinamento de entrevistador** (vídeos + certificação por kit)

### Onda 7 — Approvals, Compliance & Plataforma

1. **Requisições** com cadeia de aprovação (headcount, budget, justificativa)
2. **Aprovação de oferta** multi-nível antes do eSign
3. **LGPD/GDPR**: consent granular, política de retenção configurável, DSAR (export/erasure self-service)
4. **Vagas confidenciais** + visualização redatada (anti-viés)
5. **API pública + webhooks externos** (Zapier/Make ready)
6. **Multi-idioma** (PT/EN/ES) no site de Carreiras e e-mails

### Onda 8 — Inteligência avançada & Mobilidade

1. **AI Copilot** universal (escrever e-mail, feedback, follow-up, rejeição empática) com tom da marca
2. **Quality-of-hire** via integração com ciclo de performance + retenção (loop fechado)
3. **Relatórios customizáveis** (drag-and-drop) + dashboards salvos + benchmarks de mercado
4. **Handoff para HRIS** (BambooHR, Gupy People, Sólides, Workday) via conector
5. **App mobile recrutador/gestor** (PWA): aprovar oferta, avaliar candidato, avançar etapa
6. **Internal mobility**: marketplace interno de vagas + matching com colaboradores

---

## Próximo passo sugerido

Grave o plano em um arquivo para posterior execução.