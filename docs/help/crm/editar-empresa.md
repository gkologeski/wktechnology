---
module_key: crm
slug: editar-empresa
title: Editar empresa
summary: Editar empresa.
article_type: howto
route_pattern: /companies/$id
min_permission:
audience: internal
sort_order: 121
version: 4
is_published: true
---
# Editar empresa
**Para que serve:** Editar empresa.
**Quem pode fazer:** Membro ativo com TechSales licenciado. O menu não exige chave específica. A edição exige `techsales.companies.update.own` ou `techsales.companies.update.workspace`, dentro do escopo autorizado. Uma negativa de acesso prevalece sobre concessões.
**Onde fica:** Menu > TechSales > Empresas (`/companies/$id`).
**Antes de começar:** Abra o workspace correto e localize os registros.
## Passo a passo
1. Abra o registro pela listagem.
2. No painel de propriedades, clique no campo que deseja alterar.
3. Informe o novo valor e saia do campo para concluir a edição.
4. Use **Nome** para o nome de exibição e **Razão social** / **Nome fantasia** para os dados empresariais oficiais. Quando o CNPJ estiver preenchido, o botão **Enriquecer via CNPJ** preenche Razão social, Nome fantasia e demais dados sem alterar o campo **Nome**; se algum campo já tiver valor diferente, o sistema pede confirmação antes de substituir.
5. Confira a mensagem "Atualizado".
![Tela: Editar empresa](/help-media/crm/editar-empresa.webp)
## Resultado esperado
A propriedade editada aparece atualizada na ficha.
## Regras e limites
A gravação ocorre por campo. Campos e opções dependem do catálogo da entidade e das permissões. Registros acessíveis apenas por vínculo podem mostrar somente um resumo, sem edição. Propostas comerciais, cotações e minutas de contrato usam a **Razão social** nativa da empresa, com alternativa para o campo personalizado legado `razao_social` e o campo **Nome**.
O avatar preserva o logotipo manual. Sem imagem manual, tenta o favicon do domínio corporativo; se indisponível, mostra as iniciais. O serviço externo de logos descontinuado não é consultado automaticamente.
## Erros comuns
"Email inválido.": revise o endereço. "CNPJ inválido.": revise o documento, quando o campo existir. "CEP inválido. Use 8 dígitos (99999-999).": corrija o CEP, quando disponível.
## Relacionados
[Permissões](/ajuda/crm/permissoes) · [Campos e status](/ajuda/crm/campos-e-status)
