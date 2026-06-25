# TechHire ATS — Roadmap de Funcionalidades (Ondas 5–8)

Resgatado do histórico (msg #2464). Comparação contra líderes globais
(Greenhouse, Lever, Ashby, Workday, Gem, SmartRecruiters, iCIMS) e plano
de evolução em 4 ondas. Independente do roadmap de UX/UI.

## Diagnóstico atual

**Pontos fortes do TechHire:**
- Núcleo sólido: jobs → pipeline → scorecards → offers
- Acima da média em IA: notetaker, match score, fraud flags, JD generator, parsing multimodal de CV
- Acima da média em DEI analytics — área em que ATS legados ainda patinam

**Gaps competitivos identificados:**
1. **Distribuição & Sourcing** — sem multi-posting, sem talent CRM, sem extensão Chrome, sem referrals
2. **Scheduling de alto volume** — só self-schedule simples; sem panel / round-robin / load-balance
3. **Assessments & Background check** — sem integrações; exige planilhas paralelas
4. **Workflows de aprovação** — sem cadeias configuráveis
5. **Plataforma & integrações** — sem API pública, sem multi-idioma, sem handoff HRIS, sem app mobile
6. **Compliance LGPD/GDPR** — incompleto (falta consentimento explícito, retenção, DSAR end-to-end)

## Onda 5 — Distribuição & Sourcing (maior ROI imediato)

- Multi-posting: LinkedIn, Indeed, Vagas.com, Catho, Glassdoor
- Apply with LinkedIn (OAuth) na página de carreiras
- Talent CRM (reaproveitando `stage-emails` + segmentação de candidatos passivos)
- Chrome extension para sourcing (capturar perfis públicos → candidate pool)
- Programa de Referral (link único por colaborador, tracking, recompensa)

## Onda 6 — Scheduling & Avaliação

- Scheduler avançado: painel, round-robin, load-balance entre entrevistadores
- Knockout questions na candidatura
- Integração com assessments: HackerRank, Codility, iMocha
- Integração com background check (Checkr ou equivalente BR)
- Interviewer training: trilha + certificação interna de entrevistadores

## Onda 7 — Approvals, Compliance & Plataforma

- Cadeias de aprovação configuráveis (vaga, requisição, oferta)
- Aprovação multi-nível de oferta antes do eSign
- LGPD/GDPR granular: consentimento explícito, retenção, DSAR, direito ao esquecimento
- Vagas confidenciais (visibilidade restrita por equipe)
- API pública + webhooks para integrações de terceiros
- Multi-idioma (PT-BR, EN, ES) em carreiras e e-mails

## Onda 8 — Inteligência avançada & Mobilidade

- Universal AI Copilot (chat contextual em qualquer tela do ATS)
- Quality-of-hire loop (feedback pós-contratação realimentando o match score)
- Relatórios e dashboards customizáveis pelo usuário
- HRIS handoff (export estruturado para folha/onboarding)
- PWA para recrutadores (uso mobile real, offline básico)
- Marketplace de mobilidade interna (vagas internas + candidatura de colaboradores)

## Sugestão de início

Começar pela **Onda 5 — Distribuição & Sourcing**: é o maior gap competitivo e o que mais acelera o pipeline de candidatos qualitativamente, destravando ROI para as ondas seguintes.
