---
module_key: crm
slug: criar-campanha-email
title: Criar e agendar uma campanha de e-mail
summary: Definir público, conteúdo, teste e horário de envio.
article_type: howto
route_pattern: /campaigns/email
min_permission: techsales.marketing.campaigns.view.workspace
audience: internal
sort_order: 308
version: 1
is_published: true
---
# Criar e agendar uma campanha de e-mail
**Para que serve:** Enviar e-mails a um segmento com controle de velocidade.
**Quem pode fazer:** Gestor+ ou `techsales.marketing.campaigns.view.workspace`/`.manage.workspace`. Criar e alterar exigem as ações de `techsales.marketing.campaigns`.
**Onde fica:** Menu > TechSales > Captar > Campanhas Email (`/campaigns/email`).
**Antes de começar:** Tenha um segmento e uma conta Gmail própria autorizada.

## Passo a passo
1. Abra a criação de campanha.
2. Preencha "Nome interno" e "Lista (segmento)".
3. Se quiser, carregue "Template (opcional)".
4. Preencha "Assunto", "Corpo HTML" e "Corpo texto (fallback)".
5. Ajuste "Não enviar para quem recebeu e-mail de outra campanha nos últimos (dias)".
6. Defina "Envios por minuto".
7. Em "Enviar email de teste", envie para você.
8. Em "Agendamento", escolha "Enviar agora" ou "Agendar" e a "Data e hora".
9. Clique em "Agendar".
<!-- screenshot: formulário de campanha de e-mail -->

## Resultado esperado
"Campanha agendada".

## Regras e limites
- Nome, assunto e lista são obrigatórios.
- Velocidade: 1 a 600 por minuto (padrão 30).
- Envio recente: 0 a 365 dias (padrão 7; 0 desliga). Excluídos aparecem como "Envio recente".
- Variáveis: `{{first_name}}`, `{{last_name}}`, `{{full_name}}`, `{{email}}`, `{{company_name}}`.

## Erros comuns
- "Nome e assunto são obrigatórios".
- "Selecione uma lista (segmento)".
- "Nenhuma conta própria autorizada para envio.": conecte sua conta.
- "Nenhuma conta Gmail conectada".

## Relacionados
- [Acompanhar e controlar campanhas de e-mail](/ajuda/crm/controlar-campanhas-email)
- [Conectar e sincronizar o Gmail](/ajuda/crm/conectar-sincronizar-gmail)
