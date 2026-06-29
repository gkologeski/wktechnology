# Documentação TechHire — com Print Screens

## Objetivo
Gerar um documento de referência (PDF + Markdown) cobrindo **todas as funcionalidades atuais do TechHire ATS**, com capturas de tela reais de cada módulo, descrição funcional, fluxos principais e dicas de uso.

## Entregáveis
1. `/mnt/documents/techhire-handbook.pdf` — documento navegável com sumário, seções e screenshots embutidos.
2. `/mnt/documents/techhire-handbook.md` — versão Markdown editável.
3. `/mnt/documents/techhire-screenshots/` — pasta com todos os PNGs capturados (referenciados pelo PDF/MD).

## Estrutura do documento
1. **Visão Geral** — o que é o TechHire, posicionamento (quiet premium), arquitetura host/workspace.
2. **Primeiros Passos** — login, troca de módulo (Module Switcher), Hub `/workspace`, onboarding.
3. **Dashboard & Insights** (`/insights`) — KPIs, gráficos, AI insights.
4. **Vagas** (`/jobs`, `/jobs/$id`) — lista, kanban por status e por departamento (DnD), detalhes 3 colunas, pipeline, scorecards, copilot, multi-posting, credenciais de job boards, página de carreiras (`/careers`).
5. **Candidatos** (`/candidates`, `/candidates/$id`) — lista/cards/kanban, DnD com transições seguras, detalhes 3 colunas, CV parser (Gemini/PDF), copilot, async video, scorecards.
6. **Pipelines** (`/pipelines`) — editor visual, estágios, default.
7. **Entrevistas** — agendamento, painel, self-scheduling, kits de entrevista, vídeo gravado.
8. **Ofertas & eSign** (`/offer/$token`) — criação, envio, aceite público.
9. **Sourcing & Talent CRM** (`/sourcing/*`) — Inbox, Pools, Sequências, Indicações, Analytics.
10. **Hunting LinkedIn** (`/hunting`) — extensão, pairing, captura, templates.
11. **Inteligência (IA)** — Match score, JD Generator, AI Recruiter Copilot, Notetaker (`/notetaker`).
12. **Programa de Indicações 2.0** — referrals, bônus, tracking.
13. **DEI & Analytics Avançado** — dashboards, painel scheduling.
14. **LGPD Hub** — consentimentos, retenção, exportação.
15. **Workspace & Configurações** — membros, convites brancos, branding, API keys, calendários (sync gravações), SLA, billing.
16. **Integrações & API Pública** (`/api/public/v1/ats/*`) — jobs, applications, hire, chaves.
17. **Timeline Unificada & Associações** — timeline pins, espelhamento.
18. **Segurança** — RLS por workspace, audit trail, posturas aplicadas.
19. **Roadmap atual** (resumo) — Ondas 5–11 conforme `.lovable/plan.md` e backlog.

Cada seção segue o template: **O que é · Para que serve · Como acessar (rota) · Print(s) · Passo a passo · Dicas / limitações**.

## Como os screenshots serão capturados
Via Playwright headless no sandbox (já documentado em `<browser-use>`), restaurando sessão Supabase quando `LOVABLE_BROWSER_AUTH_STATUS=injected`. Para cada rota da lista acima:
- viewport 1280×1800;
- `await page.goto("http://localhost:8080<rota>", wait_until="networkidle")`;
- aguardar seletor estável (heading principal) antes do `page.screenshot`;
- salvar em `/tmp/browser/handbook/screenshots/` e copiar para `/mnt/documents/techhire-screenshots/`;
- para fluxos que dependem de dados (ex.: detalhes de vaga, kanban com cards), pegar o **primeiro** registro existente via DOM; se vazio, capturar o EmptyState e anotar isso na legenda.
- rotas públicas (carreiras, offer, interview, schedule, book) capturadas sem sessão.

Se `LOVABLE_BROWSER_AUTH_STATUS` ≠ `injected`, paro e peço o login no preview antes de continuar — não invento screenshots.

## Geração do PDF
Usar a skill **pdf** com ReportLab (Platypus):
- Capa com nome do produto, versão, data.
- Sumário automático.
- Tipografia: Helvetica/Arial; títulos 18/14/12; corpo 10.
- Cada seção: H1 do módulo, subseções com prints (largura máx 6.5"), legendas, bullets.
- Rodapé com paginação.
- QA obrigatório: `pdftoppm` → inspeção visual de **todas** as páginas, corrigir overflow/clipping antes de entregar.

A versão Markdown referencia os mesmos PNGs com caminhos relativos.

## Fora de escopo
- Nenhuma alteração de código, rotas, schema, RLS, design system ou conteúdo do produto.
- Sem tradução para outros idiomas (PT-BR apenas).
- Sem vídeo/gif animado — somente PNGs estáticos.
- Não documentar telas removidas ou módulos não-TechHire (CRM, TechSales) salvo o necessário para explicar o Module Switcher.

## Riscos / pendências
- Telas que exigem dados de demonstração inexistentes aparecerão como EmptyState — será sinalizado na legenda.
- Se a sessão Supabase não estiver injetada, a captura das rotas autenticadas fica bloqueada até o usuário logar no preview.
- Funcionalidades dependentes de credenciais externas (LinkedIn, Indeed, eSign provider real) serão documentadas com o estado atual (mock/integration-ready), sem simular sucesso.

## Confirmação rápida antes de executar
1. Profundidade: **handbook completo** (todas as rotas listadas) — confirma? Se preferir um guia mais enxuto (só os 6–8 módulos principais), avise.
2. Formato: **PDF + Markdown + pasta de PNGs**, salvos em `/mnt/documents/`. OK?
3. Idioma: **PT-BR**. OK?
