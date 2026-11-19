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
version: 6
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
4. Registre a conferência e use **Encaminhar ao Jurídico**. O responsável jurídico configurado revisa o documento e anexos e confirma ou rejeita, com motivo; não pode aprovar próprio pedido/preparação.
5. Após aprovação jurídica, gere o **link de aceite** para compartilhar de forma humana. O link expira em 7 dias, é revogável e cada nova emissão revoga a anterior. O destinatário usa **Enviar código ao meu e-mail cadastrado**; o código vai exclusivamente à pessoa/contato canônico, nunca a um endereço digitado no link. Não existe aceite interno nem dispensa do código nesta origem.
6. O código de oito dígitos vale 10 minutos e uma única resposta, com até cinco tentativas por desafio, quinze por link, cinco envios por link e intervalo mínimo de 60 segundos. Falha ou supressão do envio não verifica o e-mail. Um colaborador pode responder ao próprio instrumento; operador não recebe o código da outra contraparte. Isso comprova controle do e-mail, não identidade civil nem assinatura.
7. A contraparte confere o documento e baixa cada anexo, então aceita ou pede ajustes com o código. Ajustes invalidam a versão; obtenha nova revisão e novo aceite. O Financeiro configurado só pode conferir depois do aceite real da mesma versão.
8. O responsável nomeado abre o contrato, confere prévia integral/signatários e envia humanamente pela assinatura nativa ou ForSign. Contatos selecionados são preservados; CONTRATANTE/CONTRATADO são obrigatórios; testemunhas opcionais precisam assinar quando incluídas. Integração/PDF indisponível impede o envio.

Permissões próprias: `techcontracts.supplier_requests.formalization.manage.workspace` para preparação/encaminhamento e `.formalization.approve.workspace` para revisão nomeada, além das permissões reais de contrato, minuta, assinatura e leitura de referência. Nenhuma concessão automática. A ficha mostra responsáveis e prazos já configurados e notificações internas com link direto, sem valor/código/token no histórico comum.

Alterações materiais de solicitação, referência, alçada, documento, anexos, destinatário ou responsáveis bloqueiam aceite e novos envios da versão anterior. Assinaturas históricas são preservadas. A preparação é idempotente: um único contrato e minuta por solicitação. Assinatura não ativa contratação, admissão, acesso, alocação, serviço ou pagamento; execução pertence ao pacote 4.

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

## Erros comuns

- **Contato não pertence ao fornecedor:** escolha um contato da empresa selecionada.
- **Outra pessoa alterou:** recarregue e revise a versão salva antes de editar.
- **Sem permissão / nenhuma opção:** confira a permissão da solicitação e do cadastro vinculado.

## Relacionados

- [Solicitação de profissionais](/ajuda/people/preparar-solicitacao-contratacao)
