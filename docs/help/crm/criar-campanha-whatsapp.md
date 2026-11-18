---
module_key: crm
slug: criar-campanha-whatsapp
title: Criar uma campanha de WhatsApp
summary: Preparar público, template, remetente e distribuição das conversas.
article_type: howto
route_pattern: /campaigns/whatsapp
min_permission: techsales.marketing.campaigns.view.workspace
audience: internal
sort_order: 310
version: 9
is_published: true
---
# Criar uma campanha de WhatsApp
**Para que serve:** Preparar disparos em massa com fila e controle de velocidade.
**Quem pode fazer:** Gestor+ ou `techsales.marketing.campaigns.view.workspace`/`.manage.workspace`. Salvar e executar exigem as ações de campanhas.
**Onde fica:** Menu > TechSales > Captar > Campanhas WhatsApp (`/campaigns/whatsapp`).
**Antes de começar:** Tenha público autorizado, canal e template aprovado.

## Passo a passo
A campanha é montada em 5 etapas, mostradas no topo: "Números", "Mensagem", "Público", "Atendimento" e "Ritmo e revisão". Use "Continuar" e "Voltar", ou clique numa etapa para ir direto a ela.
1. Clique em "Nova campanha".
2. Etapa "Números": preencha "Nome da campanha" e escolha o remetente. Com número oficial, use "Adicionar número" em "Rodízio de números" (até 4 números extras) e escolha "Intercalar em sequência" ou "Sortear". Em número oficial, preencha "Origem da autorização dos destinatários".
3. Etapa "Mensagem": em "Template", os modelos aparecem separados por número, no formato "6137-0317 › nome_do_modelo". Um modelo com o mesmo nome em dois números aparece duas vezes, uma em cada número. Para rodízio, use "Adicionar modelo ao rodízio" (até 4 modelos extras); escolher o mesmo modelo em outro número faz ele também sair por esse número. Escolha "Sequencial (A, B, C…)" ou "Aleatório com peso".
4. Etapa "Público": defina o público e, em "Variáveis do modelo", o campo de cada variável de cada modelo.
5. Etapa "Atendimento": para ativar o SDR, escolha um playbook (com número próprio, o agente vem travado pelo canal de atendimento). Escolha a distribuição: "Central de Distribuição (padrão)", "Membro específico" (um membro), "Dividir entre membros da equipe" (ao menos dois) ou "Desatribuídas".
6. Etapa "Ritmo e revisão": ajuste velocidade e intervalos, confira o resumo (use "Editar" para voltar a uma etapa) e clique em "Criar rascunho".
Ao editar uma campanha pausada, a tela abre direto em "Ritmo e revisão"; "Salvar alterações" fica disponível em todas as etapas.
![Tela: campanha WhatsApp com remetente, template e distribuição](/help-media/crm/criar-campanha-whatsapp.webp)

## Resultado esperado
"Campanha criada como rascunho". Ainda precisa ser iniciada.

## Regras e limites
- Público máximo: 5.000.
- Telefone no CRM não comprova consentimento.
- Números com qualidade `RED` ficam indisponíveis.
- O remetente não muda depois de iniciar.
- Rodízio de números: até 5 números oficiais; cada contato recebe sempre pelo mesmo número (respostas e Lia seguem nele). As listas "Template" e "Rodízio de modelos" mostram os modelos aprovados de todos os números escolhidos, com os números em que cada um está aprovado; o contato recebe o modelo por um desses números. Se um número cair durante o disparo, os contatos novos seguem pelos outros; quem já estava preso a ele aguarda, sem trocar de número.
- SDR só com template aprovado.
- O agente segue o canal de atendimento do número remetente principal; número sem agente para campanhas só aceita SDR desligado.
- Rodízio: até 5 modelos aprovados; cada contato recebe sempre o mesmo modelo; cada modelo tem as próprias variáveis, e só modelos aprovados na Meta para o número podem ser salvos. Em campanha pausada, ao salvar, as variáveis dos contatos ainda pendentes são atualizadas e as escolhas ficam salvas para a próxima edição, sem trocar o público.
- Disparo pode atrasar cerca de 1 minuto além do intervalo sorteado.

## Erros comuns
- "Adicione pelo menos um destinatário".
- "Escolha o público da campanha".
- "Escolha exatamente um membro para receber as conversas.".
- "Escolha ao menos dois membros para dividir as conversas.".
- "O SDR só pode ser ligado a campanhas com template aprovado.".
- "O agente desta campanha precisa ser o do número escolhido.": mantenha o agente do canal.
- "Este número não tem agente para campanhas; deixe o agente SDR desligado.".
- "O público passa de 5.000 destinatários. Refine os filtros.".

- "O modelo \"…\" não está aprovado na Meta para o número …".

## Relacionados
- [Controlar campanhas e entender bloqueios de números](/ajuda/crm/controlar-campanhas-bloqueios-whatsapp)
- [Enviar um modelo aprovado no WhatsApp](/ajuda/crm/enviar-modelo-aprovado-whatsapp)
