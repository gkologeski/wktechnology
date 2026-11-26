---
module_key: projects
slug: operar-imports
title: Importar o histórico do Clockify, Jibble e ClickUp
summary: Jornada única para receber o histórico completo, preservar erros e originais, retomar interrupções e conferir pendências sem aprovar horas automaticamente.
article_type: howto
route_pattern: /projects/settings/imports
min_permission:
audience: internal
sort_order: 100
version: 3
is_published: true
---

# Importar o histórico do Clockify, Jibble e ClickUp

**Para que serve:** Receber o histórico completo das origens autorizadas em uma jornada única, preservando também registros incompletos ou com erro. Consultar o original não significa aprovar horas, liberar pagamento ou gerar faturamento.

**Quem pode fazer:** Administrador ativo do workspace ativo com permissão de consulta do importador correspondente. Iniciar, retomar e conferir registros exige também a permissão de gestão daquela origem. A Conciliação de horas possui autorização própria. Negação prevalece; pessoas históricas importadas não recebem acesso ao TechERP.

**Onde fica:** TechProjects > Importações (`/projects/settings/imports`). A configuração de cada conexão abre em um painel pelo comando **Ver conexão** ou **Configurar conexão**, sem sair da jornada. Agendas ficam em **Configurações avançadas e agenda**.

**Antes de começar:** Confirme o workspace do TechERP, as conexões e as organizações de origem. Uma credencial poder enxergar outra empresa não autoriza importar seus dados para este workspace. Não compartilhe chaves, senhas ou tokens em conversas, capturas ou chamados.

## Passo a passo

1. Em **Origens**, confira Clockify, Jibble e ClickUp. As origens conectadas e autorizadas para sua conta ficam selecionadas. Se uma conexão estiver incompleta, use **Configurar conexão**, conclua a configuração e volte à jornada. Escolher origens não permite excluir registros individuais com erro.
2. No painel de conexão do Clockify, teste a chave e escolha explicitamente a organização. No Jibble, teste as credenciais e confirme a organização retornada. No ClickUp, cadastre a chave no campo protegido e use **Salvar e testar chave** quando a conexão ainda não existir. Depois marque somente as organizações autorizadas e clique em **Confirmar organizações**. A chave pertence ao workspace ativo; trocar a chave exige confirmar as organizações novamente. Os registros de outras empresas visíveis à credencial não são escolhidos automaticamente.
3. Clique em **Conferir cobertura**. Expanda cada origem para ver os tipos de registro, as contagens já recebidas e qualquer limitação de acesso ou da API. A nova execução abrange todo o período acessível, incluindo arquivados. **A verificar** e **Cobertura indisponível** não significam que há zero registros.
4. Clique em **Importar todos os registros**. A leitura avança em etapas enquanto a tela está aberta, respeitando os limites de cada origem. Não é necessário resolver vínculos antes de preservar o histórico.
5. Se houver interrupção, confira a mensagem e use **Retomar importação**, quando disponível. Os registros já recebidos continuam consultáveis e a retomada reconhece os identificadores de origem para evitar duplicação. Uma execução com lacuna não recebe cobertura completa. **Limitações da origem** identifica capacidades que a API não fornece, como recuperar tarefas apagadas; esse caso não oferece uma retomada que repetiria a mesma limitação.
6. Em **Revisar resultado**, confira os registros recebidos, prontos para uso, pendentes e ainda em classificação. Um registro já existente não deve ser somado como uma segunda hora. Diferentes sistemas podem ter registrado o mesmo trabalho; os originais de ambos permanecem preservados.
7. Abra **Registros recebidos** para buscar e filtrar por origem e situação. Use **Ver registro** para consultar o original, selecionar versões recebidas e ver a trilha de conferência. Se houver mais páginas, use **Carregar versões anteriores** ou **Carregar mais decisões**; esses comandos mantêm a evidência selecionada. Em **Conteúdos preservados**, use **Baixar** quando o arquivo tiver sido obtido. Se o navegador bloquear a nova janela, use o link preparado no painel. Arquivos pendentes mantêm sua identificação e o motivo da falha. Os dados também ficam acessíveis durante uma coleta parcial.
8. Abra **Pendências** e use **Conferir**. Um lançamento pode ter vários avisos, mas conta como um registro. Quando houver vínculo suportado, busque e escolha explicitamente o projeto ou a pessoa cadastrada, informe o motivo e use **Salvar vínculo**. Se também escolher um responsável, use **Salvar vínculo e encaminhar** para registrar as duas decisões juntas. Um nome parecido não confirma uma associação.
9. Para documentar uma divergência sem vincular, informe a orientação e use **Registrar anotação**. Para encaminhar, busque um membro ativo com acesso à origem, selecione seu nome e use **Encaminhar conferência**. O responsável fica registrado no painel e pode usar **Minhas pendências** na aba Pendências. O encaminhamento ocorre dentro da central; não envia e-mail ou WhatsApp. A anotação, a atribuição e o vínculo não alteram o original nem tornam horas aprovadas. A pendência permanece até a reavaliação no processamento da origem. Se a origem tiver mudado desde a leitura, a gravação é recusada: use **Atualizar evidência**, confira a nova versão e escolha novamente o vínculo ou responsável; sua orientação digitada é mantida.
10. Em **Histórico**, consulte as execuções, origens, contagens e interrupções. Use **Ver execução** para conferir os detalhes; retome apenas quando a opção estiver disponível.

