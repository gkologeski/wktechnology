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
version: 1
is_published: true
---
# Acompanhar a jornada comercial e contratação
**Para que serve:** Reunir as etapas comerciais e contratuais, com o documento vigente, responsável operacional e próximo passo.
**Quem pode fazer:** Membro ativo com acesso ao negócio. Cada documento e ação exige suas permissões próprias. Preparar uma minuta manualmente exige `techcontracts.contract_drafts.create.workspace`; revisar e enviar exige ser aprovador jurídico configurado e ter a permissão de aprovação. Contratos, assinaturas e serviços mantêm suas alçadas existentes.
**Onde fica:** TechSales > Negócios > ficha do negócio > Jornada comercial e contratação (`/deals/$id`).
**Antes de começar:** Vincule cliente, itens de linha e empresa prestadora WK. Confira o catálogo, o modelo jurídico e os aprovadores. Nenhum cargo recebe novas permissões automaticamente.

## Passo a passo
1. Na etapa **Cotação**, prepare e envie os valores pelos controles existentes. Depois da concordância do cliente, prepare a proposta.
2. Em **Proposta**, acompanhe o aceite formal. A proposta aceita deve ter sua versão e decisão preservadas; isso ainda não inicia o serviço.
3. Em **Minuta**, use a abertura pelo workflow ou **Preparar minuta para revisão**. O Jurídico confere o modelo, usa **Preencher dados da proposta**, resolve as pendências nos cadastros, confere a vigência e aprova o envio. O link público permite que o cliente aceite as cláusulas ou solicite ajustes.
4. Ajustes passam novamente pelo Jurídico. **Preparar nova revisão** exige motivo e revoga o aceite e o link anteriores. Depois de criado o contrato definitivo, mudanças devem ser formalizadas por aditivo.
5. Após o aceite da minuta, o **Financeiro** confere a origem e prepara o contrato. O texto é o da minuta aceita, sem regenerar cláusulas do modelo atual. Valores estruturados, itens, pagamento e vigência são preservados da origem aprovada. Se faltar valor estruturado, regularize a proposta antes de continuar. Criar não envia automaticamente para assinatura.
6. Confira aprovações e assinaturas. O documento nativo é preparado e enviado pelos controles de Assinaturas; evidência externa exige o PDF e conferência autorizada. Assinatura parcial, evidência revogada ou conteúdo alterado não liberam a operação.
7. Com assinatura verificável e aprovações válidas, organize a entrega e ative os serviços pelos controles existentes. A assinatura não dispensa as regras próprias de recrutamento, alocação e faturamento.
8. Consulte **Documentos** e **Histórico** sem sair do contexto comercial. A timeline completa permanece abaixo.

## Resultado esperado
Cotação → proposta aceita → minuta aprovada pelo cliente → contrato com assinatura válida → serviço. A preparação de projetos pode ocorrer em planejamento; a execução segue as validações operacionais existentes.

## Regras e limites
- Quando houver várias origens, selecione a proposta/cotação correspondente. A jornada não mistura documentos de propostas diferentes.
- Documentos restritos não são considerados inexistentes. Falhas de consulta aparecem como erro com opção de tentar novamente.
- Contratos históricos continuam preservados; aceites antigos ausentes não são reconstruídos.
- Revisões de texto são preservadas a partir desta implantação. O histórico existente não é inventado; consulte cada revisão sob demanda.
- O resumo carrega até 100 documentos por categoria e avisa quando há mais. Use as listagens completas nesse caso.
- O status **Ativo** não comprova assinatura. A liberação usa a evidência válida da versão atual e as regras do contrato.
- Aditivos e renovações começam no contrato existente. Contratos avulsos ficam no TechContracts.
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
