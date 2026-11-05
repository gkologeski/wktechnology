# Etapa 6 — ciclo de vida e conciliação assistida

## Conciliação assistida

A central existente `/projects/settings/imports/reconciliation?tab=review` recebe a aba Lotes assistidos. A aba Negócios continua sendo a porta canônica para vínculos comerciais: não se deduz negócio/contrato por nome nem se cria outro projeto durante a conciliação.

Prévia somente leitura de até 100 registros por página; apontamentos limitados a até 94 dias por consulta. Empresas vêm da FK da origem sem conflito entre provedores/mapeamentos. Pessoas exigem e-mail único dos dois lados, identidade coerente e ausência de vínculos contraditórios; alocação exige uma única vigência compatível com pessoa e projeto. Ausência de evidência mantém o registro na revisão existente. Não são alterados bruto, staging, duração, situação de aprovação, faturamento ou acesso de pessoas.

Aplicação exige seleção explícita, chave `techprojects.reconciliation.manage.workspace`, administrador ativo no workspace ativo e ausência de modo somente leitura. O banco recalcula a evidência e compara a prévia completa e o `xmin` da origem sob trava. Uma alteração invalida a seleção inteira; não existe aplicação parcial silenciosa. ID de lote torna repetição idempotente somente para a mesma seleção.

A aplicação usa a trilha nativa `project_link_batches`/`project_link_changes`; `project_link_review_rows` guarda o grupo de campos de cada registro e sua versão após o vínculo. Reversão compara todos os valores e a versão antes de alterar a linha uma única vez. Qualquer edição posterior, inclusive editar e voltar ao valor anterior, impede a reversão daquela linha. O caminho legado de reversão encaminha lotes assistidos para essa mesma proteção e recusa desvinculação ampla que os alcance. Reversão de dados é auditada; não apaga a trilha.

Operação administrativa de manutenção: o lote é curto e a aplicação bloqueia gravações concorrentes em apontamentos e nas fontes de evidência durante a transação para impedir decisões baseadas em identidades que mudaram. Limite de 100 e timeout de 15 segundos; erro reverte todo o lote. Fazer lotes fora dos horários de maior uso se necessário. A prévia não obtém esse bloqueio e pode ser invalidada por alterações legítimas.

A tabela auxiliar não concede leitura/escrita direta ao navegador; RPCs verificam workspace, chaves, negações e membership atuais. Histórico da aba retorna só 20 resumos, sem recarregar a central inteira nem expor a seleção completa de cada lote.

## Aceite

Testes PostgreSQL descartável carregam as funções reais da nova migração, sem conexão com URLs de produção. Cobrem cinco cenários distintos de autorização, fontes ambíguas/alteradas, manipulação da prévia, concorrência/idempotência, reversão agrupada, ABA, preservação de horas e bloqueio de escrita direta no diário. Os claims são fixture SQL; isso não representa login GoTrue nem aceite visual com sessão real.

O ensaio do schema e da consulta em produção é executado em transação com ROLLBACK. Nenhum lote histórico é aplicado automaticamente ao publicar. A escolha dos vínculos reais é uma decisão operacional posterior do administrador na tela.

## Ciclo de vida do vínculo

No painel Contratação integrada e acessos da pessoa, o botão Renovação, substituição e encerramento abre uma prévia e o histórico. Novas chaves de workspace: `techpeople.lifecycle.view`, `.manage` e `.approve`. Não são atribuídas a todos os cargos. Escopo de pessoa e alocação permanece obrigatório; a execução que amplia acesso existente também exige administrador e `system.roles.manage.workspace`.

O pedido fixa a versão do vínculo, alocações, documentos, demanda e alçada. A escolha dos aprovadores reaproveita `hiring_area_policies`, inclusive os delegados quando o solicitante seria aprovador. Falta de gestor/CEO/delegado bloqueia; Área Técnica continua sem aprovador até escolha explícita. Notificações internas apontam a ficha da pessoa. Gestor decide primeiro, CEO depois (se forem a mesma pessoa autorizada, uma decisão cobre ambas as posições). Autoaprovação, inatividade, deny, alteração da alçada/origem/documentos e repetição com outra seleção são recusados. Aplicação revalida as duas decisões e grava diário.

- Renovar: contrato de contratação e, para cliente, contrato comercial com assinatura válida devem cobrir o período. A operação não assina nem altera documento/preço. Mantém a alocação anterior e acrescenta período contíguo; atualiza a vigência do vínculo após aprovação.
- Substituir: outro vínculo já admitido, mesma entidade WK/finalidade/contrato comercial. Não cria pessoa ou admissão. Encerra só a alocação escolhida e cria a alocação do substituto pela porta canônica; sobreposição exige seleção explícita aprovada.
- Encerrar alocação: corte inclusivo; vínculo, pessoa, membership e demais origens permanecem. Horas posteriores, inclusive sem vínculo direto mas atribuíveis à mesma pessoa/projeto, bloqueiam o corte.
- Encerrar vínculo: somente alocações e concessões dessa origem; acessos manuais e outros vínculos permanecem. Data futura limita a efetividade do pacote e das alocações; não antecipa a revogação. O fuso operacional de datas é America/Sao_Paulo. Não termina automaticamente o contrato comercial nem o contrato de compra.
- Compromissos futuros: pedido separado com alçada Financeira e CEO, até 100 IDs explícitos e permissões canônicas de consulta/cancelamento financeiro. Não usa vencimento para presumir competência. Apenas pagar futuro de competência posterior ao mês do corte, origem de contratação comprovada, sem pagamentos, cobranças, parcelas filhas, medições ou horas na competência. Mês corrente/trabalhado e títulos pagos permanecem protegidos. A seleção/origem é revalidada sob trava na execução; nada é cancelado por simplesmente encerrar uma alocação/vínculo.

As ações amplas legadas de desligamento são bloqueadas quando alcançam vínculos governados; cancelamento automático de agendas por vencimento é bloqueado no workspace ativado. Nenhuma promessa de quitação fiscal, pagamento, assinatura ou contratação resulta de um pedido de ciclo de vida.

## Compatibilidade com o schema preliminar remoto

O construtor remoto criou um schema de rascunho denominado 0305, antes de entregar o código/gate global. Não foi publicado nem ativado e tinha zero pedidos. A migração nova 0321 reconhece especificamente esse formato, exige zero uso e gate desativado, arquiva suas tabelas/funções em schema privado sem grants e preserva as FKs adicionais. Nenhuma migração antiga/journal é reescrita e nenhum registro é apagado. Se houver uso real, a adoção automática recusa a alteração para exigir conciliação específica.

Os helpers canônicos publicados de acesso/encerramento são mantidos; controles novos substituem os gatilhos exclusivos do protótipo. Os testes executam os mesmos cenários tanto em instalação limpa quanto após carregar a migração preliminar, para evitar drift entre o teste e o banco existente. O aceite operacional não executa pedidos reais nem lotes históricos.

Reversões de lotes anteriores sem versão de origem persistida ficam bloqueadas para revisão manual: igualdade do valor atual não prova ausência de edições intermediárias. O endpoint global sem prévia não cria novos lotes; a antiga aba direciona novas aplicações para Lotes assistidos. Sugestões ambíguas permanecem na revisão humana existente, sem aplicação automática.
