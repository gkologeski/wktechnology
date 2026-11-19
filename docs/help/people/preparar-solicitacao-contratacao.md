---
module_key: people
slug: preparar-solicitacao-contratacao
title: Preparar solicitação de contratação
summary: Prepare contratação de profissional sem iniciar recrutamento ou admissão.
article_type: howto
route_pattern: /people/hiring-requests
min_permission: techpeople.hiring_requests.view.workspace
audience: internal
sort_order: 35
version: 7
is_published: true
---

# Preparar solicitação de contratação

**Para que serve:** Registrar a preparação de contratação de profissional CLT, PJ ou freelance.
**Quem pode fazer:** Membro ativo com `techpeople.hiring_requests.view.workspace`; criar exige `create.workspace`, editar exige `update.workspace` e cancelar exige `techpeople.hiring_requests.cancel.update.workspace`. As permissões não são concedidas automaticamente aos cargos.
**Onde fica:** TechPeople > Pessoas > Solicitações de contratação (`/people/hiring-requests`).
**Antes de começar:** Tenha acesso aos cadastros reais de área e entidade legal WK. Vínculos opcionais exigem acesso ao cadastro de origem.

## Passo a passo

1. Abra **Nova solicitação** e percorra **Demanda → Vínculos → Condições → Revisão**. Voltar preserva os dados ainda não salvos.
2. Em **Demanda**, informe título, finalidade Cliente/Interno/Gestão compartilhada, área responsável, entidade WK e escopo. Regime CLT/PJ/Freelance existe somente para profissionais.
3. Em **Vínculos**, escolha Profissional definido (pessoa canônica) ou Necessidade de seleção; esta opção não abre vaga. Empresa PJ pode ser vinculada no regime PJ. Projeto é opcional; negócio e contrato de origem estão disponíveis quando a finalidade é Cliente.
4. Em **Condições**, selecione Por entrega/Por hora/Mensal/Mista. O valor de referência exige permissões específicas `techpeople.hiring_requests.reference.view.workspace` para consultar e `.reference.update.workspace` para alterar. Não é retornado na lista ou no histórico comum.
5. Em **Revisão**, confira demanda, vínculos e condições e salve o rascunho. Na ficha, o histórico fica ao centro e resumo/jornada/responsáveis à direita; as decisões são registradas separadamente por revisão.
6. Reabra para editar ou marcar Pronta para aprovação; cancelar exige confirmação e preserva histórico. Não inclui alterações ainda não salvas.

## Aprovações da revisão salva

- Salve como **Pronta para aprovação**, confira as condições e use **Solicitar aprovação**. Exige `techpeople.hiring_requests.approval_request.create.workspace`, além de acesso à solicitação.
- O gestor decide primeiro; o CEO decide depois, mesmo quando a mesma pessoa ocupa os dois papéis. Cada decisão exige motivo de 5 a 2000 caracteres e `techpeople.hiring_requests.approval.approve.workspace`, além de leitura específica do valor de referência.
- Solicitante e autor do pedido não podem decidir. Somente substitutos explicitamente cadastrados na alçada existente podem substituir um solicitante. Não há fallback automático para ausência de acesso, inatividade ou Área Técnica sem aprovador.
- O responsável nomeado recebe notificação interna com link direto. Não contém valores, escopo ou dados pessoais e não envia e-mail ou WhatsApp.
- A ficha mantém histórico central e resumo/ações à direita. Alterações não salvas impedem solicitar/decidir. Toda edição salva, alteração do valor ou da alçada invalida decisões anteriores; rejeição exige nova revisão.
- Ausência de alçada ou acesso aparece como pendência. Peça regularização ao administrador autorizado; este fluxo não configura alçadas nem concede chaves.
- Aprovação não autoriza execução, recrutamento antes de assinatura, contrato, admissão, assinatura, acesso ou financeiro.

## Formalização do instrumento aprovado

1. Somente após aprovação válida da revisão pelo gestor e CEO, use **Preparar instrumento**. RH prepara profissional; Jurídico autorizado prepara compra de fornecedor. Exige a chave específica de formalização do módulo e acesso real de criação/leitura do contrato e minuta; não concede acesso a outros cargos.
2. Profissional exige pessoa real definida, inclusive CLT/PJ/freelance; necessidade de seleção bloqueia este passo. Fornecedor exige empresa e contato canônico autorizado com e-mail cadastrado. Não se criam proposta, negócio ou vaga fictícios.
3. Em **Abrir instrumento e anexos**, confira cláusulas, partes, vigência e condições e envie arquivos privados. WK é contratante e pessoa/empresa é contratada. O documento nasce em rascunho, sem validade de aprovação jurídica presumida. Para este fluxo, anexos devem ser arquivos completos; não use documentos comerciais vinculados como substituto da conferência.
4. Registre a conferência e use **Encaminhar ao Jurídico**. O responsável jurídico configurado revisa o documento e anexos e confirma ou rejeita, com motivo; pode revisar explicitamente o documento que preparou, mas não pode aprovar sua própria demanda (autor ou solicitante da aprovação).
5. Após aprovação jurídica, gere o **link de aceite** para compartilhar de forma humana. O link expira em 7 dias, é revogável e cada nova emissão revoga a anterior. O destinatário usa **Enviar código ao meu e-mail cadastrado**; o código vai exclusivamente à pessoa/contato canônico, nunca a um endereço digitado no link. Não existe aceite interno nem dispensa do código nesta origem.
6. O código de oito dígitos vale 10 minutos e uma única resposta, com até cinco tentativas por desafio, quinze por link, cinco envios por link e intervalo mínimo de 60 segundos. Falha ou supressão do envio não verifica o e-mail. Um colaborador pode responder ao próprio instrumento; operador não recebe o código da outra contraparte. Isso comprova controle do e-mail, não identidade civil nem assinatura.
7. A contraparte confere o documento e baixa cada anexo, então aceita ou pede ajustes com o código. Ajustes invalidam a versão; obtenha nova revisão e novo aceite. O Financeiro configurado só pode conferir depois do aceite real da mesma versão.
8. O responsável nomeado abre o contrato, confere prévia integral/signatários e envia humanamente pela assinatura nativa ou ForSign. Contatos selecionados são preservados; CONTRATANTE/CONTRATADO são obrigatórios; testemunhas opcionais precisam assinar quando incluídas. Integração/PDF indisponível impede o envio.

