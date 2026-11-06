---
module_key: crm
slug: criar-gerenciar-campanhas-de-prospeccao
title: Criar e gerenciar campanhas de prospecção
summary: Crie uma campanha de ligação e controle sua execução pela lista.
article_type: howto
route_pattern: /prospecting/campaigns
min_permission: techsales.prospecting_search.view.workspace
audience: internal
sort_order: 401
version: 1
is_published: true
---
# Criar e gerenciar campanhas de prospecção
**Para que serve:** Criar campanhas de discagem automática e acessar sua configuração.
**Quem pode fazer:** Usuários liberados pelo menu Prospecção, com as permissões de voz `techsales.prospecting_voice.view/create/update/delete.workspace`, conforme a ação.
**Onde fica:** Menu > TechSales > Prospecção > Campanhas (`/prospecting/campaigns`).
**Antes de começar:** Defina o nome. Configure público e roteiros antes de iniciar.

## Passo a passo
1. Clique em "Nova campanha".
2. Preencha "Nome".
3. Clique em "Criar".
4. Clique no nome da campanha para configurar.
5. Use o botão de reprodução para iniciar (status running).
6. Use o botão de pausa para pausar (status paused).
7. Para remover, clique na lixeira e confirme "Remover?".
<!-- screenshot: lista de campanhas com status e ícones de reprodução, pausa e exclusão -->

## Resultado esperado
"Campanha criada" confirma. A tela abre os detalhes da campanha.

## Regras e limites
O nome é obrigatório. A campanha nasce com 3 tentativas, intervalo de 240 minutos e janela de segunda a sexta, 09:00–18:00 (America/Sao_Paulo), sem leads e sem roteiros.

## Erros comuns
"Nenhuma campanha ainda." indica lista vazia. Se "Criar" não fizer nada, confira o "Nome".

## Relacionados
- [Configurar público e roteiros de uma campanha](/ajuda/crm/configurar-campanha-de-prospeccao)
- [Criar e editar roteiros de ligação](/ajuda/crm/criar-editar-roteiros-de-ligacao)
