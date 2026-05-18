# Roteiro de Implementação — CRM completo

> Fonte de verdade. Não sair daqui. Quando algo não estiver previsto, **sugerir**, nunca implementar por conta própria.

---

## 🟢 Onda 0 — WhatsApp (prioridade absoluta) — **CONCLUÍDA**

- 0.1 Fundação (tabelas, enum activity_type) ✅
- 0.2 Outbound (sendWhatsAppMessage + UI Contact/Lead/Deal) ✅
- 0.3 Inbound (webhook Twilio + match contato) ✅
- 0.4 Inbox unificado (/inbox/whatsapp) ✅
- 0.5 Templates & automação básica ✅
- 0.6 HSM oficial via ContentSid — **fora do roteiro, mantido a pedido do usuário** ✅
- 0.7 Campanhas em massa com rate-limit — **fora do roteiro, mantido a pedido do usuário** ✅

---

## 🟡 Onda 1 — Engajamento & Comunicação (3–4 semanas) — **EM ANDAMENTO**

1. **Email 1:1 + tracking (G)** — SMTP/Gmail/Outlook OAuth, pixel de abertura, redirect de click. Aparece no mesmo inbox.
2. **Templates de email + snippets (M)** — tokens `{{first_name}}`, biblioteca compartilhada.
3. **Calling via Twilio Voice (G)** — discador WebRTC, log automático, gravação opcional.
4. **Tasks queues (P)** — "play through queue" estilo HubSpot pra prospecção em série.
5. **Notes com @menções e anexos (P)**.

---

## 🟠 Onda 2 — Automação (3–4 semanas)

6. Workflows engine + builder visual (G)
7. Sequences executor (G)
8. Lead/Deal rotation (M)
9. SLA por pipeline stage (M)
10. Scoring executor (M)

## 🔵 Onda 3 — Estrutura & Permissões (2–3 semanas)

11. Roles & Permissions (M) — tabela `user_roles` separada
12. Teams UI (P)
13. Audit log (M)
14. 2FA + session management (P)
15. Custom properties UI (G)

## 🟣 Onda 4 — Service / Tickets (2 semanas)

16. Tickets como objeto (M)
17. Macros / respostas prontas (P)
18. NPS/CSAT pós-resolução (M)
19. Portal do cliente (G)

## 🟤 Onda 5 — Quotes & Payments (3 semanas)

20. Products + Line Items (M)
21. Quotes em PDF (G)
22. Payment link Stripe (M)
23. E-signature (G)
24. Subscriptions/recurring (G)

## 🟦 Onda 6 — Relatórios & Forecast (2–3 semanas)

25. Custom reports builder (G)
26. Multiple dashboards (M)
27. Funnel + sales velocity + cohort (M cada)
28. Goals por usuário/time (M)
29. Export agendado por email (M)

## ⚪ Onda 7 — Captação & Marketing (3 semanas)

30. Forms builder + embed (G)
31. Listas dinâmicas (M)
32. Lead enrichment Apollo/Lusha refinado (M)
33. Email marketing broadcast (G)
34. Forms pop-up / exit-intent (M)

## 🔴 Onda 8 — Calendário & Booking (2 semanas)

35. Sync Google/Outlook Calendar (G)
36. Booking pages públicas (G)

## 🟨 Onda 9 — IA / Breeze (rolling)

37. Resumo automático de conversa/call (M)
38. Smart compose em WhatsApp/email (M)
39. AI properties (M)
40. Sentiment de mensagens (M)
41. Prospecting agent (G)

## ⚫ Onda 10 — Plataforma (sob demanda)

42. API pública REST + API keys (G)
43. Webhooks de saída (M)
44. Two-way sync HubSpot (G)
45. Custom Objects (G)
46. PWA mobile + push (M)
47. i18n pt/en/es (M)
48. White-label (M)