Permissões próprias: `techpeople.hiring_requests.formalization.manage.workspace` para preparação/encaminhamento e `.formalization.approve.workspace` para revisão nomeada, além das permissões reais de contrato, minuta, assinatura e leitura de referência. Nenhuma concessão automática. A ficha mostra responsáveis e prazos já configurados e notificações internas com link direto, sem valor/código/token no histórico comum.

Alterações materiais de solicitação, referência, alçada, documento, anexos, destinatário ou responsáveis bloqueiam aceite e novos envios da versão anterior. Assinaturas históricas são preservadas. A preparação é idempotente: um único contrato e minuta por solicitação. Assinatura não ativa contratação, admissão, acesso, alocação, serviço ou pagamento; execução pertence ao pacote 4.

## Conferência privada, prévia e preservação de assinaturas

- Encaminhamento, revisão jurídica, conferência Financeiro e rejeição guardam o motivo em **Trilha privada de conferência**, com ator, data, ciclo e etapa. A leitura exige simultaneamente acesso à solicitação, chave de formalização de preparo ou revisão, `reference.view` do módulo e acesso real ao contrato. Lista, notificações e eventos comuns não carregam notas/valores.
- Pedido externo de ajustes exige motivo no servidor após código válido. Código inválido/expirado não registra nota nem decisão. Motivo de ajustes fica privado e identifica a contraparte com controle do e-mail canônico; não comprova identidade civil.
- Jurídico pode revisar explicitamente uma compra que preparou; autor da demanda e solicitante da aprovação continuam impedidos. Não existe decisão automática.
- Na nova compra WK, anexe proposta do fornecedor ou condições WK como **arquivo PDF**. O seletor de cotação/proposta **de venda** não aparece. Anexos antigos continuam consultáveis pela prévia e pelo acesso original, mas vínculo comercial de venda precisa ser substituído por arquivo antes de encaminhar esta compra ao Jurídico; o sistema informa o impedimento específico.
- Prévia integral e anexos ficam disponíveis aos responsáveis com acesso privado e leitura da evidência, mesmo antes do Financeiro e sem liberação de envio. A prévia não envia convites. O servidor confere o mesmo hash antes/depois da geração; o aceite público baixa os bytes aprovados por hash.
- **Assinatura pendente** exige conclusão de todos os signatários e testemunhas incluídos. Assinatura nativa exige documento selado e participantes completos; ForSign exige reconsulta pela integração, manifesto completo e evidência PDF privada da versão atual. Após comprovação aparece **Assinado — aguarda autorização de início**, sem ativar contrato, serviço ou pagamento.
- Repreparar ou apagar o corpo é bloqueado se há assinatura em curso/concluída. Cancele o envio pendente e revogue a evidência correspondente antes de nova preparação; documento concluído é histórico protegido e exige aditivo/instrumento apropriado, não sobrescrita. Cancelamento/revogação continuam sujeitos aos controles existentes.

## Resultado esperado

Solicitação em rascunho, pronta para aprovação ou cancelada, com histórico imutável. Cada edição válida incrementa a revisão.

## Regras e limites

- Pronta para aprovação **não é aprovação** e não autoriza recrutamento antes da assinatura.
- A preparação da demanda não gera vaga, admissão, contrato, assinatura, acesso, lançamento financeiro ou mensagem; formalização é ação separada após aprovação.
- Não configura aprovadores. Área Técnica sem aprovador permanece sem aprovador.
- Para marcar Cliente como Pronta para aprovação, associe negócio ou contrato comercial com entidade WK coerente. Rascunhos podem ficar incompletos.
- Valor de referência é separado e protegido; não libera salário, orçamento ou dados sensíveis das entidades vinculadas.
- A lista mostra 50 solicitações por página. Seletores consultam até 25 opções por busca e respeitam as permissões do cadastro.
- Cancelada não pode ser editada. Cancelamento não apaga histórico nem altera outros registros.

- Durante a consulta do nome de um vínculo, aguarde o indicador de carregamento. Vínculo indisponível exige conferir a permissão do cadastro.

## Erros comuns

- **Acesso não autorizado:** solicite a permissão específica ao administrador.
- **Entidade legal diverge da origem cliente:** confira a entidade WK no negócio/projeto/contrato antes de vincular.
- **Outra pessoa alterou a solicitação:** recarregue e revise o conteúdo atual antes de salvar. Não há sobrescrita silenciosa.
- **Nenhuma opção disponível:** revise a busca ou permissões do cadastro. Ausência não significa inexistência.

## Relacionados

- [Contratação de fornecedores](/ajuda/contracts/preparar-contratacao-fornecedor)
