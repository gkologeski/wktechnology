---
module_key: crm
slug: configurar-campanha-de-prospeccao
title: Configurar público e roteiros de uma campanha
summary: Ajuste a janela de discagem, o público e as variantes de roteiro da campanha.
article_type: howto
route_pattern: /prospecting/campaigns/$id
min_permission: techsales.prospecting_search.view.workspace
audience: internal
sort_order: 402
version: 1
is_published: true
---
# Configurar público e roteiros de uma campanha
**Para que serve:** Definir quem recebe ligações e como os roteiros são escolhidos.
**Quem pode fazer:** Usuários com acesso às campanhas de voz. Alterar exige `techsales.prospecting_voice.update.workspace`.
**Onde fica:** Menu > TechSales > Prospecção > Campanhas > Campanha (`/prospecting/campaigns/$id`).
**Antes de começar:** Crie a campanha e os roteiros de ligação.

## Passo a passo
1. Abra a campanha pelo nome.
2. Revise "Nome" e "Modo de atribuição".
3. Preencha "Máx. tentativas por lead" e "Intervalo entre tentativas (min)".
4. Ajuste "Janela início", "Janela fim" e "Dias da semana".
5. Configure "Público da campanha".
6. Configure as variantes em "Script" e o "Peso", se usar atribuição por peso.
7. Salve e aguarde "Salvo".
8. Revise tentativas e indicadores por variante.
<!-- screenshot: configuração da campanha com janela, público e variantes de script -->

## Resultado esperado
A campanha usa a configuração salva. As tentativas alimentam os indicadores por variante.

## Regras e limites
O público pode ser estático ou dinâmico. A distribuição pode ser por peso ou por segmento. Salvar a configuração não dispara ligações.

## Erros comuns
"Erro" aparece quando a falha não traz descrição. Revise os dados e salve de novo.

## Relacionados
- [Criar e gerenciar campanhas de prospecção](/ajuda/crm/criar-gerenciar-campanhas-de-prospeccao)
- [Criar e editar roteiros de ligação](/ajuda/crm/criar-editar-roteiros-de-ligacao)
