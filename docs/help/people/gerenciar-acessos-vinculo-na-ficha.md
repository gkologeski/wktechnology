---
module_key: people
slug: gerenciar-acessos-vinculo-na-ficha
title: Preparar acesso e encerrar vínculos pela ficha
summary: Consultar a contratação integrada, preparar convites e revisar acessos por vínculo.
article_type: howto
route_pattern: /people/$id
min_permission: techpeople.employment.view.workspace
audience: internal
sort_order: 128
version: 2
is_published: true
---
# Preparar acesso e encerrar vínculos pela ficha

**Para que serve:** Consultar a contratação integrada, preparar convites e revisar acessos por vínculo.
**Quem pode fazer:** Além de ver a pessoa e a aba Alocações, o painel exige techpeople.employment.view.workspace. As operações exigem techpeople.employment.manage.workspace no cliente e no servidor. Convites e revisão de modelo também exigem system.roles.manage.workspace para aparecer na interface.
**Onde fica:** TechPeople > Pessoas > abrir a ficha > Alocações > Contratação integrada e acessos (`/people/$id`).
**Antes de começar:** Tenha um vínculo do novo fluxo e um modelo ativo aplicável. Cadastros históricos não são convertidos automaticamente.

## Passo a passo
1. Abra Alocações e localize "Contratação integrada e acessos". Confira origem, entidade WK, vigência e versão do acesso do vínculo correto.
2. Para preparar acesso, clique em "Preparar convite de acesso"; se já houver convite preparado, use "Obter convite preparado". Confira o campo de link retornado e compartilhe apenas por canal autorizado; a preparação não envia mensagem automaticamente.
3. Quando a tela indicar "Acesso do vínculo aplicado", confira a situação antes de tentar preparar novo convite.
4. Para mudar o pacote, clique em "Revisar modelo de acesso", escolha um modelo ativo, registre o motivo e confirme no diálogo. A revisão substitui a concessão desse vínculo, preservando outras origens.
5. Quando o fluxo de ciclo de vida integrado não estiver habilitado e o vínculo estiver ativo, para finalizar a relação, clique em "Encerrar este vínculo", revise o aviso, informe o motivo e confirme em "Encerrar vínculo e seus acessos".
6. Aguarde "Operação concluída." e confira novamente a situação e as alocações do vínculo.

## Renovar, substituir ou encerrar com aprovação

Quando o ciclo de vida integrado estiver ativo, use **Renovação, substituição e encerramento** no vínculo correto. Ver o diálogo exige `techpeople.lifecycle.view.workspace`; preparar e executar exige `techpeople.lifecycle.manage.workspace`, além do acesso à pessoa e à alocação. Uma permissão de workspace não dispensa o escopo do registro.

1. Escolha a operação e, quando aplicável, a alocação. Informe a data efetiva e uma justificativa; renovação também exige o novo término e contratos já revisados.
2. Consulte a prévia e confira origens, vigência e impactos. Consultar não executa a mudança.
3. Solicite aprovação. O gestor da área aprova primeiro e o CEO depois, com `techpeople.lifecycle.approve.workspace` e alçada vigente. O solicitante não aprova sua própria mudança.
4. Execute a versão aprovada. Se a origem, o contrato ou a alçada mudarem, refaça a prévia e a aprovação.
5. Confira o resultado e o histórico. Encerrar uma alocação preserva a pessoa, os outros vínculos e os acessos de outras origens; horas posteriores ao corte impedem o encerramento.

A operação **Revisar compromissos futuros** exige também a permissão financeira correspondente, seleção explícita de compromissos elegíveis e aprovação do gestor Financeiro e CEO. Não cancela pagamentos, competências trabalhadas ou títulos protegidos automaticamente.

## Resultado esperado
O contexto é recarregado após a operação; o convite preparado fica disponível como link. Encerrar afeta as alocações e o pacote de acesso originados naquele vínculo.

## Regras e limites
- Os botões operacionais descritos ficam na seção de vínculos ativos. Com lifecycle_enabled, o botão de encerramento deste painel não aparece; não trate sua ausência como simples falha de permissão.
- Revisar modelo e encerrar vínculo exigem motivo de 10 a 2.000 caracteres, após remover espaços nas extremidades.
- Revisar modelo envia a revisão do vínculo para controle de concorrência no servidor.
- Encerrar um vínculo preserva os demais e os acessos manuais; não equivale a revogar todo o acesso da pessoa.
- Sem vínculo do novo fluxo, o painel informa que cadastros históricos permanecem preservados. Não crie vínculo apenas para contornar a ausência de acesso.

## Erros comuns
- Painel ausente: confira a aba Alocações e techpeople.employment.view.workspace.
- Ações ausentes: falta techpeople.employment.manage.workspace ou a ação não se aplica ao estado do vínculo.
- "Operação não concluída.": leia o erro apresentado, atualize o contexto e revise modelo, motivo e estado do vínculo.

## Relacionados
- [Usar a ficha da pessoa](/ajuda/people/usar-ficha-pessoa)
- [Permissões do TechPeople](/ajuda/people/permissoes)
