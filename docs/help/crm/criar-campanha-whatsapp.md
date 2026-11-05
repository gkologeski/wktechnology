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
version: 1
is_published: true
---
# Criar uma campanha de WhatsApp
**Para que serve:** Preparar disparos em massa com fila e controle de velocidade.
**Quem pode fazer:** Gestor+ ou `techsales.marketing.campaigns.view.workspace`/`.manage.workspace`. Salvar e executar exigem as ações de campanhas.
**Onde fica:** Menu > TechSales > Captar > Campanhas WhatsApp (`/campaigns/whatsapp`).
**Antes de começar:** Tenha público autorizado, canal e template aprovado.

## Passo a passo
1. Clique em "Nova campanha".
2. Preencha "Nome da campanha".
3. Escolha o remetente.
4. Em número oficial, preencha "Origem da autorização dos destinatários".
5. Escolha "Template" e preencha as variáveis.
6. Defina o público.
7. Escolha a distribuição: "Central de Distribuição (padrão)", "Membro específico", "Dividir entre membros da equipe" ou "Desatribuídas".
8. "Membro específico": um membro; dividir: ao menos dois.
9. Para ativar o SDR, escolha um playbook.
10. Ajuste velocidade e intervalos aleatórios.
11. Clique em "Criar rascunho".
<!-- screenshot: campanha WhatsApp com remetente, template e distribuição -->

## Resultado esperado
"Campanha criada como rascunho". Ainda precisa ser iniciada.

## Regras e limites
- Público máximo: 5.000.
- Telefone no CRM não comprova consentimento.
- Números com qualidade `RED` ficam indisponíveis.
- O remetente não muda depois de iniciar.
- SDR só com template aprovado.
- Disparo pode atrasar cerca de 1 minuto além do intervalo sorteado.

## Erros comuns
- "Adicione pelo menos um destinatário".
- "Escolha o público da campanha".
- "Escolha exatamente um membro para receber as conversas.".
- "Escolha ao menos dois membros para dividir as conversas.".
- "O SDR só pode ser ligado a campanhas com template aprovado.".
- "O público passa de 5.000 destinatários. Refine os filtros.".

## Relacionados
- [Controlar campanhas e entender bloqueios de números](/ajuda/crm/controlar-campanhas-bloqueios-whatsapp)
- [Enviar um modelo aprovado no WhatsApp](/ajuda/crm/enviar-modelo-aprovado-whatsapp)
