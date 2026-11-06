---
module_key: ats
slug: editar-ficha-candidato
title: Editar a ficha do candidato
summary: Consultar e atualizar dados, candidaturas, entrevistas e ofertas.
article_type: howto
route_pattern: /candidates/$id
min_permission: techhire.candidates.view.own
audience: internal
sort_order: 21
version: 1
is_published: true
---
# Editar a ficha do candidato
**Para que serve:** Ver tudo sobre um candidato em um só lugar.
**Quem pode fazer:** Quem vê o candidato. Editar e excluir dependem da permissão sobre o registro. Atribuir responsável exige `techhire.candidates.assign.workspace`. Contratar exige `techpeople.people.create`.
**Onde fica:** Candidatos > clique no nome (`/candidates/$id`).
**Antes de começar:** Abra o candidato pela lista.

## Passo a passo
1. Edite "Nome", "Email", "Telefone", "LinkedIn", "Localização", "Cargo", "Empresa" ou "Notas".
2. Consulte "Aplicações", "Entrevistas", "Ofertas" e "Histórico".
3. Para associar a uma vaga, abra "Associar candidato à vaga", escolha "Vaga" e "Origem" e confirme.
4. Para falar pelo LinkedIn, use "Contato LinkedIn": aba "Mensagem" ou "Convite".
5. Para contratar, clique em "Contratar" e preencha "Vínculo", "Cargo", "Data de início" e "Custo/hora (R$)".
6. Para excluir, clique em "Excluir" e confirme.
<!-- screenshot: ficha do candidato -->

## Resultado esperado
"Atualizado" ao salvar; "Candidato contratado" ao contratar.

## Regras e limites
- Status: Novo, Em processo, Em entrevista, Em oferta, Contratado, Arquivado.
- Convite do LinkedIn: até 300 caracteres.
- Contratar cria a pessoa no TechPeople.

## Erros comuns
- "Este candidato já está nessa vaga.": ele já foi associado.
- "Erro ao salvar": confira os campos e sua permissão.

## Relacionados
- [Gerenciar candidatos](/ajuda/ats/gerenciar-candidatos)
- [Gerenciar ofertas](/ajuda/ats/gerenciar-ofertas)
