# Dashboard da jornada do lead até a venda

## Objetivo

Evoluir o `/dashboard` para responder, em poucos segundos:

1. Quantos leads entraram no período?
2. Por quais canais eles entraram?
3. Quantos avançaram em cada etapa do funil de Leads?
4. Quantos viraram oportunidades e vendas?
5. Quais canais geram mais volume, melhor conversão e mais receita?

A jornada ficará em destaque no topo. Agenda, tarefas, negócios em risco e demais blocos operacionais atuais serão preservados abaixo, sem alteração das regras de negócio.

## Pesquisa de referência

A pesquisa em documentação oficial encontrou padrões consistentes nos principais CRMs:

- **HubSpot:** funis com ordem cronológica, conversão entre etapas e análise de jornada por pontos de contato; também distingue origem do registro de origem de tráfego/campanha. [Funis](https://knowledge.hubspot.com/reports/create-new-custom-funnel-reports) · [Jornada](https://knowledge.hubspot.com/reports/create-a-journey-report)
- **Pipedrive:** lead→negócio agrupado por origem, com taxa `(convertidos ÷ total)`, além de funil de negócios separado. [Conversão de leads](https://support.pipedrive.com/en/article/insights-reports-lead-conversion) · [Origem preservada](https://support.pipedrive.com/en/article/lead-source-deals)
- **Zoho CRM:** relatórios “Leads por origem”, “Leads por status”, “Vendas por origem” e funis configuráveis. [Funis](https://help.zoho.com/portal/en/kb/crm/analytics-and-dashboards/analytics-dashboards/articles/create-funnels)
- **Dynamics 365:** combina “Leads por origem”, pipeline, metas e atividades no mesmo painel. [Dashboards](https://learn.microsoft.com/en-us/dynamics365/sales/dashboards)
- **Salesforce:** separa origem simples do lead de influência multicanal por campanhas. [Campaign Influence](https://help.salesforce.com/s/articleView?id=sales.campaigns_influence_customizable_manage_parent.htm&language=en_US&type=5)
- **Freshsales:** usa painéis prontos com leads gerados, convertidos por origem, velocidade e funil de etapas. [Dashboards](https://support.freshsales.io/support/solutions/articles/228571-how-to-configure-the-reports-dashboard-in-freshsales-)

Padrão adotado: **ranking de canais para leitura exata de volume + jornada compacta para conversão + detalhamento por etapa**, sem copiar a identidade visual de outro produto.

## Diagnóstico confirmado

- O painel atual mostra funil de **negócios**, mas não o funil de Leads nem origem/canal.
- Há 5.895 leads no workspace: 5.888 têm origem preenchida e 7 estão sem origem.
- Nos últimos 90 dias existem 188 leads; 121 têm funil/etapa configurados e 23 estão marcados como convertidos.
- O funil de Leads configurado possui 7 etapas, de “Novo” a “Oportunidade Identificada”/“Desqualificado”.
- Existem 30 leads marcados como convertidos, mas apenas 8 ainda apontam para um negócio existente. Dos 22 vínculos quebrados, somente 6 têm um candidato único pelo contato principal e nenhum foi criado dentro de 24 horas da conversão. Portanto, uma correção automática baseada só no contato seria insegura.
- A tabela de pontos de atribuição está vazia; esta entrega usará **origem principal do lead**, não atribuição multicanal.

## Novo desenho

```text
PAINEL DE VENDAS
[Período] [Funil de Leads] [Pipeline de Negócios] [Canal] [Meus/Equipe]

┌──────────────┬──────────────┬──────────────┬──────────────┐
│ Leads novos  │ Qualificados │ Oportunidades│ Vendas       │
│ 188  +12%    │ 34  18,1%    │ 23  67,6%    │ 8  34,8%     │
└──────────────┴──────────────┴──────────────┴──────────────┘

┌────────────────────────────────────────────────────────────┐
│ CAMINHO DO LEAD ATÉ A VENDA                                │
│                                                            │
│ Prospecção  █████████ 132 ┐                                │
│ Site        ███        29 ├→ 188 Leads → 34 Qualificados   │
│ Mídia paga  ██         14 │       → 23 Oportunidades → 8   │
│ Indicação   █           7 ┘                    Vendas       │
│ Outros      █           6                                  │
│                  18,1%              67,6%          34,8%   │
└────────────────────────────────────────────────────────────┘

┌───────────────────────────────┬────────────────────────────┐
│ LEADS POR CANAL               │ FUNIL DE LEADS             │
│ [Volume | Conversão | Receita]│ Novo                 188    │
│ Prospecção  █████████  70%    │ Em contato           53%    │
│ Site        ███        15%    │ Em qualificação      31%    │
│ Mídia paga  ██          7%    │ Oportunidade         12%    │
│ ...                           │ Desqualificado        8%    │
└───────────────────────────────┴────────────────────────────┘

OPERAÇÃO COMERCIAL
[Negócios avançados] [Próximas reuniões]
[Contatos por dia]
[Precisam de atenção] [Funil de negócios]
[Minhas tarefas] [Leads a trabalhar]
[Fechamentos por mês]
```

Os números acima são apenas ilustração do layout; a tela usará os dados reais.

### Comportamento visual

- **Canais agrupados**: Prospecção, Site/Formulários, Mídia paga, Orgânico, Indicação, Eventos/Offline, Importação e Outros. A origem exata aparece no detalhe/tooltip.
- **Ranking horizontal**: ordenado por volume, com quantidade e participação sempre visíveis; alternância para conversão e receita sem depender apenas de tooltip.
- **Jornada**: mostra contagem e taxa entre Lead → Qualificado → Oportunidade → Venda. “Sem origem” aparece como categoria explícita.
- **Funil de Leads**: respeita exatamente as etapas configuradas em Configurações → Pipelines, incluindo cores e ordem.
- **Drill-down**: clique em canal ou etapa abre `/leads` com filtros equivalentes; vendas e oportunidades abrem a lista de negócios.
- **Responsividade**: em celular, jornada vira sequência vertical e ranking permanece legível; blocos operacionais seguem abaixo em coluna única.
- **Acessibilidade**: dados equivalentes em texto/tabela invisível para leitores de tela, foco por teclado, contraste AA e informação nunca dependente apenas de cor.

## Dados e reconciliação

1. Ampliar o DTO do painel com entradas por canal, etapas do funil de Leads, oportunidades, vendas, receita atribuída e cobertura dos vínculos.
2. Consultar Leads e Negócios no servidor com o mesmo workspace, RBAC e escopo “Meus/Equipe” já usados pelo painel.
3. Agrupar origens por normalização determinística, mantendo o valor original para auditoria e detalhamento.
4. Adicionar vínculo explícito e futuro entre negócio, lead e origem; a conversão manual passa a preservar esses dados ao criar o negócio.
5. Criar índices para período/origem e vínculo convertido, evitando degradação com crescimento da base.
6. Reconciliar o histórico de forma conservadora:
   - preservar os 8 vínculos válidos;
   - corrigir automaticamente somente correspondências determinísticas e comprováveis;
   - gerar relatório dos casos ambíguos/não recuperáveis, sem atribuir canal ou venda por suposição;
   - exibir no painel a cobertura da atribuição, para que receita parcial nunca pareça total.
7. Não inventar atribuição multicanal enquanto não houver pontos de contato; o painel informa “Origem principal”.

## Implementação

- Estender `sales-dashboard.types.ts`, `sales-dashboard.server.ts` e a server function existente, mantendo o arquivo `*.functions.ts` fino.
- Criar componentes presentacionais focados para:
  - jornada Lead → Venda;
  - ranking de canais;
  - funil de Leads;
  - indicador de cobertura da atribuição.
- Atualizar filtros da rota para funil de Leads, pipeline de Negócios e canal, persistidos na URL.
- Reutilizar `PageHeader`, `MetricCard`, `SectionHeader`, `EmptyState`, skeletons e gráficos sob demanda existentes.
- Usar apenas tokens semânticos do Design System e o Destaque do White Label; validar claro/escuro.
- Migration aditiva para vínculo e índices, com RLS/permissões preservados; nenhum dado histórico será sobrescrito sem correspondência segura.

## Avaliação UX/UI iterativa

### Nota atual confirmada: **4,8/10**

Principais perdas: jornada inexistente, todos os blocos com o mesmo peso, excesso de rolagem, funil que mostra somente negócios abertos, filtros sem canal e gráficos sem alternativa textual completa.

### Rubrica da revisão especializada

| Critério | Peso |
|---|---:|
| Jornada entendida em até 5 segundos | 20% |
| Hierarquia visual | 15% |
| Densidade e carga cognitiva | 15% |
| Adequação dos gráficos | 15% |
| Filtros e interação | 10% |
| Acessibilidade | 10% |
| Responsividade | 5% |
| Consistência com o Design System | 5% |
| Desempenho percebido | 5% |

Após cada versão renderizada, um agente especialista de UX/UI fará a avaliação nessa rubrica. Se a nota ponderada for inferior a **9,0**, serão ajustados os critérios com menor nota e o ciclo será repetido: renderizar → avaliar → corrigir → reavaliar. O aceite exige nota final ≥9,0 e nenhum critério principal abaixo de 8.

## Validação

- Testes unitários para agrupamento de canais, taxas, funil configurável, cobertura e casos sem origem/vínculo.
- Teste do caminho real: criar/converter lead → negócio → marcar ganho → confirmar origem, etapa, receita e drill-down no painel.
- Verificação visual em 375, 768, 1024 e 1440 px, claro/escuro, sem estouro horizontal.
- Navegação completa por teclado e auditoria de acessibilidade.
- `bun run typecheck`, `bun run lint`, `bun run test`, `bun run build` e testes direcionados.

## Fora do escopo

- Atribuição multicanal ponderada, CAC/ROI de mídia e sincronização de custos de campanhas.
- Mudanças nas etapas configuradas dos funis.
- Remoção dos blocos operacionais atuais.
