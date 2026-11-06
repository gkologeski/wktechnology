---
module_key: crm
slug: atender-conversas-whatsapp
title: Atender conversas de WhatsApp
summary: Atribuir responsáveis e enviar mensagens respeitando a janela de atendimento.
article_type: howto
route_pattern: /inbox/whatsapp
min_permission:
audience: internal
sort_order: 304
version: 1
is_published: true
---
# Atender conversas de WhatsApp
**Para que serve:** Responder clientes pelo WhatsApp e organizar os responsáveis.
**Quem pode fazer:** Membros ativos com TechSales licenciado. Ver, enviar e atribuir usam `view`, `create` e `assign` de `techsales.inbox.whatsapp`.
**Onde fica:** Menu > TechSales > Inbox unificada > WhatsApp (`/inbox/whatsapp`).
**Antes de começar:** Tenha um canal conectado e telefone válido.

## Passo a passo
1. Busque em "Buscar telefone, mensagem ou contato…".
2. Abra a conversa.
3. Em "Atribuir a…", escolha o responsável.
4. Com a janela aberta, escreva e use "Enviar mensagem".
5. Para enviar arquivo, use "Anexar mídia".
6. Para iniciar outro atendimento, clique em "Nova conversa".
7. Com a janela fechada, envie um modelo aprovado.
<!-- screenshot: Inbox WhatsApp com aviso de janela e compositor -->

## Resultado esperado
A mensagem fica registrada na conversa.

## Regras e limites
- Janela aberta: menos de 24 horas desde a última mensagem recebida do cliente. Mensagem enviada pela empresa não reabre a janela.
- Fora da janela: só modelo aprovado pela Meta.
- Texto até 4.096 caracteres; mídia até 16 MB.
- Responsável precisa ser membro ativo.
- Com agente SDR: "Agente atendendo · Assumir" ou "Humano atendendo · Devolver ao agente".
- Balões vermelhos indicam mensagens não entregues, com o motivo.

## Erros comuns
- "A janela de 24 horas terminou. Escolha um modelo aprovado pela Meta para continuar.": use um modelo.
- "Informe um texto, anexo ou template aprovado": preencha a mensagem.
- "Arquivo maior que 16MB (limite do WhatsApp)": reduza o arquivo.
- "Você não tem permissão para supervisionar o agente SDR.": peça a autorização.

## Relacionados
- [Enviar um modelo aprovado no WhatsApp](/ajuda/crm/enviar-modelo-aprovado-whatsapp)
- [Criar uma campanha de WhatsApp](/ajuda/crm/criar-campanha-whatsapp)
