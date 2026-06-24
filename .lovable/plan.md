
# 🎯 Plano de Evolução — TechHire ATS

## Diagnóstico

Hoje o TechHire tem o **esqueleto** de um ATS (vagas, candidatos, Kanban, scorecards, e-mails por stage, career page pública, parsing de CV via Gemini, analytics básico), mas faltam as **camadas que definem um ATS de classe mundial em 2026**: agendamento de entrevistas, vídeo, agentes de IA, match score explicável, DEI analytics, fraud detection, fila de envio de e-mails, ofertas digitais e integrações HRIS.

Benchmarking de 17 players (Greenhouse, Lever, Ashby, Gem, Workable, SmartRecruiters, iCIMS, Teamtailor, Pinpoint, Manatal, BambooHR, Recruitee + Gupy, Sólides, Vagas.com, Pandapé, Compleo) mostra que o mercado migrou para **"Hiring Intelligence Platforms"** com agentes autônomos. SmartRecruiters declarou em jun/2025 "the end of the ATS era".

---

## Posicionamento alvo

> **TechHire = "Greenhouse + Ashby para o Brasil, com agentes de IA da Lovable e LGPD-first"**

Foco em **PME/Mid-Market tech** brasileiro, competindo no eixo Gupy/Sólides (BR) e Ashby/Workable (global), com diferenciais: **agentes IA nativos**, **scorecards estruturados**, **career pages white-label por workspace**, **integração CRM↔ATS** (vaga nasce de um Deal) e **LGPD nativo**.

---

## Roadmap — 4 fases

### 🟢 FASE 1 — Fechar os buracos do MVP (2-3 sprints)
*"Tornar utilizável de ponta a ponta"*

1. ✅ **Cron de envio de e-mails de stage** — worker `/api/public/hooks/ats-emails-tick.ts` processa `ats_stage_email_log` pendentes via Resend e marca `sent`/`failed`.
2. ✅ **E-mail de confirmação ao candidato** após `submitPublicApplication` (template branded por workspace).
3. ✅ **Editor visual de pipeline** — UI em `/pipelines` para criar/editar pipelines e stages (cor, tipo, ordem). Pipeline "RH - Seleção" já importado das fases de Tickets.
4. ✅ **Export CSV** de candidatos e candidaturas por vaga (`exportCandidatesCsv` / `exportApplicationsCsv`).
5. **Permissões por equipe** — RLS adicional: `hiring_manager_id` e `recruiter_id` veem apenas as vagas em que estão; admin vê tudo. Hoje qualquer membro do workspace vê tudo.
6. **Auditoria de movimentações** — tabela `ats_application_events` registrando cada `moveApplication`, mudança de stage, scorecard submetido (compliance LGPD + relatórios).


### 🟡 FASE 2 — Entrevistas e ofertas (3-4 sprints)
*"Fechar o ciclo até a contratação"*

7. **Agendamento nativo de entrevistas** — tabela `ats_interviews` ligada à candidatura, reaproveitando módulo de booking que já existe (`/book/$slug`). Self-scheduling: candidato recebe link, escolhe horário, sincroniza Google/Outlook do recrutador, gera link Meet/Zoom.
8. **Interview kits** — perguntas estruturadas por stage da vaga, mostradas ao avaliador junto do scorecard durante a entrevista.
9. **Vídeo entrevistas assíncronas** — candidato grava respostas via webcam (MediaRecorder API + upload para Supabase Storage), recrutador assiste em playlist; reaproveita infra de recording que já existe em `screen-recorder`.
10. **Módulo de Ofertas** — tabela `ats_offers` com salário, benefícios, data de início, status (draft/sent/accepted/rejected); geração de carta PDF; integração com `/sign/$token` para assinatura digital nativa (já existe).
11. **Parsing de PDF server-side** — atual extração só funciona no browser. Mover para server function com `pdf-parse` (Worker-compatible) + fallback OCR via Gemini Vision para PDFs imagem.

### 🔵 FASE 3 — IA diferenciada (4-5 sprints)
*"Onde a Lovable vence"*