## Resultado esperado

Os registros recebidos ficam disponíveis com seus dados originais, versões e pendências. Cada origem informa a cobertura comprovada e as limitações encontradas. A importação não aprova horas nem libera pagamentos ou faturamento.

## Como entender o resultado

- **Recebido · a classificar:** o original foi preservado, mas sua situação operacional ainda não foi determinada.
- **Pronto para uso:** o registro pode seguir seu fluxo normal, conforme o tipo e as permissões. Isso não equivale a hora aprovada ou apta para faturamento.
- **Com pendência:** o dado continua disponível, mas há algo a conferir, como vínculo ausente, intervalo inválido, ponto aberto, ajuste manual ou sobreposição.
- **Coleta incompleta:** uma parte da origem ainda não foi recebida, está sem acesso ou depende de uma capacidade indisponível. Confira o motivo. Não trate esse estado como importação integral.
- **Limitações da origem:** a leitura terminou com uma capacidade que o fornecedor não disponibiliza. Os registros recebidos ficam preservados, a limitação continua explícita e não há retomada automática sem solução.
- **Cobertura completa:** os tipos previstos foram consultados integralmente para a origem autorizada. Os erros que já existiam nos registros podem continuar em Pendências.

As contagens de registros e de avisos são diferentes. Contagens de tarefas, pontos, arquivos e ajustes também não representam uma soma de horas trabalhadas.

## Regras e limites

- Registros inválidos, arquivados e pessoas inativas permanecem como evidência histórica; não é necessário apagá-los para concluir a coleta.
- A importação preserva os valores originais e suas versões. Credenciais e dados de acesso não fazem parte da exibição histórica.
- Ponto sem saída, duração zero ou intervalo negativo não recebe horário inventado. Totais e ajustes do Jibble não são somados automaticamente aos intervalos como novas horas.
- Originais equivalentes de Clockify, Jibble ou ClickUp não autorizam dupla contagem de horas. A conferência da contabilização é separada da preservação da origem.
- O catálogo informa a cobertura efetiva de comentários, anexos, documentos e horas próprias do ClickUp. Uma entidade sem acesso ou conteúdo indisponível permanece como lacuna, sem sucesso fictício.
- A leitura não modifica os sistemas de origem. Reimportar não autoriza sobrescrever uma edição posterior feita no TechERP.
- Somente leitura/Ver Como não pode iniciar, retomar, vincular ou registrar conferência. Trocar o workspace muda as conexões, os registros, o histórico e as permissões disponíveis.
- Agendas e configurações avançadas continuam nos painéis de cada provedor. Uma agenda habilitada não garante execução nem cobertura integral; consulte o resultado e as limitações da origem.

## Erros comuns

- **Origem não conectada:** conclua a conexão e confirme a organização correta. Não use outra empresa apenas porque ela aparece para a mesma credencial.
- **Leitura interrompida:** mantenha os registros recebidos, confira o motivo e use a retomada disponível. Evite abrir várias execuções para tentar repetir a mesma leitura.
- **Registro sem vínculo:** escolha o cadastro autorizado e registre como confirmou a correspondência. A importação não concede permissões ao cadastro escolhido.
- **Lançamento incorreto:** consulte a evidência original e registre a orientação para conferência. Preservar o erro não torna sua duração válida.
- **Falha na consulta:** use **Tentar novamente**. Uma falha de carregamento não significa ausência de registros ou zero pendências.
- **Ação negada:** confira o workspace ativo, a permissão da origem e se a sessão está em modo somente leitura. Não tente contornar por URL ou exportando os dados.

## Relacionados

- [Configurar Clockify](/ajuda/projects/operar-imports-clockify)
- [Configurar Jibble](/ajuda/projects/operar-imports-jibble)
- [Configurar ClickUp](/ajuda/projects/operar-imports-clickup)
- [Conciliação de horas e vínculos](/ajuda/projects/operar-imports-reconciliation)
- [Permissões](/ajuda/projects/permissoes)
