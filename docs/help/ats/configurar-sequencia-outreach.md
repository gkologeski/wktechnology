---
module_key: ats
slug: configurar-sequencia-outreach
title: Configurar uma sequência de outreach
summary: Ritmo, horários, passos e variantes A/B.
article_type: howto
route_pattern: /sourcing/sequences/$id
min_permission: 
audience: internal
sort_order: 67
version: 1
is_published: true
---
# Configurar uma sequência de outreach
**Para que serve:** Definir como e quando cada mensagem sai.
**Quem pode fazer:** Membros ativos com o TechHire licenciado. A tela não confere uma permissão própria; os dados respeitam o workspace.
**Onde fica:** Sourcing > Sequências > "Abrir" (`/sourcing/sequences/$id`).
**Antes de começar:** Crie a sequência.

## Passo a passo
1. Em "Throttling & quiet hours", ajuste "Fuso horário", "Limite diário", "Quiet hours (hora 0–23)" e "Dias de envio". Clique em "Salvar configurações".
2. Em "Adicionar step ou variante (A/B)", escolha "Posição", "Variante", "Peso", "Canal" e "Atraso (dias)".
3. Preencha o conteúdo do canal (por exemplo "Assunto" e "Corpo").
4. Clique em "Adicionar step".
<!-- screenshot: configurar sequência -->

## Resultado esperado
"Step adicionado" ou "Configurações salvas".

## Regras e limites
- Canais: Email, WhatsApp (tarefa), LinkedIn — Convite, LinkedIn — Mensagem, LinkedIn (tarefa manual), Espera, Aguardar aceite do convite.
- Convite do LinkedIn até 300 caracteres.
- Atraso de 0 a 180 dias; até 50 posições.
- Use "Aguardar aceite do convite" depois de um convite.

## Erros comuns
- Sem envio: confira os dias de envio e as quiet hours.

## Relacionados
- [Criar sequências de outreach](/ajuda/ats/criar-sequencias-outreach)
