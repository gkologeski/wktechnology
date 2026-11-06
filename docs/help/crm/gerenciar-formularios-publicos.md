---
module_key: crm
slug: gerenciar-formularios-publicos
title: Gerenciar formulários públicos
summary: Configurar formulários cujos envios geram leads ou contatos.
article_type: howto
route_pattern: /forms
min_permission: techsales.marketing.forms.view.workspace
audience: internal
sort_order: 504
version: 2
is_published: true
---
# Gerenciar formulários públicos
**Para que serve:** Criar formulários públicos para captar leads ou contatos.
**Quem pode fazer:** Gestor+ ou `techsales.marketing.forms.view.workspace`/`.manage.workspace`. Alterar exige gerenciamento.
**Onde fica:** Menu > TechSales > Captar > Formulários (`/forms`).
**Antes de começar:** Defina se os envios geram leads ou contatos.

## Passo a passo
1. Clique em "Novo formulário".
2. Preencha "Nome", "Slug (URL pública)" e "Cria como".
3. Configure os campos e marque os obrigatórios.
4. Ajuste mensagem de sucesso e redirecionamento.
5. Configure a apresentação e a distribuição das inscrições: dono do formulário (padrão), membro específico ou rodízio.
6. Salve.
7. Para alterar, abra a edição e salve de novo.
8. Para ver envios, use a ação de visualização.
9. Para excluir, use a lixeira e confirme.
<!-- screenshot: edição do formulário com campos e distribuição -->

## Resultado esperado
"Formulário salvo". Cada envio gera lead ou contato, e o responsável é avisado.

## Regras e limites
- Tipos de campo: texto, e-mail, telefone, texto longo, seleção e número.
- Campos iniciais: "Nome", "Email", "Telefone" e "Mensagem"; "Nome" e "Email" começam obrigatórios.
- Em "Modo", escolha "Inline", "Pop-up" ou "Slide-in". Pop-up e slide-in usam "Gatilho", "Atraso (s)" ou "Scroll (%)".
- Registros existentes mantêm o responsável. Membros inativos não entram no rodízio; sem membros disponíveis, vale o dono.

## Erros comuns
A tela mostra a mensagem devolvida pelo servidor quando salvar ou excluir falha.

## Relacionados
- [Criar landing pages](/ajuda/crm/criar-landing-pages)
- [Gerenciar pesquisas](/ajuda/crm/gerenciar-pesquisas)
