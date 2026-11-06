---
module_key: crm
slug: conectar-gerenciar-calendarios
title: Conectar e gerenciar calendários
summary: Conectar o Google Calendar, testar e sincronizar eventos e gravações.
article_type: howto
route_pattern: /settings/calendars
min_permission: system.calendars.view.workspace
audience: internal
sort_order: 313
version: 2
is_published: true
---
# Conectar e gerenciar calendários
**Para que serve:** Integrar o Google Calendar, links do Meet e gravações.
**Quem pode fazer:** Gestor+ ou `system.calendars.view.workspace`/`.manage.workspace`; cada ação usa a chave de `system.calendars` correspondente.
**Onde fica:** Menu > TechSales > Relacionar > Reuniões > Calendários (`/settings/calendars`).
**Antes de começar:** Tenha acesso à conta Google.

## Passo a passo
1. Clique em "Conectar Google".
2. Autorize na nova aba.
3. Confira a conta.
4. Ligue ou desligue "Sync".
5. Ligue "Meet automático" para novas reuniões.
6. Clique em "Testar".
7. Use "Sincronizar agora".
8. Clique em "Sincronizar gravações".
9. Para remover, desconecte e confirme "Desconectar calendário?".
<!-- screenshot: conta de calendário com Sync e Meet automático -->

## Resultado esperado
"Google Calendar conectado com sucesso"; teste mostra "Conexão funcionando" ou "Falha na conexão".

## Regras e limites
- Sincronização em lotes, até 20 tentativas por clique.
- Gravações podem levar 10–30 minutos para o Google publicar.
- Lembretes de WhatsApp ficam em Configurações › Engajamento › Lembretes de reunião.

## Erros comuns
- "Falha na conexão": veja a etapa e refaça a autorização.
- "Finalize a conexão do Google na nova aba.".

## Relacionados
- [Criar e gerenciar páginas de agendamento](/ajuda/crm/criar-gerenciar-paginas-agendamento)
