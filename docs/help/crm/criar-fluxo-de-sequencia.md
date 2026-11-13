---
module_key: crm
slug: criar-fluxo-de-sequencia
title: Criar o fluxo de uma sequência multicanal
summary: Monte e salve as etapas de uma sequência sem iniciar disparos.
article_type: howto
route_pattern: /prospecting/sequences
min_permission: system.automation.sequences.view.workspace
audience: internal
sort_order: 404
version: 3
is_published: true
---
# Criar o fluxo de uma sequência multicanal
**Para que serve:** Planejar uma abordagem com etapas de e-mail, WhatsApp, chamada, espera, condição, tarefa, agente e encerramento.
**Quem pode fazer:** Quem tem `system.automation.sequences.view.own`, `.view.team` ou `.view.workspace`. Criar exige create; editar exige update.
**Onde fica:** Menu > TechSales > Sequências de prospecção (`/prospecting/sequences`).
**Antes de começar:** Para usar e-mail, conecte sua conta em Canais.

## Passo a passo
1. Clique em "Nova sequência".
2. Preencha "Nome da sequência".
3. Abra "Fluxo" e adicione as etapas.
4. Selecione cada etapa e preencha a configuração.
5. Use "Mover etapa para cima" ou "Mover etapa para baixo".
6. Use "Duplicar etapa" ou "Remover etapa".
7. Nas condições, revise "Critério", "Caminho Sim" e "Caminho Não".
8. Nas chamadas, revise "Modo de chamada" e "Roteiro da telefonia".
9. Clique em "Salvar rascunho".
![Tela: aba Fluxo com etapas e configuração da etapa selecionada](/help-media/crm/criar-fluxo-de-sequencia.webp)

## Resultado esperado
"Rascunho salvo. Nenhuma execução foi iniciada."

## Regras e limites
Nome até 120 caracteres. "Rascunhos recentes (até 100)" reabre rascunhos. Alterações não salvas pedem confirmação antes de trocar de rascunho. Não administradores enviam e-mail só pela própria conta; administradores escolhem a conta.

## Erros comuns
- "Informe o nome da sequência.": preencha o nome.
- "Este rascunho tem uma definição inválida e não foi aberto.": peça revisão.
- "Conecte sua conta de e-mail em Canais para usar passos de e-mail.": conecte a conta.

## Relacionados
- [Configurar canais e planejamento de uma sequência](/ajuda/crm/configurar-canais-planejamento-de-sequencia)
- [Validar e criar uma versão imutável de sequência](/ajuda/crm/validar-versionar-sequencia)
- [Reservar o público de uma sequência](/ajuda/crm/reservar-publico-de-sequencia)

## Etapa LinkedIn

Adicione LinkedIn, selecione sua conta habilitada em Canais e escreva a mensagem. As variáveis seguem o mesmo seletor das outras etapas. O público precisa ter uma URL pessoal válida do LinkedIn; pessoas sem esse dado pulam somente essa etapa. Combine com e-mail, WhatsApp, espera e condições na ordem necessária. A etapa envia uma mensagem; não envia convite de conexão nem compra InMail automaticamente. Se o provedor não permitir o contato, a execução registra a falha.

A resposta interrompe a cadência conforme a configuração e passa ao agente escolhido ou ao atendimento humano. O agente precisa estar habilitado para campanhas nessa conta. Limites e pausas Unipile adiam a mesma etapa, sem avançar e sem tentar contornar o bloqueio. Recibos confirmados alimentam a Inbox; resultados incertos exigem conciliação.
