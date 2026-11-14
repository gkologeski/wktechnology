---
module_key: crm
slug: acompanhar-jornada-de-contratacao
title: Acompanhar a jornada comercial e contratação
summary: Conduza cotação, proposta, minuta, assinatura e início do serviço na ficha do negócio.
article_type: howto
route_pattern: /deals/$id
min_permission:
audience: internal
sort_order: 1
version: 5
is_published: true
---
# Acompanhar a jornada comercial e contratação
**Para que serve:** Reunir as etapas comerciais e contratuais, com o documento vigente, responsável operacional e próximo passo.
**Quem pode fazer:** Membro ativo com acesso ao negócio. Cada documento e ação exige suas permissões próprias. Preparar uma minuta manualmente exige `techcontracts.contract_drafts.create.workspace`; revisar e enviar exige ser aprovador jurídico configurado e ter a permissão de aprovação. Contratos, assinaturas e serviços mantêm suas alçadas existentes.
**Onde fica:** TechSales > Negócios > ficha do negócio > lateral direita > Contratação > Abrir jornada e documentos (`/deals/$id`).
**Antes de começar:** Vincule cliente, itens de linha e empresa prestadora WK. Confira o catálogo, o modelo jurídico e os aprovadores. Nenhum cargo recebe novas permissões automaticamente.

## Passo a passo
1. Na etapa **Cotação**, prepare e envie os valores pelos controles existentes. Depois da concordância do cliente, prepare a proposta.
2. Em **Proposta**, acompanhe o aceite formal. A proposta aceita deve ter sua versão e decisão preservadas; isso ainda não inicia o serviço.
3. Em **Minuta**, use a abertura pelo workflow ou **Preparar minuta para revisão**. O Jurídico confere o modelo, usa **Preencher dados da proposta**, resolve as pendências nos cadastros, confere a vigência e aprova o envio. O link público permite que o cliente aceite as cláusulas ou solicite ajustes.
4. Ajustes passam novamente pelo Jurídico. **Preparar nova revisão** exige motivo e revoga o aceite e o link anteriores. Depois de criado o contrato definitivo, mudanças devem ser formalizadas por aditivo.
5. Após o aceite da minuta, o **Financeiro** confere a origem e prepara o contrato. O texto é o da minuta aceita, sem regenerar cláusulas do modelo atual. Valores estruturados, itens, pagamento e vigência são preservados da origem aprovada. Se faltar valor estruturado, regularize a proposta antes de continuar. Criar não envia automaticamente para assinatura.
6. Em **Contrato e assinaturas**, confira aprovações e signatários no próprio painel. Use **Enviar para assinatura por e-mail**, revise os destinatários e confirme. O convite é pessoal e seu resultado aparece por signatário. O reenvio alcança apenas pendentes, com intervalo mínimo de 60 segundos. Confira aprovações e assinaturas. O documento nativo é preparado e enviado pelos controles de Assinaturas; evidência externa exige o PDF e conferência autorizada. Assinatura parcial, evidência revogada ou conteúdo alterado não liberam a operação.
7. Com assinatura verificável e aprovações válidas, organize a entrega e ative os serviços pelos controles existentes. A assinatura não dispensa as regras próprias de recrutamento, alocação e faturamento.
8. Consulte **Documentos** e **Histórico** sem sair do contexto comercial. A timeline permanece no centro da ficha. A jornada abre na lateral, sem ocupar o histórico.

## Resultado esperado
Cotação → proposta aceita → minuta aprovada pelo cliente → contrato com assinatura válida → serviço. A preparação de projetos pode ocorrer em planejamento; a execução segue as validações operacionais existentes.

## Regras e limites
- A etapa atual aparece com o círculo preenchido; a etapa que você está consultando aparece com o círculo vazado e borda mais grossa.
- Quando houver várias origens, selecione a proposta/cotação correspondente. A jornada não mistura documentos de propostas diferentes.
- Documentos restritos não são considerados inexistentes. Falhas de consulta aparecem como erro com opção de tentar novamente.
- Contratos históricos continuam preservados; aceites antigos ausentes não são reconstruídos.
- Revisões de texto são preservadas a partir desta implantação. O histórico existente não é inventado; consulte cada revisão sob demanda.
- O resumo carrega até 100 documentos por categoria e avisa quando há mais. Use as listagens completas nesse caso.
- O status **Ativo** não comprova assinatura. A liberação usa a evidência válida da versão atual e as regras do contrato.
- Aditivos e renovações começam no contrato existente. Contratos avulsos ficam no TechContracts.
- Em painéis estreitos, abas e etapas se organizam em mais de uma linha; o histórico usa rótulos de status em português.
- O papel Financeiro identifica o responsável operacional; não concede privilégios nem fixa uma pessoa.

## Erros comuns
- **Sem permissão:** solicite a chave da ação e o escopo adequado; não é necessário conceder administração geral.
- **Informações pendentes:** complete o cadastro indicado ou revise o texto antes de enviar. Variáveis de modelo não preenchidas impedem a aprovação.
- **Minuta sem aprovador/modelo:** configure o Jurídico e o modelo do serviço antes de enviar.
- **Mais de um contrato principal:** confira os vínculos em Documentos. Não presumimos qual contrato libera a operação.
- **Versão alterada:** recarregue a minuta; outra pessoa salvou antes de você.
- **Sem versão preservada da proposta:** obtenha um novo aceite comercial. Não é possível reconstruir a versão histórica.

## Relacionados
- [Atualizar negócio](/ajuda/crm/atualizar-negocio)
- [Revisar minuta](/ajuda/contracts/revisar-minuta)
- [Registrar assinatura](/ajuda/contracts/registrar-assinatura)
- [Ativar serviço](/ajuda/contracts/ativar-servico)

## Signatários por papel
Na preparação do contrato, escolha contatos para CONTRATANTE e CONTRATADO. Inclua testemunhas apenas quando necessário; uma vez incluídas, suas assinaturas são obrigatórias para concluir o documento. A busca permite cadastrar um novo contato com as permissões de contatos. O cadastro deve conter nome e e-mail válidos. Papéis adicionais podem ser incluídos explicitamente.

## Próximas ações, responsáveis e prazos
O quadro **Próximas ações** fica na lateral direita e mostra os encaminhamentos automáticos, responsável, prazo e impedimentos. Proposta aceita → Jurídico prepara a minuta; minuta aceita → Financeiro prepara o contrato e conduz aprovações; contrato aprovado → responsável confere signatários e envia. O envio ao cliente não é automático.

A tarefa vinculada ao negócio aparece em Tarefas e na timeline. Não pode ser encerrada nem ter responsável/prazo trocados fora da jornada. Vencimentos avisam o responsável e o escalonamento configurados. Administradores autorizados podem conferir fontes pendentes ou reprocessar impedimentos, sem duplicar tarefas. Processamento periódico normalmente em até dois minutos; contratos históricos não geram novas minutas apenas por reconciliação.

As aprovações internas também geram tarefas: Jurídico primeiro; Financeiro somente após a aprovação jurídica. Cada solicitação usa o responsável da etapa vigente e o prazo configurado do departamento, sem reduzir a cadeia obrigatória.

Um documento nativo já integralmente assinado também encerra a tarefa de envio, mesmo se os links foram compartilhados manualmente. Negócios removidos cancelam seus encaminhamentos pendentes.
