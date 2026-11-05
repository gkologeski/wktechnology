---
module_key: crm
slug: criar-editar-roteiros-de-ligacao
title: Criar e editar roteiros de ligação
summary: Configure scripts de voz, teste a abertura e arquive roteiros já usados.
article_type: howto
route_pattern: /prospecting
min_permission: techsales.prospecting_search.view.workspace
audience: internal
sort_order: 409
version: 1
is_published: true
---
# Criar e editar roteiros de ligação
**Para que serve:** Criar roteiros para ligações e preservar o histórico dos usados.
**Quem pode fazer:** Abrir exige `techsales.prospecting_scripts.view.workspace`; criar, editar e excluir exigem create, update e delete de `techsales.prospecting_scripts`. Arquivar e restaurar exigem update.
**Onde fica:** Menu > TechSales > Prospecção > Campanhas > Roteiros de ligação (`/prospecting`).
**Antes de começar:** Prepare objetivo, mensagem inicial e orientações do agente.

## Passo a passo
1. Abra "Roteiros de ligação" e clique em "Novo script".
2. Preencha "Nome" e "Objetivo".
3. Informe "Voz (ElevenLabs voice_id)" ou deixe vazio para a voz padrão.
4. Preencha "Mensagem de abertura" e "Prompt do sistema".
5. Para ouvir a abertura, clique no botão de reprodução ao lado da voz.
6. Salve.
7. Para editar, clique no nome do roteiro.
8. Para retirar um roteiro usado, clique em "Arquivar roteiro".
9. Ative "Mostrar arquivados" e use "Restaurar roteiro" quando precisar.
10. Roteiro sem uso: "Excluir roteiro" e confirme.
<!-- screenshot: formulário do script e lista com Mostrar arquivados -->

## Resultado esperado
"Script salvo", "Roteiro arquivado", "Roteiro restaurado" ou "Roteiro excluído".

## Regras e limites
Roteiros em uso são arquivados, não excluídos. Abertura e prompt aceitam variáveis como {{lead.name}} e {{lead.company}}.

## Erros comuns
- "Defina uma voz e a mensagem de abertura primeiro": preencha os dois campos.
- "Não foi possível carregar os roteiros.": recarregue.
- "Não foi possível concluir a ação.": confira sua permissão.

## Relacionados
- [Configurar público e roteiros de uma campanha](/ajuda/crm/configurar-campanha-de-prospeccao)
- [Criar o fluxo de uma sequência multicanal](/ajuda/crm/criar-fluxo-de-sequencia)
