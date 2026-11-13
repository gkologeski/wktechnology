---
module_key: crm
slug: configurar-campanha-de-prospeccao
title: Configurar uma campanha de ligação em 5 passos
summary: Público, roteiros, agenda, pós-ligação e revisão antes de iniciar a campanha.
article_type: howto
route_pattern: /campaigns/calls/$id
min_permission: techsales.marketing.campaigns.view.workspace
audience: internal
sort_order: 402
version: 9
is_published: true
---
# Configurar uma campanha de ligação em 5 passos
**Para que serve:** Definir quem recebe ligações, quais roteiros a IA usa, quando ligar e o que acontece depois.
**Quem pode fazer:** Usuários com acesso às campanhas (`techsales.marketing.campaigns`). Iniciar e pausar exige `techsales.marketing.campaigns.manage` e `techsales.prospecting_voice.create`.
**Onde fica:** Menu > TechSales > Captar > Campanhas de Ligação > Campanha (`/campaigns/calls/$id`). Links antigos de `/prospecting/campaigns/$id` abrem esta mesma tela.
**Antes de começar:** Crie a campanha e os roteiros de ligação.

## Passo a passo
1. **Público:** revise o "Nome" e escolha o público no mesmo quadro das Campanhas de WhatsApp: "Fila de prospecção" (filas de Leads ou de Contatos), "Criar público" (base Leads ou Contatos, segmentos salvos e grupos de condições) ou "Lista manual" (escolha a base e cole um telefone de Lead ou Contato já cadastrado por linha). Para Contatos, a ligação usa o celular e, sem ele, o telefone; o registro da ligação aparece na ficha do Contato. Marque "Não ligar para quem já é cliente" e "Não ligar para quem está em negociação aberta" conforme o caso e ajuste a regra de contato recente: escolha "Desconsiderar ligações realizadas de outra campanha" ou "Desconsiderar ligações e mensagens de WhatsApp realizadas de outra campanha" e informe "em até X dias" (padrão 7; 0 desliga).
2. **Roteiros:** escolha o "Modo de atribuição" e as variantes. No modo por peso, os pesos precisam somar 100%.
3. **Agenda:** máximo de tentativas, intervalo, janela de horário e dias da semana.
4. **Pós-ligação (opcional):** WhatsApp automático depois da ligação.
5. **Revisar e iniciar:** confira a lista. Cada item pendente mostra o motivo e o botão "Corrigir".
6. Use "Salvar rascunho" a qualquer momento. "Iniciar" só libera com a lista completa; depois vira "Pausar" e, pausada, "Retomar".

A contagem abaixo do quadro mostra quantos Leads ou Contatos entram e por que os outros ficaram de fora; marque um retirado para incluí-lo mesmo assim. Campanhas antigas mostram o montador anterior até você clicar em "Usar o novo quadro".

## Resultado esperado
Ao iniciar, entram na fila só os leads que passam nas regras. Quem foi retirado aparece na "Auditoria de enfileiramento" com o motivo.

## Regras e limites
A regra de contato recente só olha outras campanhas e apenas o que você pode ver. Ligações contam pela data da tentativa; WhatsApp conta envios concluídos de campanhas para o mesmo telefone. Salvar não dispara ligações.

## Erros comuns
"Iniciar" desligado: veja o motivo na barra inferior ou no passo 5.

## Relacionados
- [Criar e gerenciar campanhas de prospecção](/ajuda/crm/criar-gerenciar-campanhas-de-prospeccao)
- [Criar e editar roteiros de ligação](/ajuda/crm/criar-editar-roteiros-de-ligacao)

## Controles na lista de campanhas

Em **Campanhas de Ligação**, cada campanha mostra quantas ligações foram realizadas, quantas ficaram sem sucesso, quantas estão pendentes e quando a campanha começou. Os botões são:

- **Editar**: abre os 5 passos. Só funciona em campanhas em rascunho ou pausadas.
- **Duplicar**: cria uma cópia em rascunho com público, roteiros, agenda e pós-ligação, sem as ligações já feitas.
- **Iniciar / Retomar / Pausar**: controla a discagem.
- **Encerrar** (X): finaliza a campanha como **Cancelada**; as ligações que ainda estavam na fila não são feitas. Uma campanha cancelada não pode ser editada nem retomada, mas pode ser duplicada ou excluída.
- **Excluir**: só fora de "Em andamento". As ligações já feitas continuam registradas nas fichas.

### Ritmo

Com a campanha em andamento, a lista e o topo da ficha mostram uma **estimativa** da próxima ligação e do término, calculada pelas ligações na fila, pela janela de horário e pelos dias de discagem (o discador faz até 10 ligações a cada 2 minutos). Pausada, a campanha mostra "Pausada — sem previsão".

### Modelo aprovado no pós-ligação

No passo **Pós-ligação**, ao escolher o remetente do WhatsApp, a lista **Modelo aprovado** carrega sozinha os modelos aprovados pela Meta desse remetente. Se você trocar de remetente e o modelo salvo não existir nele, escolha um modelo novo.

## Distribuição das reuniões
No passo **4. Pós-ligação**, a seção **Distribuição das reuniões** define na agenda de quem a reunião é marcada, com as mesmas opções da campanha de WhatsApp:
- **Responsável do Lead/Contato:** usa a agenda do responsável. Se ele não tiver agenda conectada, os horários seguem pelo WhatsApp.
- **Membro específico:** todas as reuniões vão para a pessoa escolhida.
- **Dividir entre membros da equipe:** rodízio igual entre os membros marcados (mínimo 2).
- **Sem agendamento na ligação:** a assistente só combina de enviar os horários pelo WhatsApp (padrão).

Só aparecem para escolha membros ativos com agenda Google conectada; os demais são listados como "Sem agenda conectada". Com distribuição ligada, escolha a duração, quantos dias à frente oferecer e o modelo aprovado do WhatsApp que levará o link. O botão **Iniciar** só libera quando essa seção estiver completa.
