---
module_key: contracts
slug: preparar-contratacao-fornecedor
title: Preparar contratação de fornecedor
summary: Prepare compra WK de serviço ou resultado com empresa fornecedora real.
article_type: howto
route_pattern: /contracts/supplier-requests
min_permission: techcontracts.supplier_requests.view.workspace
audience: internal
sort_order: 36
version: 9
is_published: true
---

# Preparar contratação de fornecedor

**Para que serve:** Preparar contratação de empresa responsável por serviço ou resultado, com WK compradora.
**Quem pode fazer:** Membro ativo com `techcontracts.supplier_requests.view.workspace`; criar exige `create.workspace`, editar exige `update.workspace` e cancelar exige `techcontracts.supplier_requests.cancel.update.workspace`. Não há concessão automática a cargos.
**Onde fica:** TechContracts > Contratos > Contratação de fornecedores (`/contracts/supplier-requests`).
**Antes de começar:** Cadastros canônicos de empresa, área responsável e entidade legal WK, visíveis ao seu usuário.

## Passo a passo

1. Abra **Nova solicitação** e percorra **Demanda → Vínculos → Condições → Revisão**. Voltar preserva os dados ainda não salvos.
2. Em **Demanda**, informe título, finalidade Cliente/Interno/Gestão compartilhada, área responsável, entidade WK e escopo.
3. Em **Vínculos**, escolha empresa fornecedora canônica e contato opcional da mesma empresa. Projeto é opcional; negócio e contrato de origem estão disponíveis quando a finalidade é Cliente.
4. Em **Condições**, selecione Por entrega/Por hora/Mensal/Mista. O valor de referência exige permissões específicas `techcontracts.supplier_requests.reference.view.workspace` para consultar e `.reference.update.workspace` para alterar. Não é retornado na lista ou no histórico comum.
5. Para fornecedor, registre **Aceite WK + NF válida** ou **Aceite WK + NF válida + aceite cliente final**, somente como condição em rascunho para revisão. Não libera pagamentos.
6. Em **Revisão**, confira demanda, vínculos e condições e salve o rascunho. Na ficha, o histórico fica ao centro e resumo/jornada/responsáveis à direita; as decisões são registradas separadamente por revisão.
7. Reabra para editar ou marcar Pronta para aprovação; cancelar exige confirmação e preserva histórico. Não inclui alterações ainda não salvas.

## Aprovações da revisão salva

- Salve como **Pronta para aprovação**, confira as condições e use **Solicitar aprovação**. Exige `techcontracts.supplier_requests.approval_request.create.workspace`, além de acesso à solicitação.
- O gestor decide primeiro; o CEO decide depois, mesmo quando a mesma pessoa ocupa os dois papéis. Cada decisão exige motivo de 5 a 2000 caracteres e `techcontracts.supplier_requests.approval.approve.workspace`, além de leitura específica do valor de referência.
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

Permissões próprias: `techcontracts.supplier_requests.formalization.manage.workspace` para preparação/encaminhamento e `.formalization.approve.workspace` para revisão nomeada, além das permissões reais de contrato, minuta, assinatura e leitura de referência. Nenhuma concessão automática. A ficha mostra responsáveis e prazos já configurados e notificações internas com link direto, sem valor/código/token no histórico comum.

Alterações materiais de solicitação, referência, alçada, documento, anexos, destinatário ou responsáveis bloqueiam aceite e novos envios da versão anterior. Assinaturas históricas são preservadas. A preparação é idempotente: um único contrato e minuta por solicitação. Assinatura não ativa contratação, admissão, acesso, alocação, serviço ou pagamento; execução pertence ao pacote 4.

## Conferência privada, prévia e preservação de assinaturas

- Encaminhamento, revisão jurídica, conferência Financeiro e rejeição guardam o motivo em **Trilha privada de conferência**, com ator, data, ciclo e etapa. A leitura exige simultaneamente acesso à solicitação, chave de formalização de preparo ou revisão, `reference.view` do módulo e acesso real ao contrato. Lista, notificações e eventos comuns não carregam notas/valores.
- Pedido externo de ajustes exige motivo no servidor após código válido. Código inválido/expirado não registra nota nem decisão. Motivo de ajustes fica privado e identifica a contraparte com controle do e-mail canônico; não comprova identidade civil.
- Jurídico pode revisar explicitamente uma compra que preparou; autor da demanda e solicitante da aprovação continuam impedidos. Não existe decisão automática.
- Na nova compra WK, anexe proposta do fornecedor ou condições WK como **arquivo PDF**. O seletor de cotação/proposta **de venda** não aparece. Anexos antigos continuam consultáveis pela prévia e pelo acesso original, mas vínculo comercial de venda precisa ser substituído por arquivo antes de encaminhar esta compra ao Jurídico; o sistema informa o impedimento específico.
- Prévia integral e anexos ficam disponíveis aos responsáveis com acesso privado e leitura da evidência, mesmo antes do Financeiro e sem liberação de envio. A prévia não envia convites. O servidor confere o mesmo hash antes/depois da geração; o aceite público baixa os bytes aprovados por hash.
- **Assinatura pendente** exige conclusão de todos os signatários e testemunhas incluídos. Assinatura nativa exige documento selado e participantes completos; ForSign exige reconsulta pela integração, manifesto completo e evidência PDF privada da versão atual. Após comprovação aparece **Assinado — aguarda autorização de início**, sem ativar contrato, serviço ou pagamento.
- Repreparar ou apagar o corpo é bloqueado se há assinatura em curso/concluída. Cancele o envio pendente e revogue a evidência correspondente antes de nova preparação; documento concluído é histórico protegido e exige aditivo/instrumento apropriado, não sobrescrita. Cancelamento/revogação continuam sujeitos aos controles existentes.

