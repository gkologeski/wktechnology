# Plano: Mapeamento de Funcionalidades HubSpot → Nosso CRM

## Objetivo

Produzir um **catálogo navegável** de TODAS as funcionalidades do HubSpot CRM (Sales Hub + Service Hub + Marketing Hub básico, focando no que é CRM-core), comparado ao que já existe no nosso app, para você marcar item a item o que quer incorporar.

## Entregáveis

### 1. Documento mestre `docs/hubspot-feature-map.md`

Estrutura por módulo. Cada item segue o formato:

```
- [ ] Nome da funcionalidade
      HubSpot: descrição em 1 linha
      Status atual: ✅ pronto | 🟡 parcial | ❌ não existe
      Esforço: P / M / G
      Notas: dependências, limitações
```

Você marca os `[ ]` no que quiser priorizar.

### 2. Página interna `/settings/roadmap` (opcional, etapa 2)

Mesma lista renderizada como checklist persistido em Supabase (tabela `feature_roadmap`), para evoluir com a equipe. **Só construo se você pedir** — o markdown já resolve a decisão.

## Módulos a mapear

Cada seção do documento cobre:

1. **Objetos CRM** — Contacts, Companies, Deals, Tickets, Leads, Products, Quotes, Line Items, Custom Objects, Feed
2. **Engajamento / Activities** — Tasks, Calls (com gravação/transcrição), Emails (1:1, sequences, templates, snippets), Meetings (booking pages), Notes, Postal Mail, SMS, WhatsApp, LinkedIn
3. **Pipelines & Automação** — múltiplos pipelines, stage probability, deal rotation, workflows (if/then), sequences, playbooks, lead scoring (manual e preditivo), lead rotation, SLA
4. **Inbox & Conversations** — caixa compartilhada, chat ao vivo, chatbot, formulários, roteamento
5. **Relatórios & Dashboards** — biblioteca de relatórios, custom reports, dashboards, forecast, goals, attribution, funil, coorte
6. **Importação & Sincronização** — import wizard, mapeamento, dedupe, two-way sync, HubSpot↔outros (já temos parcial)
7. **Listas & Segmentação** — listas estáticas/dinâmicas, filtros aninhados, propriedades calculadas
8. **Propriedades** — tipos, grupos, dependências condicionais, histórico, validação, propriedades calculadas
9. **Permissões & Times** — roles, teams, ownership, partition de dados, audit log, SSO/SAML
10. **Comunicação outbound** — sequences, templates com tokens, A/B, throttling, unsubscribe, tracking pixel, click tracking
11. **Calling** — VOIP nativo, integração com 3rd party, transcrição, coaching, gravação
12. **Meetings & Calendário** — booking pages, round-robin, sincronização Google/Outlook
13. **Marketing core** (recorte CRM) — formulários, landing pages básicas, CTAs, email marketing, listas
14. **Service** — tickets, SLA, knowledge base, feedback (NPS/CSAT), portal do cliente
15. **Payments & Quotes** — quotes, e-signature, payment links, subscriptions, invoices
16. **AI / Breeze** — assistente, summarization, AI properties, prospecting agent, content agent
17. **Integrações & Marketplace** — App marketplace, Zapier, API pública, webhooks, custom code actions
18. **Mobile** — apps iOS/Android, notificações, offline
19. **Customização** — custom objects, custom cards no record, layouts por time, custom tabs

## Método

1. **Exploração HubSpot** — usar `websearch` na documentação oficial (developers.hubspot.com + knowledge.hubspot.com) por módulo para extrair a lista canônica de features, sem precisar de conta.
2. **Inventário do nosso CRM** — varrer `src/routes/_authenticated/*`, `src/components/*`, `src/lib/*` e migrations para preencher coluna "Status atual" com precisão.
3. **Estimativa de esforço** — P (≤1 dia, só UI/CRUD), M (1–3 dias, lógica + UI), G (>3 dias, novo subsistema/integração externa).
4. **Geração do markdown** num único arquivo, agrupado por módulo, com sumário no topo e contagem (✅/🟡/❌) por seção.

## Fora de escopo deste plano

- Implementar as features marcadas — isso vira tarefas separadas depois que você escolher.
- Roadmap temporal / sprints — o documento é só catálogo + status; priorização vem depois da sua marcação.
- Comparativo de pricing/tiers do HubSpot.

## Próximo passo após aprovação

Eu pesquiso, monto o `docs/hubspot-feature-map.md` completo (esperado: 300–500 itens), e te entrego para você marcar. Depois você me devolve as escolhas e abrimos tarefas de implementação.
