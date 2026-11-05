INSERT INTO public.help_articles
  (module_key, slug, title, summary, body_md, article_type, route_pattern, min_permission, audience, sort_order, version, is_published)
VALUES
($hlp$contracts$hlp$, $hlp$acompanhar-dashboard$hlp$, $hlp$Consultar o Dashboard de contratos$hlp$, $hlp$Consultar o Dashboard de contratos no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Consultar o Dashboard de contratos
**Para que serve:** Consultar o Dashboard de contratos.
**Quem pode fazer:** Membro com acesso ao módulo e aos contratos consultados.
**Onde fica:** TechContracts > Contratos (/contracts/dashboard).
**Antes de começar:** Ter contratos visíveis para o seu acesso.

## Passo a passo
1. Abra TechContracts > Visão geral > Dashboard.
2. Consulte "Contratos ativos", "Valor contratado ativo", "Em aprovação ou assinatura" e "Vencem em 30 dias".
3. Veja "Carteira por status", "Próximos vencimentos", "Precisam de atenção" e "Contratos recentes".
4. Clique em um contrato para abrir sua ficha. Use "Atualizar" para consultar novamente ou "Ir para Contratos" para abrir a lista.
<!-- screenshot: Consultar o Dashboard de contratos, sem dados pessoais reais -->

## Resultado esperado
Indicadores e listas dos contratos acessíveis.

## Regras e limites
- Ativos incluem os status active e renewing. Aprovação ou assinatura inclui in_review, in_negotiation e awaiting_signature.
- Vencimentos considera os próximos 30 dias. Atenção inclui contratos ativos vencidos e os que aguardam aprovação ou assinatura.
- A consulta considera até 2.000 contratos mais recentes; listas auxiliares mostram até 8.
- O valor soma os valores cadastrados. Não há conversão multimoeda demonstrada; não use o indicador como total convertido.

## Erros comuns
Se a consulta falhar, tente "Atualizar". Uma lista vazia não comprova ausência de contratos fora do seu acesso.

## Relacionados
- [Visão geral](/ajuda/contracts/visao-geral)
- [Permissões](/ajuda/contracts/permissoes)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/dashboard$hlp$, NULL, $hlp$internal$hlp$, 10, 1, true),
($hlp$contracts$hlp$, $hlp$alterar-em-massa$hlp$, $hlp$Alterar status, responsável e campos em massa$hlp$, $hlp$Alterar status, responsável e campos em massa no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Alterar status, responsável e campos em massa
**Para que serve:** Alterar status, responsável e campos em massa.
**Quem pode fazer:** Atualização de cada contrato selecionado; status mantém regras de transição e ativação.
**Onde fica:** TechContracts > Contratos (/contracts).
**Antes de começar:** Conferir todos os contratos selecionados e o impacto da mudança.

## Passo a passo
1. Selecione os contratos na tabela.
2. Para status, escolha "Alterar status"; para atribuição, use "Definir responsável" ou "Sem responsável".
3. Para outros campos, clique em "Editar em massa" e use os campos disponibilizados pelo diálogo.
4. Confira o resumo de sucessos e falhas por contrato.
<!-- screenshot: Alterar status, responsável e campos em massa, sem dados pessoais reais -->

## Resultado esperado
Alterações feitas nos registros autorizados; pode haver resultado parcial.

## Regras e limites
- Seletores de status/responsável aplicam imediatamente, sem confirmação adicional.
- Cada contrato é processado em sequência; falha não interrompe os demais.
- Seleção só é limpa se o executor terminar sem falhas.
- A seleção não concede acesso a campos sensíveis ou a transições proibidas.

## Erros comuns
Resumo pode mostrar até três contratos com erro. Revise as falhas antes de repetir para evitar alterações desnecessárias.

## Relacionados
- [Consultar contratos](/ajuda/contracts/consultar-contratos)
- [Permissões](/ajuda/contracts/permissoes)$hlp$, $hlp$howto$hlp$, $hlp$/contracts$hlp$, NULL, $hlp$internal$hlp$, 26, 1, true),
($hlp$contracts$hlp$, $hlp$alterar-status$hlp$, $hlp$Alterar o status de um contrato$hlp$, $hlp$Alterar o status de um contrato no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Alterar o status de um contrato
**Para que serve:** Alterar o status de um contrato.
**Quem pode fazer:** Atualização do registro e techcontracts.contract_transition.manage.workspace; para Ativo também techcontracts.contract_activation.manage.workspace.
**Onde fica:** TechContracts > Contratos (/contracts/$id).
**Antes de começar:** Conferir aprovações pendentes e evidências necessárias.

## Passo a passo
1. Abra a ficha.
2. Escolha um status permitido no campo "Status".
3. Clique em "Salvar".
4. Para "Em revisão" ou "Aguardando assinatura", use o fluxo de aprovações em vez da mudança manual.
<!-- screenshot: Alterar o status de um contrato, sem dados pessoais reais -->

## Resultado esperado
Status atualizado somente quando autorizado pelas regras de transição.

## Regras e limites
- Status: Rascunho, Em revisão, Em negociação, Aguardando assinatura, Ativo, Renovando, Encerrado, Rescindido.
- Aprovação pendente pode impedir transição.
- Ativo não comprova assinatura. Aprovação completa não ativa automaticamente o contrato.

## Erros comuns
"Use o fluxo de aprovações para esta situação." ou "Conclua ou reinicie o fluxo de aprovação antes de alterar a situação.": conclua o processo correto.
"Edição não autorizada.": revise seu acesso.

## Relacionados
- [Iniciar aprovações](/ajuda/contracts/iniciar-aprovacoes)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/$id$hlp$, NULL, $hlp$internal$hlp$, 31, 1, true),
($hlp$contracts$hlp$, $hlp$analisar-vinculos-ia$hlp$, $hlp$Revisar e aplicar sugestões de vínculo da IA$hlp$, $hlp$Revisar e aplicar sugestões de vínculo da IA no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Revisar e aplicar sugestões de vínculo da IA
**Para que serve:** Revisar e aplicar sugestões de vínculo da IA.
**Quem pode fazer:** Gerenciamento de links para análise; aplicar exige autorização dos vínculos de contratos.
**Onde fica:** TechContracts > Contratos (/contracts/links).
**Antes de começar:** Pendências disponíveis e revisão humana das sugestões.

## Passo a passo
1. Na fila, clique em "Analisar com IA".
2. Revise os pares sugeridos e a confiança.
3. Use "Selecionar alta confiança" se adequado, sem dispensar a revisão.
4. Clique em "Aplicar selecionadas" apenas para correspondências confirmadas.
5. Revise sucessos/falhas e o histórico. Ignore sugestões incorretas.
<!-- screenshot: Revisar e aplicar sugestões de vínculo da IA, sem dados pessoais reais -->

## Resultado esperado
Vínculos escolhidos aplicados com possível resultado parcial; decisões registradas.

## Regras e limites
- Análise consulta até 500 contratos.
- A análise pode gravar sugestões/histórico antes de aplicar. Não é necessariamente somente leitura.
- Confiança alta não comprova vínculo correto.
- Ignorar sugestão não exclui contrato.

## Erros comuns
Sem linhas filtradas, a análise fica desabilitada. Falhas parciais exigem revisão antes de nova aplicação.

## Relacionados
- [Históricos](/ajuda/contracts/consultar-historicos)
- [Vinculação manual](/ajuda/contracts/revisar-vinculacao)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/links$hlp$, NULL, $hlp$internal$hlp$, 44, 1, true),
($hlp$contracts$hlp$, $hlp$aninhar-contratos$hlp$, $hlp$Aninhar contratos de compra sob uma prestação$hlp$, $hlp$Aninhar contratos de compra sob uma prestação no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Aninhar contratos de compra sob uma prestação
**Para que serve:** Aninhar contratos de compra sob uma prestação.
**Quem pode fazer:** Atualização dos contratos e capacidade de alterar o vínculo.
**Onde fica:** TechContracts > Contratos (/contracts/$id).
**Antes de começar:** Identificar a prestação principal e o contrato de compra correto.

## Passo a passo
1. Na prestação, abra "Contratos de compra aninhados" e clique em "Aninhar contrato de compra".
2. Selecione o contrato de compra e clique em "Aninhar".
3. Se ele já estiver vinculado a outro contrato, use "Mover" e confirme a troca de vínculo.
4. Pela compra, também é possível usar "Aninhar sob contrato de prestação" ou "Alterar contrato principal".
5. Para remover, use "Desaninhar" e confirme "Desaninhar este contrato de compra do contrato de prestação?".
<!-- screenshot: Aninhar contratos de compra sob uma prestação, sem dados pessoais reais -->

## Resultado esperado
Contrato de compra associado à prestação e apresentado sob ela na listagem.

## Regras e limites
- Compra representa a WK como contratante do profissional; prestação representa a WK prestadora.
- Compra não aninha outra compra ou prestação neste card. Aditivos têm painel próprio.
- Autovínculo é impedido. Mover exige confirmação.
- A apresentação de margem não equivale a faturamento ou recebimento.

## Erros comuns
"Você não tem permissão para alterar este vínculo": revise seu acesso. Não confunda o contrato principal de um aditivo com o pai de uma compra.

## Relacionados
- [Vincular aditivos](/ajuda/contracts/vincular-aditivo)
- [Vinculação de contratos](/ajuda/contracts/revisar-vinculacao)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/$id$hlp$, NULL, $hlp$internal$hlp$, 40, 1, true),
($hlp$contracts$hlp$, $hlp$aprovar-medicao$hlp$, $hlp$Aprovar e reverificar uma medição$hlp$, $hlp$Aprovar e reverificar uma medição no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Aprovar e reverificar uma medição
**Para que serve:** Aprovar e reverificar uma medição.
**Quem pode fazer:** techprojects.measurements.approve.workspace e acesso ao registro; pessoa diferente de quem preparou ou enviou.
**Onde fica:** TechContracts > Contratos (/contracts/$id/medicoes).
**Antes de começar:** Medição em revisão e sem pendências impeditivas.

## Passo a passo
1. Abra a medição em revisão.
2. Confira a prévia, linhas e pendências.
3. Clique em "Aprovar medição".
4. Se houver pendências financeiras após aprovação, resolva-as e clique em "Reverificar pendências".
<!-- screenshot: Aprovar e reverificar uma medição, sem dados pessoais reais -->

## Resultado esperado
Aprovada com pendências financeiras ou pronta para o Financeiro; nenhum título criado pela aprovação.

## Regras e limites
- Quem preparou ou enviou não pode aprovar (SELF_APPROVAL).
- Aprovação revalida contrato, competência, fontes e hash.
- Medição aprovada pode continuar bloqueada para geração.
- Devolver à situação Rascunho exige justificativa e autorização própria.

## Erros comuns
APPROVE_BLOCKED: confira pendências. SELF_APPROVAL: encaminhe a outro aprovador autorizado.

## Relacionados
- [Gerar no Financeiro](/ajuda/contracts/gerar-medicao-financeiro)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/$id/medicoes$hlp$, NULL, $hlp$internal$hlp$, 73, 1, true),
($hlp$contracts$hlp$, $hlp$assinar-por-link$hlp$, $hlp$Assinar ou recusar um documento por link$hlp$, $hlp$Assinar ou recusar um documento por link no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Assinar ou recusar um documento por link
**Para que serve:** Assinar ou recusar um documento por link.
**Quem pode fazer:** Destinatário do link individual de assinatura. O acesso público usa o token do link.
**Onde fica:** TechContracts > Contratos (/sign/$token).
**Antes de começar:** Receber um link válido. Não compartilhe o link individual com terceiros.

## Passo a passo
1. Abra o link recebido e leia o documento.
2. Consulte a situação dos signatários e aguarde os anteriores se houver assinatura ordenada.
3. Digite seu nome completo e marque o aceite.
4. Clique em "Assinar agora".
5. Se não concordar, escolha a recusa e informe o motivo opcional.
<!-- screenshot: Assinar ou recusar um documento por link, sem dados pessoais reais -->

## Resultado esperado
A assinatura ou recusa fica registrada no documento.

## Regras e limites
- Nome com pelo menos dois caracteres e aceite são exigidos pelo botão.
- Links inválidos, expirados ou documentos cancelados/rascunho não permitem assinatura.
- A ordem é conferida novamente ao assinar.
- O link e o aceite não devem ser descritos como autenticação forte ou validação criptográfica de identidade.

## Erros comuns
"Link inválido ou expirado.": peça um link válido.
"Você já assinou este documento." e "Assinatura recusada anteriormente." indicam ação já registrada.
"Assinatura indisponível.": confira a situação do documento com o responsável.

## Relacionados
- [Preparar documentos](/ajuda/contracts/gerenciar-documentos-assinatura)$hlp$, $hlp$howto$hlp$, $hlp$/sign/$token$hlp$, NULL, $hlp$internal$hlp$, 96, 1, true),
($hlp$contracts$hlp$, $hlp$associar-servico$hlp$, $hlp$Associar serviço do catálogo ao contrato$hlp$, $hlp$Associar serviço do catálogo ao contrato no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Associar serviço do catálogo ao contrato
**Para que serve:** Associar serviço do catálogo ao contrato.
**Quem pode fazer:** Criação de techservice.services; o servidor exige techservice.services.create.own neste caminho.
**Onde fica:** TechContracts > Contratos (/contracts/$id).
**Antes de começar:** Contrato de Prestação, serviço do catálogo ativo e cargo ativo se selecionado.

## Passo a passo
1. Abra o contrato de prestação.
2. No card "Serviços", clique em "Associar serviço".
3. Em "Associar serviço ao contrato", escolha "Preset de contratação" se necessário e "Serviço do catálogo *".
4. Revise "Cargo / perfil contratado", "Senioridade" e "Stack / competências".
5. Preencha "Tipo de cobrança", "Cadência", "Quantidade", "Preço unitário", "Início" e "Fim".
6. Conclua a associação e confira "Serviço associado ao contrato.".
<!-- screenshot: Associar serviço do catálogo ao contrato, sem dados pessoais reais -->

## Resultado esperado
Serviço operacional associado ao contrato; seu nome abre a ficha do serviço.

## Regras e limites
- Serviços são associados à prestação. Compra é aninhada sob prestação, não recebe a mesma associação direta.
- O botão aparecer pelo tipo do contrato não comprova permissão de criação.
- Catálogo ativo é obrigatório. Valor do serviço = quantidade × preço unitário.

## Erros comuns
"Selecione um serviço do catálogo.", "Serviço do catálogo não encontrado ou inativo" ou "Cargo não encontrado ou inativo": revise os cadastros.

## Relacionados
- [Consultar serviços](/ajuda/contracts/consultar-servicos)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/$id$hlp$, NULL, $hlp$internal$hlp$, 35, 1, true),
($hlp$contracts$hlp$, $hlp$ativar-servico$hlp$, $hlp$Ativar um serviço$hlp$, $hlp$Ativar um serviço no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Ativar um serviço
**Para que serve:** Ativar um serviço.
**Quem pode fazer:** Atualização de techservice.services no escopo do registro.
**Onde fica:** TechContracts > Contratos (/services/$id).
**Antes de começar:** Conferir contrato, valores, direção e cobrança do serviço.

## Passo a passo
1. Abra a ficha do serviço.
2. Confira valores e datas.
3. Quando disponível, clique em "Ativar".
4. Aguarde "Serviço ativado." e confira os lançamentos gerados.
<!-- screenshot: Ativar um serviço, sem dados pessoais reais -->

## Resultado esperado
O procedimento de ativação do serviço é executado com as verificações de cobrança.

## Regras e limites
- "Ativar" e salvar o campo Status são ações diferentes.
- Não considere a ativação como envio automático de cobrança ao cliente.
- Bloqueios de cobrança e permissões são verificados no servidor.

## Erros comuns
Se a ativação falhar, leia a mensagem e revise a configuração antes de tentar novamente.

## Relacionados
- [Editar serviço](/ajuda/contracts/editar-servico)$hlp$, $hlp$howto$hlp$, $hlp$/services/$id$hlp$, NULL, $hlp$internal$hlp$, 82, 1, true),
($hlp$contracts$hlp$, $hlp$campos-e-status$hlp$, $hlp$Campos e status do TechContracts$hlp$, $hlp$Campos e status do TechContracts no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Campos e status do TechContracts
## Contratos
| Campo | Significado operacional |
|---|---|
| Tipo | Prestação ou Compra |
| Tipo de documento | Principal ou Aditivo |
| Contrato principal | Obrigatório no aditivo; não é o mesmo vínculo pai de uma compra |
| Valor total | Valor cadastrado do contrato |
| Início / Fim | Vigência cadastrada |
| Renovação automática | Sim ou Não |
| Aviso prévio (dias) | Prazo cadastrado de aviso |
| Cláusulas / corpo do contrato | Texto ou HTML em campo de texto |

| Status salvo | Label da ficha |
|---|---|
| draft | Rascunho |
| in_review | Em revisão |
| in_negotiation | Em negociação |
| awaiting_signature | Aguardando assinatura |
| active | Ativo |
| renewing | Renovando |
| ended | Encerrado |
| terminated | Rescindido |

Na lista, Aguardando assinatura aparece abreviado como "Aguard. assinatura". Em revisão e Aguardando assinatura passam pelo fluxo de aprovações. Ativo não comprova assinatura.

## Serviços em execução
Tipos: Recorrente, Único, Por marco, Por uso. Status: Pendente, Ativo, Pausado, Cancelado, Concluído. Cadência recorrente: Mensal, Trimestral, Anual. Valor por ciclo = quantidade × preço unitário.

## Documentos e medições
Modelo importado nasce em rascunho. Documento enviado para assinatura sela o conteúdo, sem comprovar entrega de e-mail. Medição tem etapas próprias de revisão, aprovação e geração no Financeiro; provisão não é título financeiro.

## Relacionados
- [Alterar status](/ajuda/contracts/alterar-status)
- [Editar serviço](/ajuda/contracts/editar-servico)
- [Evidência de assinatura](/ajuda/contracts/registrar-assinatura)$hlp$, $hlp$reference$hlp$, NULL, NULL, $hlp$internal$hlp$, 2, 1, true),
($hlp$contracts$hlp$, $hlp$configurar-cobranca$hlp$, $hlp$Configurar e versionar o modelo de cobrança$hlp$, $hlp$Configurar e versionar o modelo de cobrança no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Configurar e versionar o modelo de cobrança
**Para que serve:** Configurar e versionar o modelo de cobrança.
**Quem pode fazer:** techprojects.billing_config.manage.workspace e acesso ao contrato/serviço.
**Onde fica:** TechContracts > Contratos (/contracts/$id/medicoes).
**Antes de começar:** Conferir o escopo e os títulos legados já existentes.

## Passo a passo
1. Em "Modelo de cobrança", escolha "Escopo": "Contrato inteiro" ou um serviço.
2. Escolha "Modelo": por hora, mensalidade/preço fixo, pacote/franquia, marcos/entregáveis ou percentual/sucesso.
3. Informe "Vale a partir de" e "Arredondamento (2 casas)".
4. Revise as opções do modelo: horas fechadas, aceite do cliente, franquia, valores, saldo, pró-rata ou percentual, conforme disponibilizado.
5. Preencha "Motivo (mín. 10 caracteres)".
6. Clique em "Ativar modelo" e confirme "Ativar".
<!-- screenshot: Configurar e versionar o modelo de cobrança, sem dados pessoais reais -->

## Resultado esperado
Modelo versionado e ativo a partir da competência escolhida; sem criação de medição ou título.

## Regras e limites
- A interface não oferece competência anterior ao mês atual.
- No escopo de serviço, Medições assume a cobrança a partir da competência; o gerador antigo deixa de faturar esse serviço.
- Títulos legados permanecem e precisam de vínculo ou resolução; não desaparecem com a mudança.
- Configurar modelo não concede permissão de geração financeira.

## Erros comuns
Se houver títulos legados ou pendências, resolva-os no fluxo correto antes de gerar uma nova cobrança.

## Relacionados
- [Preparar medição](/ajuda/contracts/preparar-medicao)
- [Permissões](/ajuda/contracts/permissoes)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/$id/medicoes$hlp$, NULL, $hlp$internal$hlp$, 71, 1, true),
($hlp$contracts$hlp$, $hlp$configurar-padroes$hlp$, $hlp$Configurar padrões de contrato$hlp$, $hlp$Configurar padrões de contrato no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Configurar padrões de contrato
**Para que serve:** Configurar padrões de contrato.
**Quem pode fazer:** Leitura de techcontracts.defaults; para salvar, manage de defaults e techcontracts.contracts.update.workspace.
**Onde fica:** TechContracts > Contratos (/settings/contract-defaults).
**Antes de começar:** Acesso à administração dos padrões.

## Passo a passo
1. Abra "Padrões de contrato".
2. Selecione "Todos os tipos" ou a aba do tipo desejado.
3. Preencha os campos disponibilizados.
4. Clique em "Salvar padrões".
<!-- screenshot: Configurar padrões de contrato, sem dados pessoais reais -->

## Resultado esperado
"Padrões salvos." confirma os valores de pré-preenchimento.

## Regras e limites
- Os padrões atuam na criação. Não alteram contratos existentes retroativamente.
- Valores vindos do negócio ou digitados pelo usuário têm prioridade.
- Somente campos marcados para aceitar padrão aparecem.
- Selecionar um provedor de assinatura não configura uma integração com esse provedor.

## Erros comuns
"Não foi possível carregar os padrões de contrato.": use "Tentar novamente". Se salvar for negado, confira as duas permissões necessárias.

## Relacionados
- [Visão geral](/ajuda/contracts/visao-geral)
- [Permissões](/ajuda/contracts/permissoes)$hlp$, $hlp$howto$hlp$, $hlp$/settings/contract-defaults$hlp$, NULL, $hlp$internal$hlp$, 90, 1, true),
($hlp$contracts$hlp$, $hlp$consultar-contratos$hlp$, $hlp$Consultar, filtrar e agrupar contratos$hlp$, $hlp$Consultar, filtrar e agrupar contratos no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Consultar, filtrar e agrupar contratos
**Para que serve:** Consultar, filtrar e agrupar contratos.
**Quem pode fazer:** Leitura de techcontracts.contracts no escopo dos registros.
**Onde fica:** TechContracts > Contratos (/contracts).
**Antes de começar:** Acesso ao módulo.

## Passo a passo
1. Abra TechContracts > Contratos > Contratos.
2. Escolha "Todos", "Ativos", "Em assinatura", "Vencendo em 30 dias" ou "Encerrados".
3. Use "Buscar por título ou número…" e combine "Tipo", "Status", "Empresa (contraparte)", "Contratante", "Vigência", "Período de início" e "Período de término".
4. Se desejar, agrupe por "Empresa", "Serviço", "Cargo" ou "Senioridade". "Nenhum" remove o agrupamento.
5. Abra o contrato desejado. Use "Limpar filtros" para remover os filtros.
<!-- screenshot: Consultar, filtrar e agrupar contratos, sem dados pessoais reais -->

## Resultado esperado
Lista de contratos conforme filtros e acesso.

## Regras e limites
- Tipo: Prestação ou Compra.
- Busca até 200 caracteres. A consulta paginada aceita de 1 a 200 registros por página; padrão de servidor: 50.
- Agrupamentos têm consultas próprias limitadas; não representam obrigatoriamente toda a base.
- Agrupar visualmente não cria vínculo contratual.
- A presença de uma ação no cabeçalho não comprova permissão para executá-la.

## Erros comuns
Sem registros: confira filtros e acesso. Não considere uma lista vazia como inexistência de contratos no workspace.

## Relacionados
- [Criar contrato](/ajuda/contracts/criar-contrato)
- [Editar contrato](/ajuda/contracts/editar-contrato)$hlp$, $hlp$howto$hlp$, $hlp$/contracts$hlp$, NULL, $hlp$internal$hlp$, 20, 1, true),
($hlp$contracts$hlp$, $hlp$consultar-fluxo$hlp$, $hlp$Consultar o fluxo do contrato$hlp$, $hlp$Consultar o fluxo do contrato no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Consultar o fluxo do contrato
**Para que serve:** Consultar o fluxo do contrato.
**Quem pode fazer:** Acesso ao contrato e aos registros relacionados.
**Onde fica:** TechContracts > Contratos (/contracts/$id/flow).
**Antes de começar:** Contrato existente.

## Passo a passo
1. Na ficha, clique em "Fluxo do contrato".
2. Consulte as etapas de negócio, proposta/cotação, aprovação, minuta, revisão/aditivos e assinatura disponíveis.
3. Leia a situação e os registros de cada etapa.
4. Abra os vínculos de negócio ou contrato quando disponíveis.
5. Use "Voltar ao contrato" para retornar.
<!-- screenshot: Consultar o fluxo do contrato, sem dados pessoais reais -->

## Resultado esperado
Visão das etapas e documentos relacionados ao contrato.

## Regras e limites
- Esta tela apresenta o fluxo; não executa automaticamente um workflow.
- Etapas sem dados não comprovam execução concluída.
- Cada vínculo aberto respeita o acesso ao registro correspondente.

## Erros comuns
"Não foi possível carregar o fluxo.": use "Tentar novamente".
"Contrato não encontrado": registro excluído ou sem acesso.

## Relacionados
- [Aprovações](/ajuda/contracts/iniciar-aprovacoes)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/$id/flow$hlp$, NULL, $hlp$internal$hlp$, 41, 1, true),
($hlp$contracts$hlp$, $hlp$consultar-historicos$hlp$, $hlp$Consultar histórico de vínculos e sugestões de IA$hlp$, $hlp$Consultar histórico de vínculos e sugestões de IA no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Consultar histórico de vínculos e sugestões de IA
**Para que serve:** Consultar histórico de vínculos e sugestões de IA.
**Quem pode fazer:** Acesso ao contrato e à leitura dos históricos correspondentes.
**Onde fica:** TechContracts > Contratos (/contracts/$id).
**Antes de começar:** Contrato com histórico disponível.

## Passo a passo
1. Abra a ficha do contrato.
2. Consulte "Histórico de vínculos" para revisar aninhamentos e desvinculações.
3. Consulte "Histórico de sugestões da IA" para revisar propostas e decisões.
4. Quando a consulta falhar, use a tentativa novamente disponível no card.
<!-- screenshot: Consultar histórico de vínculos e sugestões de IA, sem dados pessoais reais -->

## Resultado esperado
Histórico apresentado para conferência, sem aplicar novo vínculo por simples leitura.

## Regras e limites
- Histórico de sugestão não significa vínculo aplicado.
- Histórico de vínculos e aprovações são registros distintos.

## Erros comuns
Sem eventos, não presuma que houve decisão. Falha na consulta: tente novamente e confira seu acesso.

## Relacionados
- [Vinculação](/ajuda/contracts/revisar-vinculacao)
- [Aprovações](/ajuda/contracts/iniciar-aprovacoes)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/$id$hlp$, NULL, $hlp$internal$hlp$, 46, 1, true),
($hlp$contracts$hlp$, $hlp$consultar-rentabilidade$hlp$, $hlp$Consultar e exportar rentabilidade do contrato$hlp$, $hlp$Consultar e exportar rentabilidade do contrato no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Consultar e exportar rentabilidade do contrato
**Para que serve:** Consultar e exportar rentabilidade do contrato.
**Quem pode fazer:** techprojects.profitability.view.workspace; exportação também profitability.export.workspace.
**Onde fica:** TechContracts > Contratos (/contracts/$id/medicoes).
**Antes de começar:** Contrato e intervalo disponíveis; acesso a tarifas/custos conforme restrições.

## Passo a passo
1. Em rentabilidade, ajuste "De", "Até" e "Moeda".
2. Compare "Receita aprovada (medida)", "Lançada no Financeiro", "Custo estimado" e "Margem estimada".
3. Confira a cobertura de custos e esforço.
4. Use "Exportar CSV" quando autorizado.
<!-- screenshot: Consultar e exportar rentabilidade do contrato, sem dados pessoais reais -->

## Resultado esperado
Consulta ou exportação de indicadores estimados; nenhuma geração ou cobrança executada.

## Regras e limites
- Intervalo de meses completos até 12 meses; moeda com três letras.
- Filtro de moeda não é conversão cambial.
- Custo parcial aparece como parcial; sem cobertura, desconhecido.
- Receita medida, título lançado e recebimento são diferentes.
- Margem estimada não equivale a lucro contábil realizado.

## Erros comuns
Custo desconhecido: revise cobertura e acesso, sem assumir custo zero.

## Relacionados
- [Fechar provisão mensal](/ajuda/contracts/fechar-provisao)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/$id/medicoes$hlp$, NULL, $hlp$internal$hlp$, 77, 1, true),
($hlp$contracts$hlp$, $hlp$consultar-servicos$hlp$, $hlp$Consultar serviços em execução$hlp$, $hlp$Consultar serviços em execução no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Consultar serviços em execução
**Para que serve:** Consultar serviços em execução.
**Quem pode fazer:** Quem tem leitura de techservice.services no escopo aplicável.
**Onde fica:** TechContracts > Contratos (/services).
**Antes de começar:** Serviços cadastrados dentro de contratos.

## Passo a passo
1. Abra "Serviços em execução".
2. Use "Buscar por nome…".
3. Filtre por "Tipo", "Status" e "Responsável".
4. Alterne entre tabela e kanban. Configure as colunas da tabela conforme necessário.
5. Clique no nome para abrir o serviço ou na coluna "Contrato" para abrir o contrato.
<!-- screenshot: Consultar serviços em execução, sem dados pessoais reais -->

## Resultado esperado
Lista de serviços vinculados aos contratos.

## Regras e limites
- Tipos: Recorrente, Único, Por marco, Por uso. Status: Pendente, Ativo, Pausado, Cancelado, Concluído.
- Valor = quantidade × preço unitário.
- A tela consulta até 200 registros. A seleção global usa uma busca de IDs separada e não corresponde apenas aos registros visíveis.
- "Limpar filtros" limpa tipo, status e responsável, mas não a busca por nome.
- Não há criação direta nessa lista. Catálogo de Serviços é um cadastro reutilizável; Serviços em execução são instâncias de um contrato.

## Erros comuns
Sem resultado: confira os filtros, a busca e seu acesso ao serviço.

## Relacionados
- [Editar serviço](/ajuda/contracts/editar-servico)
- [Visão geral](/ajuda/contracts/visao-geral)
- [Permissões](/ajuda/contracts/permissoes)$hlp$, $hlp$howto$hlp$, $hlp$/services$hlp$, NULL, $hlp$internal$hlp$, 80, 1, true),
($hlp$contracts$hlp$, $hlp$criar-contrato$hlp$, $hlp$Criar contrato em branco pelo assistente$hlp$, $hlp$Criar contrato em branco pelo assistente no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Criar contrato em branco pelo assistente
**Para que serve:** Criar contrato em branco pelo assistente.
**Quem pode fazer:** Criação de techcontracts.contracts e acesso às origens utilizadas.
**Onde fica:** TechContracts > Contratos (/contracts).
**Antes de começar:** Escolher contratante, contraparte e condições do contrato.

## Passo a passo
1. Clique em "Novo contrato".
2. Em "Origem", escolha "Em branco".
3. Em "Tipo", escolha o tipo do contrato.
4. Em "Dados", preencha o título e os campos disponibilizados.
5. Em "Serviços", com negócio vinculado, revise "Copiar serviços do negócio para o contrato" e os itens. Sem negócio, associe serviços pela ficha depois.
6. Em "Revisão", confira os dados e conclua a criação.
<!-- screenshot: Criar contrato em branco pelo assistente, sem dados pessoais reais -->

## Resultado esperado
"Contrato criado." e abertura da ficha.

## Regras e limites
- Etapas: Origem, Tipo, Dados, Serviços, Revisão. No assistente manual, a criação ocorre no último passo.
- Título é obrigatório.
- A cópia de serviços é desabilitada em contratos de compra.
- Padrões do workspace ajudam no preenchimento, mas não substituem revisão.

## Erros comuns
"Informe um título.": preencha o título.
"Não foi possível carregar todas as origens.": confira a disponibilidade das origens; não presuma que todos os modelos foram carregados.

## Relacionados
- [Converter origem comercial](/ajuda/contracts/criar-da-origem-comercial)
- [Associar serviço](/ajuda/contracts/associar-servico)$hlp$, $hlp$howto$hlp$, $hlp$/contracts$hlp$, NULL, $hlp$internal$hlp$, 21, 1, true),
($hlp$contracts$hlp$, $hlp$criar-da-origem-comercial$hlp$, $hlp$Criar contrato a partir de cotação, proposta ou modelo$hlp$, $hlp$Criar contrato a partir de cotação, proposta ou modelo no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Criar contrato a partir de cotação, proposta ou modelo
**Para que serve:** Criar contrato a partir de cotação, proposta ou modelo.
**Quem pode fazer:** Criação de contrato e acesso à cotação, proposta, negócio ou modelo escolhido.
**Onde fica:** TechContracts > Contratos (/contracts).
**Antes de começar:** Abrir o assistente no contexto comercial para usar cotação/proposta; modelo precisa estar publicado.

## Passo a passo
1. Abra o assistente de contrato no contexto do negócio ou da origem comercial.
2. Em "Origem", escolha a cotação, proposta ou modelo disponível.
3. Para cotação/proposta, escolha "Novo contrato independente" ou "Termo aditivo de: …".
4. Se for aditivo, selecione um contrato principal ativo disponível.
5. Confira "Dados", "Serviços" e "Revisão" antes de concluir.
<!-- screenshot: Criar contrato a partir de cotação, proposta ou modelo, sem dados pessoais reais -->

## Resultado esperado
Contrato criado com a origem comercial registrada; caso a origem já tenha gerado contrato, o existente é aberto.

## Regras e limites
- A listagem sem contexto de negócio não oferece busca universal de cotações/propostas.
- Cotação: itens viram serviços. Proposta: preserva proposta e cotação de origem.
- No modelo, tipo vem do modelo; empresa, valores e vigência vêm do negócio e modelo.
- Conversão já feita não deve ser repetida para criar duplicata.

## Erros comuns
"Selecione o contrato principal do aditivo.": escolha um principal válido.
"A empresa não tem contrato ativo, então não há aditivo para escolher.": use contrato independente quando adequado.
"Este documento já gerou um contrato — abrindo o existente." é prevenção de duplicidade.

## Relacionados
- [Criar contrato em branco](/ajuda/contracts/criar-contrato)
- [Organizar modelos](/ajuda/contracts/gerenciar-modelos)$hlp$, $hlp$howto$hlp$, $hlp$/contracts$hlp$, NULL, $hlp$internal$hlp$, 22, 1, true),
($hlp$contracts$hlp$, $hlp$decidir-aprovacao$hlp$, $hlp$Aprovar ou rejeitar uma etapa de contrato$hlp$, $hlp$Aprovar ou rejeitar uma etapa de contrato no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Aprovar ou rejeitar uma etapa de contrato
**Para que serve:** Aprovar ou rejeitar uma etapa de contrato.
**Quem pode fazer:** Aprovação de techcontracts.approvals, com acesso à etapa e respeito ao responsável atribuído.
**Onde fica:** TechContracts > Contratos (/contracts/$id).
**Antes de começar:** Etapa pendente; anteriores concluídas; contrato em revisão.

## Passo a passo
1. Abra o painel de aprovações.
2. Confira a etapa atual e sua atribuição.
3. Registre o comentário, obrigatório em rejeição.
4. Clique em "Aprovar" ou "Rejeitar".
5. Confira "Etapa aprovada" ou "Etapa rejeitada".
<!-- screenshot: Aprovar ou rejeitar uma etapa de contrato, sem dados pessoais reais -->

## Resultado esperado
Decisão registrada; rejeição leva a Em negociação e conclusão de todas as aprovações leva a Aguardando assinatura.

## Regras e limites
- Comentário até 2.000 caracteres.
- Não é permitido decidir etapa já decidida ou atribuída a outra pessoa.
- Aprovar não conclui assinatura nem ativa contrato.

## Erros comuns
"Informe o motivo da rejeição", "A etapa foi atribuída a outra pessoa." ou "Conclua a etapa anterior.": corrija a condição antes de decidir.

## Relacionados
- [Iniciar aprovações](/ajuda/contracts/iniciar-aprovacoes)
- [Registrar assinatura](/ajuda/contracts/registrar-assinatura)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/$id$hlp$, NULL, $hlp$internal$hlp$, 33, 1, true),
($hlp$contracts$hlp$, $hlp$editar-contrato$hlp$, $hlp$Editar a ficha de um contrato$hlp$, $hlp$Editar a ficha de um contrato no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Editar a ficha de um contrato
**Para que serve:** Editar a ficha de um contrato.
**Quem pode fazer:** Leitura e capacidade de atualização de techcontracts.contracts para o registro.
**Onde fica:** TechContracts > Contratos (/contracts/$id).
**Antes de começar:** Abrir o contrato correto e conferir a versão salva.

## Passo a passo
1. Abra o contrato pela lista.
2. Edite "Título", "Tipo", "Tipo de documento", "Contrato principal" quando for aditivo, e "Valor total".
3. Revise "Início", "Fim", "Renovação automática" e "Aviso prévio (dias)".
4. Em "Cláusulas / corpo do contrato", edite o texto quando necessário.
5. Clique em "Salvar" e aguarde "Contrato atualizado.".
6. Use "Visualizar" para abrir o arquivo original quando essa ação estiver disponível.
<!-- screenshot: Editar a ficha de um contrato, sem dados pessoais reais -->

## Resultado esperado
Alterações persistidas na ficha.

## Regras e limites
- Corpo é campo de texto/HTML, não editor rico.
- "Detalhes extraídos" exibe informações disponíveis em leitura; não torna todos os campos extraídos editáveis.
- Campos alterados localmente só são gravados após salvar.
- Conteúdo, partes e condições alterados podem exigir nova evidência de assinatura.
- Status e aprovação têm regras próprias.

## Erros comuns
"Contrato não encontrado.": use "Voltar". Salvar desabilitado: confira acesso, gravação em andamento ou principal ausente no aditivo.

## Relacionados
- [Alterar status](/ajuda/contracts/alterar-status)
- [Registrar assinatura](/ajuda/contracts/registrar-assinatura)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/$id$hlp$, NULL, $hlp$internal$hlp$, 30, 1, true),
($hlp$contracts$hlp$, $hlp$editar-publicar-modelo$hlp$, $hlp$Editar e publicar um modelo de contrato$hlp$, $hlp$Editar e publicar um modelo de contrato no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Editar e publicar um modelo de contrato
**Para que serve:** Editar e publicar um modelo de contrato.
**Quem pode fazer:** Atualização de techcontracts.contract_templates no registro.
**Onde fica:** TechContracts > Contratos (/contracts/templates/$id).
**Antes de começar:** Ter um modelo criado ou importado.

## Passo a passo
1. Abra o modelo.
2. Preencha "Nome do modelo", "Tipo de contrato", "Tipo de serviço" e "Descrição".
3. Revise "Corpo do contrato" e suas variáveis.
4. Salve para manter a edição.
5. Após a revisão, clique em "Publicar".
<!-- screenshot: Editar e publicar um modelo de contrato, sem dados pessoais reais -->

## Resultado esperado
"Modelo salvo." ou "Modelo publicado.", conforme a ação escolhida.

## Regras e limites
- Tipos de contrato: Prestação e Compra.
- Revise as variáveis antes de publicar. Texto importado não é garantia de documento completo ou juridicamente adequado.

## Erros comuns
Se a gravação falhar, confira o nome e a mensagem recebida do servidor.

## Relacionados
- [Importar modelo](/ajuda/contracts/importar-modelo)
- [Organizar modelos](/ajuda/contracts/gerenciar-modelos)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/templates/$id$hlp$, NULL, $hlp$internal$hlp$, 61, 1, true),
($hlp$contracts$hlp$, $hlp$editar-servico$hlp$, $hlp$Editar a ficha de um serviço$hlp$, $hlp$Editar a ficha de um serviço no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Editar a ficha de um serviço
**Para que serve:** Editar a ficha de um serviço.
**Quem pode fazer:** Leitura e atualização de techservice.services no escopo do registro.
**Onde fica:** TechContracts > Contratos (/services/$id).
**Antes de começar:** Abrir um serviço existente.

## Passo a passo
1. Na lista, clique no nome do serviço.
2. Edite "Nome", "Descrição", "Status", "Quantidade", "Preço unitário", "Início" e "Fim".
3. Para serviço recorrente, escolha "Cadência": Mensal, Trimestral ou Anual.
4. Clique em "Salvar".
5. Consulte "Valor por ciclo", "Próxima cobrança", "Direção" e "Lançamentos gerados".
<!-- screenshot: Editar a ficha de um serviço, sem dados pessoais reais -->

## Resultado esperado
A mensagem "Alterações salvas." confirma a gravação.

## Regras e limites
- Nome obrigatório; quantidade e preço não podem ser negativos.
- Tipo, moeda, direção e próxima cobrança não são editáveis nesse formulário.
- Direção é A receber quando a WK presta o serviço; no caso contrário, A pagar.
- Lançamentos gerados mostram até 50 registros recentes por vencimento, com acesso financeiro próprio.
- Salvar o status Ativo não executa o mesmo procedimento da ação "Ativar".

## Erros comuns
"Serviço não encontrado.": volte à lista. "Nenhum lançamento ainda." não significa falha; pode não haver lançamento ou acesso financeiro.

## Relacionados
- [Ativar serviço](/ajuda/contracts/ativar-servico)
- [Consultar serviços](/ajuda/contracts/consultar-servicos)$hlp$, $hlp$howto$hlp$, $hlp$/services/$id$hlp$, NULL, $hlp$internal$hlp$, 81, 1, true),
($hlp$contracts$hlp$, $hlp$erros-comuns$hlp$, $hlp$Erros comuns no TechContracts$hlp$, $hlp$Erros comuns no TechContracts no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Erros comuns no TechContracts
| Situação | O que conferir |
|---|---|
| Contrato ou serviço não encontrado | Registro removido, acesso ao registro e filtros |
| Salvar desabilitado | Permissão de atualização, gravação em andamento e principal obrigatório do aditivo |
| Use o fluxo de aprovações para esta situação | Não mudar manualmente Em revisão ou Aguardando assinatura |
| Conclua a etapa anterior | Ordem da cadeia de aprovação |
| A etapa foi atribuída a outra pessoa | Responsável da aprovação |
| Informe o motivo da rejeição | Comentário obrigatório |
| Autorização comercial pendente | Origem comercial, versão/evidência e demais impedimentos mostrados no card |
| Sem permissão ou contrato alterado. Recarregue. | Versão salva atual e gerenciamento de evidência |
| Documento indisponível para envio | Estado, validade e signatários |
| Link inválido ou expirado | Solicitar link válido ao responsável |
| Configure o modelo primeiro | Modelo de cobrança ativo antes de preparar medição |
| Serviço do catálogo não encontrado ou inativo | Catálogo ativo e serviço escolhido |

## Importações
PDF aceita até 15 MB e DOCX até 10 MB nos fluxos de importação de contrato/modelo. Revise o texto extraído e os rascunhos. Um rascunho criado na importação pode permanecer salvo mesmo sem finalizar.

## Não resolva mudando o significado dos estados
Ativo não substitui assinatura, provisão não substitui título e medição aprovada não comprova recebimento. Corrija o impedimento no fluxo correto.

## Relacionados
- [Permissões](/ajuda/contracts/permissoes)
- [Evidência de assinatura](/ajuda/contracts/registrar-assinatura)$hlp$, $hlp$troubleshooting$hlp$, NULL, NULL, $hlp$internal$hlp$, 4, 1, true),
($hlp$contracts$hlp$, $hlp$estornar-medicao$hlp$, $hlp$Devolver, cancelar ou estornar uma medição$hlp$, $hlp$Devolver, cancelar ou estornar uma medição no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Devolver, cancelar ou estornar uma medição
**Para que serve:** Devolver, cancelar ou estornar uma medição.
**Quem pode fazer:** Devolver exige aprovação ou gerenciamento de medições conforme verificação do servidor; estornar exige techprojects.measurement_reverse.manage.workspace.
**Onde fica:** TechContracts > Contratos (/contracts/$id/medicoes).
**Antes de começar:** Identificar situação, vínculo financeiro e pagamentos antes de escolher a ação.

## Passo a passo
1. Abra o detalhe da medição.
2. Para voltar a revisar, use a ação de devolução e informe a justificativa.
3. Para cancelar uma medição ainda não gerada, use o cancelamento permitido para a situação.
4. Para medição gerada, use o estorno e informe motivo com pelo menos 10 caracteres.
5. Confira a situação e o vínculo financeiro após a operação.
<!-- screenshot: Devolver, cancelar ou estornar uma medição, sem dados pessoais reais -->

## Resultado esperado
Devolução retorna a Rascunho; estorno termina em Estornada, conforme a ação e suas regras.

## Regras e limites
- Cancelamento não substitui estorno de medição gerada.
- Título criado pela medição: estorno cancela-o somente quando permitido.
- Título legado: estorno apenas desfaz o vínculo e preserva o título.
- Pagamento, baixa ou registro bancário no título gerado bloqueia estorno.
- Estorno não é devolução bancária nem desfaz recebimento automaticamente.

## Erros comuns
REVERSE_BLOCKED: resolva pagamentos, baixas ou dependências no Financeiro antes de tentar.

## Relacionados
- [Gerar título ou vincular legado](/ajuda/contracts/gerar-medicao-financeiro)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/$id/medicoes$hlp$, NULL, $hlp$internal$hlp$, 75, 1, true),
($hlp$contracts$hlp$, $hlp$excluir-contrato$hlp$, $hlp$Excluir um contrato$hlp$, $hlp$Excluir um contrato no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Excluir um contrato
**Para que serve:** Excluir um contrato.
**Quem pode fazer:** Capacidade de exclusão de techcontracts.contracts para o registro.
**Onde fica:** TechContracts > Contratos (/contracts/$id).
**Antes de começar:** Revisar dependências antes de remover. Não usar exclusão para encerrar uma vigência.

## Passo a passo
1. Abra o contrato correto.
2. Clique na ação "Excluir".
3. Confirme "Excluir este contrato?" somente após revisar o impacto.
<!-- screenshot: Excluir um contrato, sem dados pessoais reais -->

## Resultado esperado
"Contrato excluído." e retorno à lista.

## Regras e limites
- Excluir remove o cadastro; encerrar e rescindir são estados distintos.
- Não presuma remoção automática de todos os serviços, medições ou vínculos. Dependências podem bloquear a operação.

## Erros comuns
"Você não tem permissão para excluir este registro.": solicite revisão do seu acesso.

## Relacionados
- [Alterar status](/ajuda/contracts/alterar-status)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/$id$hlp$, NULL, $hlp$internal$hlp$, 39, 1, true),
($hlp$contracts$hlp$, $hlp$excluir-em-massa$hlp$, $hlp$Excluir contratos em massa$hlp$, $hlp$Excluir contratos em massa no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Excluir contratos em massa
**Para que serve:** Excluir contratos em massa.
**Quem pode fazer:** Exclusão autorizada em cada contrato selecionado.
**Onde fica:** TechContracts > Contratos (/contracts).
**Antes de começar:** Revisar vínculos e confirmar que não se pretende apenas encerrar ou rescindir.

## Passo a passo
1. Selecione os contratos.
2. Clique em "Excluir" na barra de seleção.
3. Confira a quantidade e confirme "Excluir N contrato(s)? Esta ação não pode ser desfeita.".
4. Revise o resumo de sucessos e falhas.
<!-- screenshot: Excluir contratos em massa, sem dados pessoais reais -->

## Resultado esperado
Registros autorizados removidos; falhas podem permanecer sem impedir os demais.

## Regras e limites
- Botão desabilitado se autorização carregar ou algum selecionado não puder ser excluído.
- Não presuma exclusão em cascata de serviços, medições e dependências.
- Exclusão não é encerrar vigência.

## Erros comuns
Falhas por contrato: revise mensagem e dependências antes de repetir.

## Relacionados
- [Excluir pela ficha](/ajuda/contracts/excluir-contrato)$hlp$, $hlp$howto$hlp$, $hlp$/contracts$hlp$, NULL, $hlp$internal$hlp$, 28, 1, true),
($hlp$contracts$hlp$, $hlp$excluir-servico$hlp$, $hlp$Excluir um serviço$hlp$, $hlp$Excluir um serviço no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Excluir um serviço
**Para que serve:** Excluir um serviço.
**Quem pode fazer:** Exclusão de techservice.services para o registro, sem bloqueio adicional de exclusão.
**Onde fica:** TechContracts > Contratos (/services/$id).
**Antes de começar:** Confirmar que o serviço pode ser removido sem comprometer seus vínculos.

## Passo a passo
1. Abra o serviço.
2. Acione "Excluir serviço".
3. Confirme "Excluir este serviço?" somente se a remoção estiver correta.
<!-- screenshot: Excluir um serviço, sem dados pessoais reais -->

## Resultado esperado
"Serviço excluído." e retorno à listagem.

## Regras e limites
- Excluir não é pausar ou cancelar. A operação remove o cadastro.
- O acesso e os vínculos do registro podem impedir a exclusão.

## Erros comuns
"Você não tem permissão para excluir este registro.": solicite revisão do seu acesso; não tente contornar pela URL.

## Relacionados
- [Editar serviço](/ajuda/contracts/editar-servico)$hlp$, $hlp$howto$hlp$, $hlp$/services/$id$hlp$, NULL, $hlp$internal$hlp$, 83, 1, true),
($hlp$contracts$hlp$, $hlp$exportar-contratos$hlp$, $hlp$Exportar contratos selecionados$hlp$, $hlp$Exportar contratos selecionados no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Exportar contratos selecionados
**Para que serve:** Exportar contratos selecionados.
**Quem pode fazer:** Acesso aos registros e à ação de exportação conforme o controle efetivo.
**Onde fica:** TechContracts > Contratos (/contracts).
**Antes de começar:** Selecionar somente registros e dados que possam ser compartilhados.

## Passo a passo
1. Selecione os contratos na tabela.
2. Clique em "Exportar" na barra de seleção.
3. Confira o arquivo recebido antes de compartilhar.
<!-- screenshot: Exportar contratos selecionados, sem dados pessoais reais -->

## Resultado esperado
Arquivo com número, título, tipo comercial, status, valor, início, término e criação dos selecionados.

## Regras e limites
- Exportar não altera os contratos.
- Não representa automaticamente toda a carteira: depende da seleção.
- Dados comerciais devem ser compartilhados somente com destinatários autorizados.

## Erros comuns
Se não houver registros no arquivo, confira a seleção e seu acesso.

## Relacionados
- [Consultar contratos](/ajuda/contracts/consultar-contratos)
- [Permissões](/ajuda/contracts/permissoes)$hlp$, $hlp$howto$hlp$, $hlp$/contracts$hlp$, NULL, $hlp$internal$hlp$, 27, 1, true),
($hlp$contracts$hlp$, $hlp$fechar-provisao$hlp$, $hlp$Calcular, fechar e revisar provisão mensal$hlp$, $hlp$Calcular, fechar e revisar provisão mensal no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Calcular, fechar e revisar provisão mensal
**Para que serve:** Calcular, fechar e revisar provisão mensal.
**Quem pode fazer:** Leitura de techfinance.provisions e techprojects.rates; calcular exige provisions.manage.workspace; fechar/revisar também provisions.approve.workspace.
**Onde fica:** TechContracts > Contratos (/contracts/$id/medicoes).
**Antes de começar:** Mês encerrado, acesso ao contrato e fechamento integrado habilitado no workspace.

## Passo a passo
1. Em "Provisão mensal", informe "Competência (AAAA-MM)", "Origem / modelo" e "Fuso da competência".
2. Clique em "Calcular prévia".
3. Confira receita sem cobrança, horas pendentes, custo conhecido, custos sem cobertura e composição.
4. Preencha "Justificativa do fechamento ou da revisão".
5. Clique em "Fechar provisão mensal" ou, se já houver fechamento, "Registrar revisão".
6. Consulte "Histórico da competência".
<!-- screenshot: Calcular, fechar e revisar provisão mensal, sem dados pessoais reais -->

## Resultado esperado
Snapshot gerencial registrado; nenhum título, obrigação, cobrança ou pagamento criado.

## Regras e limites
- Justificativa de 10–2.000 caracteres. Competência padrão: mês anterior.
- Fechamento só para mês encerrado; revisão cria nova versão sem sobrescrever histórico.
- Composição pagina até 50 receitas e 50 custos por página.
- Custo ausente/ambíguo é desconhecido, nunca zero. Estimativas pendentes não autorizam faturamento.
- Campos financeiros ocultos/mascarados podem negar acesso; custo de profissional exige também acesso à pessoa e employment.view.workspace.
- Não somar novamente custo de origem e seus rateios de clientes.

## Erros comuns
"Fechamento integrado ainda não ativado neste workspace.": solicite configuração. PREVIEW_STALE: recalcule. REVISION_STALE: confira a última revisão.

## Relacionados
- [Consultar rentabilidade](/ajuda/contracts/consultar-rentabilidade)
- [Preparar medição](/ajuda/contracts/preparar-medicao)
- [Permissões](/ajuda/contracts/permissoes)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/$id/medicoes$hlp$, NULL, $hlp$internal$hlp$, 76, 1, true),
($hlp$contracts$hlp$, $hlp$gerar-de-modelo$hlp$, $hlp$Gerar contrato pelo diálogo de modelo publicado$hlp$, $hlp$Gerar contrato pelo diálogo de modelo publicado no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Gerar contrato pelo diálogo de modelo publicado
**Para que serve:** Gerar contrato pelo diálogo de modelo publicado.
**Quem pode fazer:** Usuário autenticado com acesso ao módulo e aos dados de origem; o caminho auditado depende também dos controles do banco, sem middleware granular explícito de modelos.
**Onde fica:** TechContracts > Contratos (/contracts).
**Antes de começar:** Modelo publicado disponível.

## Passo a passo
1. Clique em "Gerar de modelo".
2. Em "Gerar contrato a partir de modelo", escolha "Modelo publicado".
3. Preencha "Serviço (opcional)" e "Título do contrato (opcional)" se necessário.
4. Use "Pré-visualizar" para revisar o texto mesclado.
5. Clique em "Gerar contrato".
<!-- screenshot: Gerar contrato pelo diálogo de modelo publicado, sem dados pessoais reais -->

## Resultado esperado
"Contrato gerado em rascunho." e abertura da ficha.

## Regras e limites
- Prévia não é requisito obrigatório de geração, mas permite revisão.
- Empresa e negócio vêm do contexto; não são seletores desse diálogo.
- Trocar modelo, serviço ou título limpa a prévia.
- Título até 200 caracteres. Opções de serviços limitadas a 500.
- Geração não envia para assinatura nem aplica sobre contrato existente.

## Erros comuns
"Nenhum modelo publicado. Publique um modelo em Contratos → Modelos." ou "Modelo não encontrado": confira o modelo.

## Relacionados
- [Editar e publicar modelo](/ajuda/contracts/editar-publicar-modelo)$hlp$, $hlp$howto$hlp$, $hlp$/contracts$hlp$, NULL, $hlp$internal$hlp$, 25, 1, true),
($hlp$contracts$hlp$, $hlp$gerar-medicao-financeiro$hlp$, $hlp$Gerar título financeiro ou vincular título legado da medição$hlp$, $hlp$Gerar título financeiro ou vincular título legado da medição no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Gerar título financeiro ou vincular título legado da medição
**Para que serve:** Gerar título financeiro ou vincular título legado da medição.
**Quem pode fazer:** techprojects.measurement_finance.create.workspace e techfinance.entries.create.own, com acesso ao registro.
**Onde fica:** TechContracts > Contratos (/contracts/$id/medicoes).
**Antes de começar:** Medição pronta para o Financeiro, pendências resolvidas e vencimento definido.

## Passo a passo
1. Abra a medição e confira "Pendências para o Financeiro".
2. Se pronta, preencha "Vencimento" e clique em "Gerar no Financeiro".
3. Quando o fluxo oferecer vínculo legado, selecione o título existente correspondente em vez de criar outro.
4. Confira o vínculo financeiro e o resultado da operação.
<!-- screenshot: Gerar título financeiro ou vincular título legado da medição, sem dados pessoais reais -->

## Resultado esperado
Título interno a receber criado ou título legado vinculado, sem emissão de nota fiscal, boleto ou envio de cobrança.

## Regras e limites
- Geração exige estado pronto; na interface também pode ser retomada em falha. Apenas aprovada ainda fica desabilitada.
- Geração concluída é idempotente: repetição retorna o vínculo existente.
- Legado exige mesmo workspace, serviço, competência, moeda e valor; título não cancelado e sem outro vínculo ativo.
- Vínculo legado não cria um novo título. Outros legados não resolvidos podem bloquear.
- Título lançado não comprova recebimento.

## Erros comuns
GENERATE_BLOCKED: resolva os impedimentos. LEGACY_AMOUNT_MISMATCH: ajuste medição ou resolva no Financeiro.
"A aprovação foi mantida; tente de novo": falha capturada não comprova título criado.

## Relacionados
- [Estornar ou cancelar medição](/ajuda/contracts/estornar-medicao)
- [Aprovar medição](/ajuda/contracts/aprovar-medicao)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/$id/medicoes$hlp$, NULL, $hlp$internal$hlp$, 74, 1, true),
($hlp$contracts$hlp$, $hlp$gerenciar-documentos-assinatura$hlp$, $hlp$Preparar documentos para assinatura eletrônica$hlp$, $hlp$Preparar documentos para assinatura eletrônica no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Preparar documentos para assinatura eletrônica
**Para que serve:** Preparar documentos para assinatura eletrônica.
**Quem pode fazer:** Permissões de techcontracts.esign conforme a ação: ler, criar, alterar, enviar, cancelar, excluir e gerenciar signatários.
**Onde fica:** TechContracts > Contratos (/settings/esign).
**Antes de começar:** Texto revisado e nomes/e-mails dos signatários; compartilhar links apenas com seus destinatários.

## Passo a passo
1. Abra a área de assinatura eletrônica em Configurações (/settings/esign).
2. Crie um documento com "Título", "Descrição" e "Conteúdo do documento".
3. Informe os signatários, nome, e-mail e ordem. Configure assinatura ordenada quando necessário.
4. Revise o documento e os signatários antes de enviar para assinatura.
5. Use o compartilhamento/cópia do link individual para encaminhá-lo ao signatário.
<!-- screenshot: Preparar documentos para assinatura eletrônica, sem dados pessoais reais -->

## Resultado esperado
Documento preparado e, após envio, disponibilizado para assinatura conforme sua validade e ordem.

## Regras e limites
- Título: até 255 caracteres; descrição: até 2.000; corpo: até 50.000.
- De 1 a 20 signatários. Ordem é um inteiro a partir de 1.
- "Documento enviado." indica disponibilização para assinatura e selagem do conteúdo. Não comprova entrega de e-mail.
- Após envio, não é permitido alterar conteúdo/signatários ou excluir. Documento finalizado não pode ser cancelado.
- Provedores selecionáveis em campos de contrato não comprovam integração ativa com DocuSign ou Clicksign.

## Erros comuns
"Documento indisponível para envio.": confira estado, validade e signatários.
"Signatário inválido.": revise nome, e-mail e ordem.

## Relacionados
- [Assinar por link](/ajuda/contracts/assinar-por-link)
- [Registrar evidência no contrato](/ajuda/contracts/registrar-assinatura)$hlp$, $hlp$howto$hlp$, $hlp$/settings/esign$hlp$, NULL, $hlp$internal$hlp$, 95, 1, true),
($hlp$contracts$hlp$, $hlp$gerenciar-modelos$hlp$, $hlp$Criar e organizar modelos de contrato$hlp$, $hlp$Criar e organizar modelos de contrato no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Criar e organizar modelos de contrato
**Para que serve:** Criar e organizar modelos de contrato.
**Quem pode fazer:** Leitura de techcontracts.contract_templates; criação para novo/duplicar e exclusão para remover, no escopo aplicável.
**Onde fica:** TechContracts > Contratos (/contracts/templates).
**Antes de começar:** Escolher o tipo de contrato que o modelo atenderá.

## Passo a passo
1. Abra "Modelos de contrato".
2. Clique em "Novo modelo" para criar um modelo em branco.
3. Abra o modelo para editar seu conteúdo.
4. Na lista, use a ação de duplicação quando quiser reutilizar um modelo. Aguarde "Modelo duplicado.".
5. Para remover um modelo, use a ação de exclusão e confirme apenas após conferir o item.
<!-- screenshot: Criar e organizar modelos de contrato, sem dados pessoais reais -->

## Resultado esperado
Modelo disponível na lista; a criação não substitui a revisão do texto.

## Regras e limites
- Criar, atualizar e excluir têm permissões distintas.
- Modelos de contrato não são os modelos de proposta do TechSales.

## Erros comuns
Falha em criar, duplicar ou excluir: confira a mensagem e seu acesso ao modelo.

## Relacionados
- [Editar e publicar modelo](/ajuda/contracts/editar-publicar-modelo)
- [Importar modelo](/ajuda/contracts/importar-modelo)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/templates$hlp$, NULL, $hlp$internal$hlp$, 60, 1, true),
($hlp$contracts$hlp$, $hlp$importar-contrato$hlp$, $hlp$Importar e revisar um contrato PDF ou DOCX$hlp$, $hlp$Importar e revisar um contrato PDF ou DOCX no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Importar e revisar um contrato PDF ou DOCX
**Para que serve:** Importar e revisar um contrato PDF ou DOCX.
**Quem pode fazer:** Gerenciamento de techcontracts.imports; finalizar exige atualização do contrato criado.
**Onde fica:** TechContracts > Contratos (/contracts).
**Antes de começar:** PDF até 15 MB ou DOCX até 10 MB com texto legível.

## Passo a passo
1. Clique em "Importar contrato" e selecione o arquivo.
2. Revise a opção de guardar o original; use "Visualizar contrato" se desejar.
3. Clique em "Extrair com IA".
4. Revise os campos extraídos no rascunho.
5. Clique em "Finalizar" para atualizar o rascunho e abrir a ficha.
<!-- screenshot: Importar e revisar um contrato PDF ou DOCX, sem dados pessoais reais -->

## Resultado esperado
Rascunho criado na extração e atualizado após a finalização.

## Regras e limites
- O rascunho é criado antes da revisão. Cancelar ou fechar não o apaga.
- "Voltar" retorna ao upload; não é desfazer a criação.
- DOCX precisa ter pelo menos 20 caracteres de texto extraído.
- Falha ao guardar o original pode permitir continuar com aviso; não é transação única.
- Extração por IA exige revisão e pode falhar por créditos, limites ou conteúdo inválido.
- Conseguir importar não garante permissão para finalizar a atualização.

## Erros comuns
"Formato não suportado. Use .pdf ou .docx.": converta o arquivo.
"Rascunho salvo em Contratos. Você pode retomar quando quiser.": confira o rascunho antes de repetir a importação.

## Relacionados
- [Importar em lote](/ajuda/contracts/importar-em-lote)
- [Consultar contratos](/ajuda/contracts/consultar-contratos)
- [Permissões](/ajuda/contracts/permissoes)$hlp$, $hlp$howto$hlp$, $hlp$/contracts$hlp$, NULL, $hlp$internal$hlp$, 23, 1, true),
($hlp$contracts$hlp$, $hlp$importar-em-lote$hlp$, $hlp$Importar contratos em lote e revisar resultados$hlp$, $hlp$Importar contratos em lote e revisar resultados no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Importar contratos em lote e revisar resultados
**Para que serve:** Importar contratos em lote e revisar resultados.
**Quem pode fazer:** Gerenciamento de imports; pareamento exige links.manage e aditivos exigem atualização de contratos.
**Onde fica:** TechContracts > Contratos (/contracts).
**Antes de começar:** Arquivos válidos e principais identificados para os aditivos.

## Passo a passo
1. Clique em "Importar em lote" e adicione os arquivos.
2. Por arquivo, escolha "Detectar com IA", "Prestação (cliente final)" ou "Compra (prestador)".
3. Escolha "Principal" ou "Aditivo". Para aditivo, indique principal existente ou principal do lote, número e vigência quando aplicável.
4. Clique em "Processar".
5. Confira o resultado de cada item e seus vínculos. Use "Abrir" para revisar rascunhos criados.
<!-- screenshot: Importar contratos em lote e revisar resultados, sem dados pessoais reais -->

## Resultado esperado
Arquivos processados sequencialmente, com principais antes dos aditivos; resultados podem ser parciais.

## Regras e limites
- PDF até 15 MB e DOCX até 10 MB por arquivo.
- Nome/tamanho iguais evitam inclusão repetida na fila, não duplicação contra a base.
- A fila não tem teto explícito, mas o pareamento final aceita até 50 IDs. Lotes maiores podem criar rascunhos e falhar no pareamento.
- Papel manual prevalece sobre a IA. Sem papel extraído, o automático assume Prestação.
- Falha de vínculo de aditivo não apaga o rascunho nem garante repetição automática desse vínculo.
- "Processamento concluído." não significa sucesso de todos os arquivos e vínculos.

## Erros comuns
Aditivo sem principal impede iniciar. Revise itens com erro antes de tentar novamente; não reimporte cegamente um rascunho já criado.

## Relacionados
- [Revisar vinculação](/ajuda/contracts/revisar-vinculacao)
- [Importar individualmente](/ajuda/contracts/importar-contrato)$hlp$, $hlp$howto$hlp$, $hlp$/contracts$hlp$, NULL, $hlp$internal$hlp$, 24, 1, true),
($hlp$contracts$hlp$, $hlp$importar-modelo$hlp$, $hlp$Importar um modelo de contrato$hlp$, $hlp$Importar um modelo de contrato no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Importar um modelo de contrato
**Para que serve:** Importar um modelo de contrato.
**Quem pode fazer:** Criação de techcontracts.contract_templates.
**Onde fica:** TechContracts > Contratos (/contracts/templates).
**Antes de começar:** Arquivo PDF ou DOCX com texto legível.

## Passo a passo
1. Clique em "Importar modelo".
2. Informe um nome se desejar.
3. Selecione o arquivo PDF ou DOCX.
4. Aguarde a extração e a sugestão de variáveis.
5. Abra o rascunho criado e revise seu conteúdo antes de publicar.
<!-- screenshot: Importar um modelo de contrato, sem dados pessoais reais -->

## Resultado esperado
"Modelo criado como rascunho. Revise as variáveis sugeridas."

## Regras e limites
- PDF: até 15 MB. DOCX: até 10 MB.
- A importação não publica o modelo. Sugestões de variáveis exigem revisão humana.

## Erros comuns
"Formato não suportado. Envie .pdf ou .docx.": converta o arquivo.
"Não foi possível extrair o texto do .docx.": revise o documento de origem.

## Relacionados
- [Editar e publicar modelo](/ajuda/contracts/editar-publicar-modelo)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/templates$hlp$, NULL, $hlp$internal$hlp$, 62, 1, true),
($hlp$contracts$hlp$, $hlp$iniciar-aprovacoes$hlp$, $hlp$Iniciar e reiniciar aprovações de contrato$hlp$, $hlp$Iniciar e reiniciar aprovações de contrato no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Iniciar e reiniciar aprovações de contrato
**Para que serve:** Iniciar e reiniciar aprovações de contrato.
**Quem pode fazer:** Gerenciamento de techcontracts.approvals e atualização do contrato.
**Onde fica:** TechContracts > Contratos (/contracts/$id).
**Antes de começar:** Contrato não vigente nem encerrado; condições revisadas.

## Passo a passo
1. Abra o painel de aprovações na ficha.
2. Clique em "Iniciar fluxo".
3. Acompanhe as etapas pendentes.
4. Quando precisar abrir uma nova cadeia, clique em "Reiniciar" e confirme a preservação das decisões anteriores no histórico.
<!-- screenshot: Iniciar e reiniciar aprovações de contrato, sem dados pessoais reais -->

## Resultado esperado
"Fluxo de aprovação iniciado" ou "Fluxo reiniciado"; contrato em revisão.

## Regras e limites
- Prestação: Jurídico → Financeiro. Compra: Compras → Financeiro → Jurídico.
- Cadeia não pode ser omitida ou reduzida.
- Iniciar sem reiniciar reutiliza o fluxo existente.
- Reiniciar preserva decisões antigas no histórico e abre nova geração.
- Ativos, encerrados e rescindidos não iniciam esse processo.

## Erros comuns
"Contrato encerrado ou vigente: use aditivo para novo processo." ou "A cadeia de aprovação não pode ser omitida ou reduzida.": respeite o processo indicado.

## Relacionados
- [Aprovar ou rejeitar](/ajuda/contracts/decidir-aprovacao)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/$id$hlp$, NULL, $hlp$internal$hlp$, 32, 1, true),
($hlp$contracts$hlp$, $hlp$padronizar-titulos$hlp$, $hlp$Revisar e padronizar títulos de contratos$hlp$, $hlp$Revisar e padronizar títulos de contratos no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Revisar e padronizar títulos de contratos
**Para que serve:** Revisar e padronizar títulos de contratos.
**Quem pode fazer:** Permissão de atualização de contratos, inclusive na prévia.
**Onde fica:** TechContracts > Contratos (/contracts).
**Antes de começar:** Conferir os registros e as sugestões antes de aplicar.

## Passo a passo
1. Clique em "Padronizar títulos" no cabeçalho ou na barra de seleção.
2. Confira a prévia dos títulos antes/depois.
3. Selecione os registros desejados; no diálogo geral, use "Selecionar todos" quando adequado.
4. Confirme a aplicação. A barra de seleção mostra exemplos antes de aplicar.
5. Revise o resultado e as falhas.
<!-- screenshot: Revisar e padronizar títulos de contratos, sem dados pessoais reais -->

## Resultado esperado
Títulos atualizados nos contratos selecionados, sem modificar seu papel por esse procedimento.

## Regras e limites
- Executor aceita de 1 a 500 IDs.
- "Nenhum título precisa de ajuste." indica que não há mudanças na prévia.
- Sugestão de título não substitui leitura do documento.

## Erros comuns
Contratos não atualizados devem ser revisados no resumo; não considere a padronização sucesso integral sem conferir.

## Relacionados
- [Consultar contratos](/ajuda/contracts/consultar-contratos)
- [Permissões](/ajuda/contracts/permissoes)$hlp$, $hlp$howto$hlp$, $hlp$/contracts$hlp$, NULL, $hlp$internal$hlp$, 29, 1, true),
($hlp$contracts$hlp$, $hlp$perguntas-frequentes$hlp$, $hlp$Perguntas frequentes do TechContracts$hlp$, $hlp$Perguntas frequentes do TechContracts no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Perguntas frequentes do TechContracts
## TechServices é outro módulo?
Não. Serviços em execução pertence ao TechContracts. O identificador services permanece legado.

## Aprovar torna o contrato ativo?
Não. A cadeia concluída leva a Aguardando assinatura. Ativação tem autorização e regras próprias.

## Ativo comprova assinatura?
Não. A evidência precisa corresponder à versão salva, partes e condições.

## Preparar assinatura envia o documento?
Não. Preparação, envio para assinatura e conclusão são etapas separadas.

## Documento enviado significa e-mail entregue?
Não há comprovação de envio de e-mail no ramo auditado. Compartilhe o link pelo meio adequado e confira o destinatário.

## Escolher DocuSign ou Clicksign conecta o provedor?
Não. Um valor selecionável não configura credenciais ou integração operacional.

## Compra aninhada é aditivo?
Não. Compra sob prestação e aditivo de principal são relações diferentes.

## Posso cadastrar serviço pela lista de serviços?
A lista não oferece criação direta. Associe o serviço na ficha do contrato de prestação.

## Medição ou provisão gera cobrança automaticamente?
Não. Preparação, aprovação e geração financeira são operações distintas. Provisão registra previsão; não gera título por si só.

## Todos os campos extraídos são editáveis?
Não. A ficha tem campos editáveis e um card separado de detalhes extraídos em leitura.

## Relacionados
- [Primeiros 15 minutos](/ajuda/contracts/primeiros-15-minutos)
- [Campos e status](/ajuda/contracts/campos-e-status)$hlp$, $hlp$faq$hlp$, NULL, NULL, $hlp$internal$hlp$, 5, 1, true),
($hlp$contracts$hlp$, $hlp$permissoes$hlp$, $hlp$Permissões do TechContracts$hlp$, $hlp$Permissões do TechContracts no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Permissões do TechContracts
## Acesso à Ajuda
Artigos internos usam o acesso ao módulo e às permissões efetivas do workspace. O menu TechContracts não declara uma chave mínima individual por item; estes artigos deixam a chave mínima vazia, sem inventar uma permissão. Isso não libera ações no contrato.

## Recursos e ações
| Área | Recurso / exigência |
|---|---|
| Contratos | techcontracts.contracts: leitura, criação, atualização, exclusão e exportação conforme escopo |
| Mudança de status | Atualização do registro + techcontracts.contract_transition.manage.workspace |
| Ativação manual | Também techcontracts.contract_activation.manage.workspace |
| Aprovações | techcontracts.approvals: view, manage, approve conforme ação |
| Histórico de aprovação | techcontracts.audit: view |
| Modelos | techcontracts.contract_templates: view, create, update, delete |
| Padrões | techcontracts.defaults: view; salvar exige manage e techcontracts.contracts.update.workspace |
| Serviços | techservice.services: view, create, update, delete no escopo aplicável |
| Associação ao catálogo | Caminho da ficha exige techservice.services.create.own |
| Evidência de assinatura | techcontracts.signature_evidence.view.workspace; gerenciar exige manage.workspace e capacidade do servidor |
| Preparação de assinatura | Também criação em techcontracts.esign no escopo aceito |
| Medições | Leitura do contrato + techprojects.billing_config / measurements / profitability, conforme seção |
| Provisões | techfinance.provisions e acesso a tarifas de TechProjects, conforme ação |

Escopos own, team e workspace não são intercambiáveis. Um botão visível não comprova autorização. Responsável pelo cadastro é informação operacional, não substitui controle de acesso.

## Ações especiais
Enviar, cancelar e compartilhar assinatura, aprovar ou gerar medição e revisar provisões possuem verificações próprias. Acesso ao módulo não concede essas ações. Para mudar acesso, procure o responsável pelas permissões; não use outra conta nem tente contornar pela URL.

## Divergências
O material preserva o comportamento existente. Diferenças entre menu, tela e controle do servidor estão em docs/help/divergencias.md; nenhuma permissão foi ampliada nesta entrega.

## Relacionados
- [Aprovações](/ajuda/contracts/iniciar-aprovacoes)
- [Medições](/ajuda/contracts/preparar-medicao)$hlp$, $hlp$reference$hlp$, NULL, NULL, $hlp$internal$hlp$, 3, 1, true),
($hlp$contracts$hlp$, $hlp$preparar-medicao$hlp$, $hlp$Preparar e consultar medições do contrato$hlp$, $hlp$Preparar e consultar medições do contrato no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Preparar e consultar medições do contrato
**Para que serve:** Preparar e consultar medições do contrato.
**Quem pode fazer:** Leitura do contrato e das seções TechProjects; preparar exige techprojects.measurements.manage.workspace.
**Onde fica:** TechContracts > Contratos (/contracts/$id/medicoes).
**Antes de começar:** Modelo de cobrança ativo e competência definida.

## Passo a passo
1. Na ficha, clique em "Medições".
2. Em "Modelo de cobrança", escolha um modelo ativo.
3. Preencha "Competência" e escolha "Tipo": "Regular" ou "Complemento".
4. Clique em "Preparar medição".
5. Revise o detalhamento aberto após "Rascunho da medição pronto para revisão.".
<!-- screenshot: Preparar e consultar medições do contrato, sem dados pessoais reais -->

## Resultado esperado
Rascunho de medição preparado para revisão, sem emissão ou envio automático ao cliente.

## Regras e limites
- Competência inicial é o mês anterior e o fuso é o do navegador.
- Lista paginada de 20 medições. Abrir a lista não cria medição.
- Etapas são separadas: rascunho, revisão, aprovação, pronta e geração no Financeiro.
- Fechar horas ou obter aceite do cliente não é gerar fatura nem receber pagamento.
- Acesso a contratos não libera automaticamente cobrança, medições, provisões ou rentabilidade.

## Erros comuns
"Configure o modelo primeiro": cadastre um modelo ativo.
"Nenhuma medição": configure cobrança e prepare a competência.

## Relacionados
- [Configurar cobrança](/ajuda/contracts/configurar-cobranca)
- [Revisar medição](/ajuda/contracts/revisar-medicao)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/$id/medicoes$hlp$, NULL, $hlp$internal$hlp$, 70, 1, true),
($hlp$contracts$hlp$, $hlp$primeiros-15-minutos$hlp$, $hlp$Primeiros 15 minutos no TechContracts$hlp$, $hlp$Primeiros 15 minutos no TechContracts no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Primeiros 15 minutos no TechContracts
## 1. Reconheça a carteira
Abra Dashboard e depois Contratos. Veja as abas e filtros. Os indicadores respeitam limites de consulta; não são uma prova de toda a base.

## 2. Abra uma ficha
Confira título, tipo, valor e vigência. Diferencie prestação, compra e aditivo. Não altere um registro real apenas para treinar.

## 3. Entenda os vínculos
Prestação pode reunir serviços e contratos de compra aninhados. Aditivo tem principal do mesmo papel e é uma relação distinta.

## 4. Confira o processo
Aprovação leva a Aguardando assinatura, não a Ativo. Preparar assinatura não conclui assinatura. Evidência deve corresponder à versão salva.

## 5. Consulte a cobrança
Medições reúne configuração de cobrança e etapas de revisão/aprovação/geração financeira. Provisão não é título a pagar ou receber. Não gere lançamentos para treinar.

## Próxima leitura
- [Criar contrato](/ajuda/contracts/criar-contrato)
- [Editar contrato](/ajuda/contracts/editar-contrato)
- [Medições](/ajuda/contracts/preparar-medicao)
- [Permissões](/ajuda/contracts/permissoes)$hlp$, $hlp$quickstart$hlp$, NULL, NULL, $hlp$internal$hlp$, 1, 1, true),
($hlp$contracts$hlp$, $hlp$recalcular-papeis$hlp$, $hlp$Revisar e recalcular Prestação ou Compra$hlp$, $hlp$Revisar e recalcular Prestação ou Compra no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Revisar e recalcular Prestação ou Compra
**Para que serve:** Revisar e recalcular Prestação ou Compra.
**Quem pode fazer:** Gerenciamento de techcontracts.links e acesso aos contratos.
**Onde fica:** TechContracts > Contratos (/contracts/links).
**Antes de começar:** Conferir a WK como prestadora ou contratante nos documentos.

## Passo a passo
1. Na vinculação, clique em "Recalcular papéis".
2. Revise o diagnóstico de Prestação/Compra.
3. Selecione somente correções confirmadas e aplique.
4. Confira o resultado.
<!-- screenshot: Revisar e recalcular Prestação ou Compra, sem dados pessoais reais -->

## Resultado esperado
Papel comercial corrigido nos registros selecionados.

## Regras e limites
- Aplicação aceita de 1 a 500 IDs.
- Prestação/Compra não é Principal/Aditivo.
- Diagnóstico não substitui conferência do documento.

## Erros comuns
Sugestão incorreta: deixe sem seleção. Falha de acesso ou gravação: revise a mensagem.

## Relacionados
- [Revisar tipo de documento](/ajuda/contracts/revisar-tipo-documento)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/links$hlp$, NULL, $hlp$internal$hlp$, 45, 1, true),
($hlp$contracts$hlp$, $hlp$registrar-assinatura$hlp$, $hlp$Preparar e registrar evidência de assinatura no contrato$hlp$, $hlp$Preparar e registrar evidência de assinatura no contrato no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Preparar e registrar evidência de assinatura no contrato
**Para que serve:** Preparar e registrar evidência de assinatura no contrato.
**Quem pode fazer:** techcontracts.signature_evidence.view.workspace para ler; manage.workspace e capacidade do servidor para gerenciar; preparação exige também criação de esign.
**Onde fica:** TechContracts > Contratos (/contracts/$id).
**Antes de começar:** Salvar a versão final do contrato e revisar suas partes e condições.

## Passo a passo
1. Abra "Assinatura e origem do recrutamento".
2. Para assinatura interna, clique em "Preparar assinatura no TechERP" e preencha representantes/e-mails do cliente e da entidade WK.
3. Conclua a preparação; siga depois o envio e assinatura do documento preparado.
4. Para assinatura externa, clique em "Registrar assinatura externa".
5. Informe "PDF assinado (até 5 MB)", "Data da assinatura", "Referência do provedor ou certificado" e "Como foi conferido". Faça a confirmação explícita antes de concluir.
<!-- screenshot: Preparar e registrar evidência de assinatura no contrato, sem dados pessoais reais -->

## Resultado esperado
Documento preparado aguardando envio/conclusão, ou evidência externa registrada para a versão conferida.

## Regras e limites
- As ações usam a versão salva do contrato.
- Preparar não é enviar nem concluir assinatura.
- Ativar ou preencher uma data não comprova assinatura.
- Registro externo depende de conferência humana; não valida criptograficamente as assinaturas.
- Alterar conteúdo, partes ou condições exige nova evidência.

## Erros comuns
"Selecione um PDF de até 5 MB.": revise formato/tamanho.
"Sem permissão ou contrato alterado. Recarregue.": recarregue e confira a versão.
"Não foi possível guardar o PDF assinado.": tente novamente após conferir o arquivo.

## Relacionados
- [Consultar e revogar evidências](/ajuda/contracts/revogar-evidencia)
- [Documentos de assinatura](/ajuda/contracts/gerenciar-documentos-assinatura)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/$id$hlp$, NULL, $hlp$internal$hlp$, 37, 1, true),
($hlp$contracts$hlp$, $hlp$registrar-origem-comercial$hlp$, $hlp$Salvar origem comercial e definir origem do recrutamento$hlp$, $hlp$Salvar origem comercial e definir origem do recrutamento no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Salvar origem comercial e definir origem do recrutamento
**Para que serve:** Salvar origem comercial e definir origem do recrutamento.
**Quem pode fazer:** Leitura e gerenciamento de techcontracts.signature_evidence, com capacidade de gerenciamento devolvida pelo servidor.
**Onde fica:** TechContracts > Contratos (/contracts/$id).
**Antes de começar:** Negócio correto e CNPJ WK disponíveis.

## Passo a passo
1. Abra "Assinatura e origem do recrutamento".
2. Escolha "Negócio" e "Entidade WK prestadora" em "Selecione o CNPJ".
3. Clique em "Salvar origem".
4. Quando adequado, clique em "Definir como origem do recrutamento".
<!-- screenshot: Salvar origem comercial e definir origem do recrutamento, sem dados pessoais reais -->

## Resultado esperado
Origem comercial salva; definição da origem do recrutamento é uma ação separada.

## Regras e limites
- Cliente vem do negócio selecionado.
- Mudar origem ou entidade invalida correspondência com assinaturas anteriores.
- Definir origem não registra assinatura, não aprova a demanda nem libera recrutamento sozinho.
- Ainda são necessárias aprovação da área, CEO e demais regras aplicáveis.

## Erros comuns
"Autorização comercial pendente": leia os impedimentos. Sem negócio ou CNPJ, não é possível salvar origem.

## Relacionados
- [Registrar assinatura](/ajuda/contracts/registrar-assinatura)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/$id$hlp$, NULL, $hlp$internal$hlp$, 36, 1, true),
($hlp$contracts$hlp$, $hlp$revisar-medicao$hlp$, $hlp$Revisar, ajustar e enviar uma medição para revisão$hlp$, $hlp$Revisar, ajustar e enviar uma medição para revisão no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Revisar, ajustar e enviar uma medição para revisão
**Para que serve:** Revisar, ajustar e enviar uma medição para revisão.
**Quem pode fazer:** techprojects.measurements.view.workspace para consultar e manage.workspace para atualizar, ajustar e enviar.
**Onde fica:** TechContracts > Contratos (/contracts/$id/medicoes).
**Antes de começar:** Medição em rascunho e fontes disponíveis.

## Passo a passo
1. Abra o detalhe da medição.
2. Clique em "Atualizar prévia" e confira linhas, itens excluídos e pendências.
3. Quando necessário, use "Adicionar ajuste", informando descrição, valor e motivo. Valor negativo representa desconto.
4. Para sucesso/Hunting, use "Adicionar evento" e escolha proposta ou candidatura do TechHire com identificador/base exigidos.
5. Resolva "Pendências (impedem envio e aprovação)".
6. Clique em "Enviar para revisão".
<!-- screenshot: Revisar, ajustar e enviar uma medição para revisão, sem dados pessoais reais -->

## Resultado esperado
Medição em revisão; nenhum documento ou cobrança enviado ao cliente.

## Regras e limites
- Ajuste: descrição de 3–200 caracteres, valor finito diferente de zero e motivo de 10–2.000 caracteres.
- Evento exige UUID válido; o sistema não presume um evento de sucesso automaticamente.
- Fontes alteradas exigem atualizar a prévia. Envio valida o hash.
- Ajuste não é alteração silenciosa da tarifa.

## Erros comuns
SUBMIT_BLOCKED: resolva as pendências impeditivas. Prévia desatualizada: atualize antes de enviar.

## Relacionados
- [Aprovar medição](/ajuda/contracts/aprovar-medicao)
- [Preparar medição](/ajuda/contracts/preparar-medicao)
- [Permissões](/ajuda/contracts/permissoes)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/$id/medicoes$hlp$, NULL, $hlp$internal$hlp$, 72, 1, true),
($hlp$contracts$hlp$, $hlp$revisar-tipo-documento$hlp$, $hlp$Revisar contratos principais que parecem aditivos$hlp$, $hlp$Revisar contratos principais que parecem aditivos no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Revisar contratos principais que parecem aditivos
**Para que serve:** Revisar contratos principais que parecem aditivos.
**Quem pode fazer:** links.view para diagnóstico; links.manage e atualização de contratos para aplicar.
**Onde fica:** TechContracts > Contratos (/contracts).
**Antes de começar:** Confirmar principal e papel comercial de cada suspeito.

## Passo a passo
1. Clique em "Revisar tipo de documento".
2. Revise suspeitos e motivos do diagnóstico.
3. Selecione os registros e confira principal e número de aditivo.
4. Aplique as correções selecionadas.
5. Confira itens corrigidos, ignorados e eventuais falhas.
<!-- screenshot: Revisar contratos principais que parecem aditivos, sem dados pessoais reais -->

## Resultado esperado
Contratos selecionados classificados como aditivo e vinculados ao principal indicado.

## Regras e limites
- Diagnóstico usa até 2.000 contratos mais recentes, com sinais de título, avisos, número e arquivo.
- Não é extração de todos os documentos por IA.
- Até 10 candidatos por suspeito; primeira sugestão não prova correspondência.
- Aplicação grava tipo, principal, número, vigência a partir do início e título padronizado quando disponível.
- Revisão Principal/Aditivo não é recálculo Prestação/Compra.

## Erros comuns
Suspeita incorreta: não selecione. Falha no diagnóstico: use nova tentativa. Itens já aditivos, ausentes ou autovinculados podem ser ignorados.

## Relacionados
- [Recalcular papéis](/ajuda/contracts/recalcular-papeis)
- [Vincular aditivos](/ajuda/contracts/vincular-aditivo)$hlp$, $hlp$howto$hlp$, $hlp$/contracts$hlp$, NULL, $hlp$internal$hlp$, 42, 1, true),
($hlp$contracts$hlp$, $hlp$revisar-vinculacao$hlp$, $hlp$Vincular contratos e remover pendências da fila$hlp$, $hlp$Vincular contratos e remover pendências da fila no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Vincular contratos e remover pendências da fila
**Para que serve:** Vincular contratos e remover pendências da fila.
**Quem pode fazer:** Leitura de techcontracts.links; dispensar exige gerenciamento; aplicar vínculo exige atualização de contratos e acesso aos registros.
**Onde fica:** TechContracts > Contratos (/contracts/links).
**Antes de começar:** Identificar compra, prestação ou aditivo e destino correto.

## Passo a passo
1. Clique em "Vincular contratos" na lista.
2. Na tela "Vinculação de contratos", use "Buscar" e "Tipo": Todos, Prestação, Compra ou Aditivos.
3. Clique em "Vincular" no registro, escolha o destino e confirme.
4. Compra deve apontar para prestação; aditivo deve apontar para principal do mesmo papel.
5. Se a pendência não exigir vínculo, use "Remover da fila".
<!-- screenshot: Vincular contratos e remover pendências da fila, sem dados pessoais reais -->

## Resultado esperado
"Contratos vinculados.", "Aditivo vinculado." ou "Contrato removido da fila de vinculação.", conforme ação.

## Regras e limites
- Busca filtra localmente os registros carregados; fila limitada a 500.
- Remover da fila não exclui contrato, não cria vínculo e não pede confirmação nesse componente.
- Candidatos da tela ainda podem ser recusados pelas regras do servidor.
- Compra/prestação e principal/aditivo são relações distintas.

## Erros comuns
Destino recusado: confira papel, tipo de documento, autovínculo e nível permitido.

## Relacionados
- [Aninhar contratos](/ajuda/contracts/aninhar-contratos)
- [Sugestões de IA](/ajuda/contracts/analisar-vinculos-ia)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/links$hlp$, NULL, $hlp$internal$hlp$, 43, 1, true),
($hlp$contracts$hlp$, $hlp$revogar-evidencia$hlp$, $hlp$Consultar comprovante e revogar evidência de assinatura$hlp$, $hlp$Consultar comprovante e revogar evidência de assinatura no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Consultar comprovante e revogar evidência de assinatura
**Para que serve:** Consultar comprovante e revogar evidência de assinatura.
**Quem pode fazer:** Leitura de signature_evidence; para revogar, gerenciamento e capacidade do servidor.
**Onde fica:** TechContracts > Contratos (/contracts/$id).
**Antes de começar:** Identificar a evidência correta e justificar a revogação.

## Passo a passo
1. Abra o card de assinatura na ficha.
2. Consulte a evidência e abra o comprovante quando disponível.
3. Quando necessário, clique em "Revogar evidência".
4. Informe "Motivo" com pelo menos 10 caracteres.
5. Clique em "Revogar" e confira o resultado.
<!-- screenshot: Consultar comprovante e revogar evidência de assinatura, sem dados pessoais reais -->

## Resultado esperado
Evidência revogada com motivo registrado; a revogação não deve ser confundida com exclusão do contrato.

## Regras e limites
- Comprovante respeita o acesso ao contrato/evidência.
- Revogar é ação distinta de editar status ou cancelar documento de assinatura.

## Erros comuns
"Comprovante indisponível no seu acesso." ou "Não foi possível abrir o PDF.": confira sua autorização e a disponibilidade do arquivo.

## Relacionados
- [Registrar assinatura](/ajuda/contracts/registrar-assinatura)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/$id$hlp$, NULL, $hlp$internal$hlp$, 38, 1, true),
($hlp$contracts$hlp$, $hlp$vincular-aditivo$hlp$, $hlp$Vincular e desvincular aditivos$hlp$, $hlp$Vincular e desvincular aditivos no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Vincular e desvincular aditivos
**Para que serve:** Vincular e desvincular aditivos.
**Quem pode fazer:** Atualização do contrato e das relações no escopo autorizado.
**Onde fica:** TechContracts > Contratos (/contracts/$id).
**Antes de começar:** Ter contrato principal e aditivo do mesmo papel.

## Passo a passo
1. Para classificar pela ficha, escolha "Tipo de documento" = "Aditivo", selecione "Contrato principal" e salve.
2. No painel de aditivos, use "Vincular aditivo" ou "Alterar contrato principal".
3. Selecione o contrato correspondente e informe "Número do aditivo" e "Vigência do aditivo" quando aplicável.
4. Clique em "Vincular".
5. Para desvincular, use a ação de remover vínculo e confirme "Remover o vínculo de aditivo deste contrato?".
<!-- screenshot: Vincular e desvincular aditivos, sem dados pessoais reais -->

## Resultado esperado
"Aditivo vinculado." ou "Vínculo de aditivo removido.".

## Regras e limites
- Um contrato não pode ser aditivo de si mesmo.
- Aditivo não pode ser principal de outro aditivo.
- Principal e aditivo devem ter o mesmo papel.
- Alterar para Principal remove vínculo, número e vigência do aditivo após confirmação.
- Essa relação não é o aninhamento de compra sob prestação.

## Erros comuns
"Contrato principal não encontrado." ou "O aditivo deve ter o mesmo papel do contrato principal.": revise o destino.

## Relacionados
- [Aninhar compra e prestação](/ajuda/contracts/aninhar-contratos)$hlp$, $hlp$howto$hlp$, $hlp$/contracts/$id$hlp$, NULL, $hlp$internal$hlp$, 34, 1, true),
($hlp$contracts$hlp$, $hlp$visao-geral$hlp$, $hlp$Visão geral do TechContracts$hlp$, $hlp$Visão geral do TechContracts no TechContracts, com as regras e limites disponíveis no sistema.$hlp$, $hlp$# Visão geral do TechContracts
## O que o módulo reúne
O TechContracts reúne contratos de prestação e compra, modelos, aprovações, evidências de assinatura e serviços em execução. Não existe módulo vertical TechServices: a tela de Serviços em execução pertence ao TechContracts.

## Navegação
- Visão geral > Dashboard.
- Contratos > Contratos, Modelos de contrato, Serviços em execução e Padrões de contrato.
- Na ficha: Fluxo do contrato, Medições, aditivos, compras aninhadas e assinatura, conforme acesso.

## Operações separadas
Criar contrato, aprovar, registrar assinatura, ativar serviço, preparar medição e gerar título financeiro são operações distintas. Nenhuma dessas situações, sozinha, comprova as demais.

## Comece por aqui
- [Primeiros 15 minutos](/ajuda/contracts/primeiros-15-minutos)
- [Consultar contratos](/ajuda/contracts/consultar-contratos)
- [Criar contrato](/ajuda/contracts/criar-contrato)
- [Permissões](/ajuda/contracts/permissoes)$hlp$, $hlp$overview$hlp$, NULL, NULL, $hlp$internal$hlp$, 0, 1, true)
ON CONFLICT (module_key, slug) DO NOTHING;
