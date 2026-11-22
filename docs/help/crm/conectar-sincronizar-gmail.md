---
module_key: crm
slug: conectar-sincronizar-gmail
title: Conectar e sincronizar o Gmail
summary: Conectar uma conta Gmail, sincronizar mensagens e configurar a assinatura.
article_type: howto
route_pattern: /settings/email
min_permission:
audience: internal
sort_order: 312
version: 3
is_published: true
---

# Conectar e sincronizar o Gmail

**Para que serve:** Preparar o Gmail para enviar e receber e-mails no TechERP.
**Quem pode fazer:** Membros ativos; as ações seguem as permissões de contas de e-mail.
**Onde fica:** Menu > TechSales > Relacionar > Conexão de Email (`/settings/email`).
**Antes de começar:** Permita a abertura de nova aba.

## Passo a passo

1. Clique em "Conectar Gmail".
2. Na nova aba, autorize a conta Google.
3. Confira em "Contas conectadas".
4. Clique em "Sincronizar".
5. Na assinatura, preencha "Conteúdo" (ou "Editar HTML").
6. Clique em "Salvar assinatura".
7. Para redigir, "Novo email".
8. Para remover, "Desconectar".
   ![Tela: contas conectadas e assinatura](/help-media/crm/conectar-sincronizar-gmail.webp)

## Resultado esperado

"Gmail conectado com sucesso" e "Assinatura salva".

## Regras e limites

- Cada conta mostra estado, última sincronização e erro.
- A sincronização processa até 25 mensagens por rodada. Se houver mais mensagens novas, as restantes ficam guardadas para as próximas rodadas, sem serem descartadas.
- Uma falha ao buscar ou salvar uma mensagem mantém essa mensagem pendente para nova tentativa. Repetir a sincronização não duplica mensagens já salvas.
- Se um envio foi confirmado, mas ainda não apareceu no histórico, o registro é recuperado na próxima sincronização autorizada. Não reenvie apenas porque o registro demorou a aparecer.
- A carga inicial e a recuperação de histórico expirado não tornam mensagens antigas em novas ocorrências de workflow.
- "Limpar" esvazia o editor; salve para valer.

## Erros comuns

- "Sem permissão para visualizar contas de e-mail.".
- "Não foi possível carregar as contas.": "Tentar novamente".
- "Erro ao iniciar OAuth": libere novas abas e tente de novo.

## Relacionados

- [Responder e-mails na Inbox](/ajuda/crm/responder-emails-inbox)
- [Criar e agendar uma campanha de e-mail](/ajuda/crm/criar-campanha-email)