12. **Match Score Explicável (Job ↔ Candidato)** — função IA que compara `requirements`/JD da vaga vs `cv_parsed` + scorecards e devolve score 0-100 com **justificativa transparente por critério** (DEI-safe: ignora nome, idade, foto, gênero). Exibido como badge no card do Kanban e ordenação automática.
13. **AI Job Description Generator + Linguagem Inclusiva** — botão "Gerar com IA" no formulário de vaga: descreve cargo → IA produz JD completa, com checagem de termos enviesados (ex: "rockstar", "agressivo").
14. **AI Notetaker para entrevistas** — captura áudio da chamada (Web Audio API), transcreve via Gemini, gera resumo estruturado (pontos fortes / fracos / recomendação) e pré-preenche o scorecard.
15. **AI Sourcing Assistant** — busca por linguagem natural ("dev React sênior em SP, remoto") sobre o banco interno de candidatos (incluindo arquivados de processos anteriores) — embeddings de skills + Talent Rediscovery.
16. **AI Copilot ATS** — extensão do copilot existente: "quantas vagas estão paradas há mais de 30 dias?", "compare meus tempos de fechamento por seniority", "redija e-mail de rejeição empático para o candidato X".
17. **Candidate Fraud Detection** — heurísticas + IA sinalizando: e-mails descartáveis, CV gerado por IA, geolocalização inconsistente, múltiplas candidaturas com pequenas variações.

### 🟣 FASE 4 — Enterprise & ecossistema (contínuo)
*"Tirar bloqueios de venda"*

18. **DEI Analytics opt-in** — coleta opcional e anonimizada de gênero/raça/PcD no formulário público; dashboard mostra **funil por estágio segmentado**, identificando perda de diversidade.
19. **Custom Report Builder** — UI para o usuário arrastar dimensões (vaga, recrutador, source, stage) e métricas (tempo médio, conversão, score médio) e salvar dashboards.
20. **Webhook de candidatura externa** — `/api/public/ats/$slug/apply` para LinkedIn/Indeed/Gupy postarem candidaturas direto.
21. **Open API documentada + Webhooks de eventos ATS** — `ats.application.created`, `ats.candidate.hired`, etc., para Zapier/Make.
22. **Integração HRIS** (TOTVS, Senior, Sankhya, BambooHR) — quando candidato vira `hired`, dispara criação do colaborador no HRIS escolhido.
23. **Multiposting** — publicação em LinkedIn, Indeed, Glassdoor, Vagas.com via APIs/feed XML por workspace.
24. **Onboarding pós-contratação** — checklist de pré-boarding (docs, exames, kit), integrado ao módulo `module-onboarding-checklist` já existente.

---

## Detalhes técnicos (resumo)

```text
Novas tabelas previstas:
  ats_application_events    — auditoria de movimentações (fase 1)
  ats_interviews            — agendamento + vídeo (fase 2)
  ats_offers                — ofertas (fase 2)
  ats_match_scores          — cache de score vaga↔candidato (fase 3)
  ats_dei_responses         — autodeclaração anônima (fase 4)
  ats_custom_reports        — dashboards salvos (fase 4)

Novos cron/webhooks (/api/public/hooks/):
  ats-stage-emails-tick     — envia fila de e-mails (fase 1)
  ats-match-score-tick      — recalcula match scores em background (fase 3)
  ats-fraud-scan-tick       — varre candidaturas suspeitas (fase 3)
  ats-interview-reminders   — D-1 e 1h antes (fase 2)

Reaproveitamentos:
  - Booking module        → agendamento de entrevistas
  - /sign/$token          → assinatura de oferta
  - Resend infra          → e-mails branded
  - Lovable AI Gateway    → match score, notetaker, JD generator
  - Bug-report recorder   → vídeo entrevista assíncrona
  - Copilot CMDK          → AI Copilot ATS
```

---

## O que NÃO entra agora

- **OFCCP compliance** (EUA) — adicionar só se aparecer cliente americano. LGPD já cobre o BR.
- **Multiposting LinkedIn oficial** — exige acordo comercial; começar com feed XML público + Indeed.
- **Voice screening** (estilo iCIMS Frontline) — fora do ICP tech.
- **HRIS+Payroll completo** (estilo BambooHR) — TechHire foca em recrutamento; integrar via API com HRIS existentes em vez de construir.

---

## Como medir sucesso por fase

| Fase | Métrica |
|---|---|
| 1 | Workspace consegue rodar 1 vaga end-to-end sem usar planilha externa |
| 2 | Tempo médio de fechamento cai 30% vs fase 1 (medido em `getAtsAnalytics`) |
| 3 | 60%+ das contratações vêm dos Top 10 sugeridos pelo Match Score (benchmark Gupy: 65%) |
| 4 | TechHire vence Gupy/Sólides em pelo menos 1 RFP de cliente mid-market |

---

## Próximo passo sugerido

Começar pela **Fase 1 inteira (itens 1–6)** porque sem ela o que já foi construído fura na operação real (e-mails que nunca saem, sem pipeline editável, sem permissões por equipe). Posso atacar tudo em sequência se você aprovar.
