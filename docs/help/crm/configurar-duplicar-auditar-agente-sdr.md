---
module_key: crm
slug: configurar-duplicar-auditar-agente-sdr
title: Configurar, duplicar e auditar o agente SDR
summary: Ajuste o agente de IA, crie uma cópia e acompanhe atendimentos e resultados.
article_type: howto
route_pattern: /agents/sdr
min_permission: techsales.marketing.sdr_agent.view.workspace
audience: internal
sort_order: 410
version: 1
is_published: true
---
# Configurar, duplicar e auditar o agente SDR
**Para que serve:** Configurar identidade e operação do agente, criar cópia e acompanhar resultados.
**Quem pode fazer:** Quem tem `techsales.marketing.sdr_agent.view.workspace` ou `.manage.workspace`, ou gestor+. Alterar exige gerenciamento.
**Onde fica:** Menu > TechSales > Captar > Agente SDR (`/agents/sdr`).
**Antes de começar:** Escolha o agente.

## Passo a passo
1. Em "Operação", abra "Auditoria" para ver o que a auditoria automática refez e as falhas.
2. Abra "Em atendimento" para as conversas em curso.
3. Em "Estúdio", selecione o agente.
4. Em "Persona e teste", revise "Nome do assistente", "Descrição", "Intenção do agente" e "Tom principal".
5. Revise "Exemplos do jeito certo" e "Expressões a evitar" e teste a conversa.
6. Salve o rascunho. Publique só quando estiver pronto.
7. Em "Configuração do agente", revise situação, roteiro, qualificação, agenda, WhatsApp e passagem para humano.
8. Consulte "Habilidades e ferramentas", "Portfólio e materiais" e "Regras gerais".
9. Para copiar, clique em "Duplicar" e confirme.
10. Em "Resultados", veja conversas, qualificações e reuniões dos últimos 30 dias.
<!-- screenshot: áreas Operação, Estúdio e Resultados e ação Duplicar -->

## Resultado esperado
Rascunho salvo sem mudar a versão publicada. A cópia é um agente independente.

## Regras e limites
Não há aprovação manual: cada mensagem é auditada antes do envio e refeita se violar regras; falhas persistentes vão para humano. A cópia nasce desativada e sem número de WhatsApp. "Portfólio e materiais" e "Regras gerais" valem para todo o workspace. Público, disparos e limites pertencem à campanha.

## Erros comuns
- "Falha no teste: ...": leia o complemento.
- "Rascunho salvo (a versão publicada não mudou)" é confirmação, não erro.

## Relacionados
- [Configurar canais e planejamento de uma sequência](/ajuda/crm/configurar-canais-planejamento-de-sequencia)
- [Permissões](/ajuda/crm/permissoes)
