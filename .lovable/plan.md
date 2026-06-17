# Conversão para WYSIWYG (RichHtmlEditor) — todos os 36 itens

Vamos padronizar todos os textareas de redação listados anteriormente para o mesmo `RichHtmlEditor` já usado em Notas, Propostas e Timeline. Os dados continuam salvos no mesmo campo (em HTML), e a listagem usa `htmlToPlain()` para preview, como já fazemos em Notas.

Como o escopo é grande (36 telas), proponho executar em **4 lotes** para manter qualidade, revisar a cada lote e evitar regressões.

## Padrão técnico aplicado em todos os itens

- Substituir `<Textarea>` por `<RichHtmlEditor value={html} onChange={setHtml} />`.
- Persistência: continua no mesmo campo (string HTML).
- Exibição em listas/cards: `htmlToPlain(value).slice(0,N)`.
- Envio de e-mail: o `body_html` já é HTML — sem migração de dados.
- Em telas que usam `EntityList`/`CrudSettings`, trocar `type: "text"` por `type: "html"` (já suportado).
- Tokens/variáveis (`{{first_name}}`, etc.) continuam funcionando — o editor permite digitar texto livre.

## Lote 1 — Comunicação (alto impacto)

1. E-mail Compor/Responder (`send-email-dialog.tsx`)
2. Templates de e-mail (`settings.email-templates.tsx`)
3. Sequências — passo de e-mail (`sequence-builder.tsx`)
4. Campanhas E-mail (`campaigns.email.tsx`)
5. Inbox — composição de resposta (já cobre via SendEmailDialog do item 1)

## Lote 2 — Suporte/Atendimento

6. Tickets — descrição e respostas (`tickets.tsx`, `tickets.$id.tsx`)
7. Abrir chamado interno (`bug-report-dialog.tsx`)
8. Resolver chamado (`resolution-dialog.tsx`)
9. Meus chamados — comentários (`my-bug-reports.tsx`)
10. Macros (`settings.macros.tsx`)
11. Base de Conhecimento (`settings.kb.tsx`)

## Lote 3 — CRM/Vendas

12. Detalhes do Negócio — descrição (`deal-detail-drawer.tsx`)
13. Cotações — observações (`deal-quotes.tsx`)
14. Converter lead em negócio (`create-deal-from-lead-dialog.tsx`)
15. Atividades em lote (`bulk-create-activity-dialog.tsx`)
16. Reuniões — agenda/notas (`meeting-dialog.tsx`)
17. Templates de cotação/proposta (`template-editor.tsx`)
18. Scripts de prospecção (`settings.prospecting-scripts.tsx`)
19. Campanha de prospecção (`prospecting.campaigns.$id.tsx`)
20. Construtor de listas — descrição (`list-builder.tsx`)
21. Fila de tarefas — notas (`tasks.queues.$queueId.play.tsx`)
22. Discador — notas pós-ligação (`call-dialer.tsx`)

## Lote 4 — Portais e Configurações de conteúdo

23. Portal do cliente — mensagens (`portal.$token.tsx`)
24. Booking — descrição (`book.$slug.tsx`)
25. Configurações de Booking (`settings.booking.tsx`)
26. Formulários — descrições/agradecimento (`settings.forms.tsx`)
27. Pesquisas — perguntas long text
28. Produtos — descrição (`settings.products.tsx`)
29. Metas — descrição (`settings.goals.tsx`)
30. Recorrências — observação (`settings.recurring.tsx`)
31. Grupos de usuários — descrição (`settings.user-groups.tsx`)
32. Papéis/Roles — descrição (`settings.roles.*`)
33. Propriedades customizadas — help text (`settings.custom-properties.tsx`)
34. Dashboards — descrição (`dashboards.tsx`)
35. Relatórios — descrição (`reports.tsx`)
36. Branding — textos longos (`branding/controls-panel.tsx`)

## Como vou proceder

Posso começar imediatamente pelo **Lote 1 (Comunicação)** nesta mesma resposta e seguir lote a lote nas próximas mensagens (você revisa, eu avanço). Se preferir, posso reordenar/priorizar diferente — me diga.

**Confirmar para começar pelo Lote 1?**
