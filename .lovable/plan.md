# NOTIFICA-CENTRAL — Prompt de pesquisa para a Central de Notificações

Porte P, cerca de 10 minutos. Entrega: um arquivo de texto com o prompt abaixo, salvo em Arquivos como `prompt_central_notificacoes.md`. Nenhuma alteração no app.

## Prompt para o ChatGPT/Codex

```text
Código do plano: NOTIFICA-CENTRAL. Pesquisa e proposta, SOMENTE LEITURA: não edite código, não aplique SQL e não publique.

Contexto: o TechERP (WK Technology) é um ERP/CRM multi-tenant em PT-BR com seis módulos: TechSales (crm), TechHire (ats), TechPeople (people), TechContracts (contracts), TechFinance (finance) e TechProjects (projects). Hoje existem:
- preferências por usuário em /settings/notifications (no app, e-mail, som, tremor) para poucas categorias;
- sino no topo (NotificationsBell) com tempo real;
- motor de Workflows (eventos + ações), que é o meio preferido para ligar módulos;
- Slack por canal;
- conexão oficial com o WhatsApp Business (Cloud API e conector Lovable), com modelos aprovados pela Meta, janela de 24 h e números bloqueados.
São poucos os eventos que geram aviso, e não dá para escolher bem quem recebe.

Objetivo: pesquisar na internet o que há de melhor e mais moderno em centrais de notificação e propor a central do TechERP, com o WhatsApp como canal oficial.

1. Pesquise e cite as fontes (links) de sistemas de referência: HubSpot, Salesforce, Pipedrive, Zoho, Odoo, Linear, Jira/Atlassian, ClickUp, Asana, Monday, GitHub, Slack, Greenhouse, Ashby, Workday, BambooHR, Stripe, QuickBooks/Conta Azul, Omie, e plataformas de notificação (Novu, Knock, Courier, OneSignal, SuprSend, MagicBell). Indique o que cada um faz de melhor.
2. Levante as boas práticas: catálogo de eventos, regras por destinatário, escolha de canal, resumos (digest), horário de silêncio, escalonamento, lembretes recorrentes, agrupamento, deduplicação, prioridades, ações direto na notificação, cancelar inscrição por evento, trilha de entrega e leitura, tentativas e falhas, e LGPD (consentimento, saída, dados mínimos).
3. WhatsApp como canal oficial: regras da Meta para notificar usuários internos e externos (modelos UTILITY/MARKETING, aprovação, janela de 24 h, opt-in/opt-out, custo, limites e qualidade), qual número usar, o que fazer quando falhar ou cair fora da janela (troca para e-mail ou app) e como evitar spam.
4. Monte uma matriz de eventos por módulo, sem se limitar a estes exemplos: início de projeto, projeto ou tarefa atrasada, marco perto do prazo, negócio ganho/perdido, mudança de etapa, proposta aceita, minuta aceita, contrato perto da renovação/vencimento, assinatura concluída, contas a pagar e a receber do dia ou vencidas, NF recebida, inscrição em vaga, entrevista marcada, oferta aceita, aprovação pendente, início de vínculo, documento vencendo, SLA estourado, mensagem recebida, menção. Para cada evento: gatilho, destinatários possíveis (responsável, criador, gestor da área, cargo aprovador, time, seguidores, contato externo), canais padrão, urgência, se pode ser resumo e dado sensível que não pode aparecer.
5. Destinatários: como resolver gestor, cargo aprovador e substitutos usando as regras já existentes, sem inventar nomes, sem passar do CEO automaticamente e respeitando permissões, membro ativo, workspace e negação.
6. Configuração: o que o administrador define por workspace (regras, modelos, canais permitidos, obrigatórios) e o que cada usuário ajusta (canais, resumo, silêncio), com ligação ao motor de Workflows em vez de código fixo.
7. Proponha telas (central de notificações, regras, modelos, histórico de entregas), modelo de dados, permissões novas e pacotes de entrega pequenos (P/M) com estimativa de tempo e porte.

Formato da resposta: resumo, tabela comparativa das referências, boas práticas, regras do WhatsApp, matriz de eventos, proposta de arquitetura e telas, riscos, pacotes e perguntas que só o dono do produto pode responder. Separe fato com fonte de recomendação.
```

## Passos
1. Salvar o prompt em Arquivos.
2. Mostrar o arquivo no chat.