## Autorizar início da atividade

1. Depois de **Assinado — aguarda autorização de início**, a lateral da ficha mostra **Início e execução** com o gestor da área responsável, a vigência do instrumento e eventuais pendências.
2. Somente o gestor da área configurado na alçada atual (ou o substituto explícito quando o gestor é o autor da demanda) com `techcontracts.supplier_requests.execution.approve.workspace` vê **Autorizar início**. O CEO não substitui gestor ausente; quem preparou a demanda não autoriza.
3. Informe início, término opcional dentro da vigência assinada e justificativa (mínimo 10 caracteres) e confirme. O registro é imutável e aparece em **Execução** no histórico central.
4. O fornecedor fica liberado para iniciar sem criar pessoa, vínculo de equipe ou alocação. Entregas, aceite, nota fiscal e parcelas são etapas seguintes.

- A autorização exige aprovação gestor/CEO vigente para a revisão atual, formalização íntegra e assinatura completa verificável. Mudança de alçada, revisão, valor de referência ou documento bloqueia o início até nova aprovação/formalização.
- O instrumento só passa a ativo por esta autorização; tentativas de ativação direta são recusadas.
- Autorizar o início **não** concede acessos, não envia convites, não cria modelo de acesso e não gera lançamentos, provisões ou pagamentos.
- Se a assinatura deixar de ser íntegra depois do início, novas alocações ficam bloqueadas e a ficha avisa.

## Resultado esperado

Preparação de compra WK versionada, sem contrato ou processo operacional criado.

## Regras e limites

- Não é contratação de profissional: não há regime CLT/PJ/freelance nem vínculo de pessoa nesta entrada.
- Pronta exige escopo, área, entidade legal e empresa fornecedora; Cliente exige também negócio ou contrato comercial de origem. Não significa aprovada.
- A condição que também depende do aceite do cliente final permanece como rascunho para revisão.
- WK compradora continua sendo `client`; WK fornecedora no fluxo comercial continua sendo `provider`. Esta preparação não modifica contratos comerciais existentes.
- Contrato comercial opcional representa a origem cliente com WK fornecedora, não o futuro contrato de compra.
- Entidade legal divergente da origem cliente é bloqueada.
- Preparação não autoriza recrutamento antes da assinatura e não configura aprovadores.
- A demanda não cria vaga, admissão, contrato, assinatura, acesso, financeiro ou mensagens; formalização é ação separada após aprovação.
- Valor de referência protegido; vínculos não concedem leitura de salário ou outros campos sensíveis.
- Lista de 50 por página, buscas de até 25 opções com acesso do usuário. Cancelada é terminal e preserva histórico.

- Durante a consulta do nome de um vínculo, aguarde o indicador de carregamento. Vínculo indisponível exige conferir a permissão do cadastro.

## Entregas, aceite e documentos fiscais (após o início autorizado)

1. Somente depois do **início autorizado** pelo gestor da área, a ficha mostra **Entregas e documentos fiscais**: o histórico fica ao centro e as ações à direita.
2. **Registrar entrega** exige `techcontracts.supplier_requests.deliveries.manage.workspace`. Informe título, critérios de aceite, período dentro do início autorizado e o responsável pelo aceite. Projeto e marco são opcionais, escolhidos entre os cadastros que você enxerga; nenhum campo de faturamento do projeto, marco, serviço vendido ou anexo assinado é alterado.
3. Submeta a evidência da entrega. O responsável nomeado decide com `techcontracts.supplier_requests.deliveries.approve.workspace`, sempre sobre a versão exata exibida e com motivo. Quem registrou ou submeteu a entrega não pode aceitá-la; o CEO não decide no lugar do responsável.
4. Alterar uma entrega exige motivo e cria nova versão, que precisa de novo aceite. Aceites anteriores continuam no histórico.
5. **Enviar documento fiscal** exige `techcontracts.supplier_requests.fiscal_documents.create.workspace`. O arquivo (PDF, XML, PNG ou JPEG, até 10 MB) vai para armazenamento privado próprio, separado dos anexos assinados; o tipo real e o SHA-256 são conferidos no servidor.
6. Fornecedor usa NFS-e ou NF-e com o CNPJ cadastrado da empresa fornecedora como emitente e a entidade WK como tomadora.
7. Documento com o mesmo arquivo ou a mesma identidade (emitente, tipo e número) é recusado como duplicado.
8. Valores, CNPJs e arquivos só aparecem com `techcontracts.supplier_requests.fiscal_documents.view.workspace`. A **conferência do Financeiro** exige `techcontracts.supplier_requests.fiscal_documents.approve.workspace`, é feita por outra pessoa que não enviou o documento e fica registrada sem possibilidade de edição.
9. A conferência é humana: não autentica o documento na prefeitura ou SEFAZ. Nada aqui gera títulos, contas a pagar ou pagamentos. Se a assinatura deixar de estar íntegra ou a solicitação mudar, novos aceites e documentos ficam bloqueados sem apagar o histórico. No modo "Ver como" tudo fica somente leitura.

## Erros comuns

- **Contato não pertence ao fornecedor:** escolha um contato da empresa selecionada.
- **Outra pessoa alterou:** recarregue e revise a versão salva antes de editar.
- **Sem permissão / nenhuma opção:** confira a permissão da solicitação e do cadastro vinculado.

## Relacionados

- [Solicitação de profissionais](/ajuda/people/preparar-solicitacao-contratacao)
