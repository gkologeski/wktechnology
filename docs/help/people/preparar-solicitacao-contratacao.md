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
version: 12
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

## Autorizar início da atividade

1. Depois de **Assinado — aguarda autorização de início**, a lateral da ficha mostra **Início e execução** com o gestor da área responsável, a vigência do instrumento e eventuais pendências.
2. Somente o gestor da área configurado na alçada atual (ou o substituto explícito quando o gestor é o autor da demanda) com `techpeople.hiring_requests.execution.approve.workspace` vê **Autorizar início**. O CEO não substitui gestor ausente; quem preparou a demanda não autoriza.
3. Informe início, término opcional dentro da vigência assinada e justificativa (mínimo 10 caracteres) e confirme. O registro é imutável e aparece em **Execução** no histórico central.
4. A pessoa canônica recebe um vínculo direto com a mesma pessoa, regime aprovado e CNPJ WK, sem vaga, candidatura ou negócio fictício. A alocação em projeto passa a ser possível somente pela alocação de vínculo existente, dentro do período do vínculo e do instrumento, com projeto acessível, CNPJ WK coerente e dedicação total da pessoa de até 100% no período.

- A autorização exige aprovação gestor/CEO vigente para a revisão atual, formalização íntegra e assinatura completa verificável. Mudança de alçada, revisão, valor de referência ou documento bloqueia o início até nova aprovação/formalização.
- O instrumento só passa a ativo por esta autorização; tentativas de ativação direta são recusadas.
- Autorizar o início **não** concede acessos, não envia convites, não cria modelo de acesso e não gera lançamentos, provisões ou pagamentos.
- Se a assinatura deixar de ser íntegra depois do início, novas alocações ficam bloqueadas e a ficha avisa.

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

## Entregas, aceite e documentos fiscais (após o início autorizado)

1. Somente depois do **início autorizado** pelo gestor da área, a ficha mostra **Entregas e documentos fiscais**: o histórico fica ao centro e as ações à direita.
2. **Registrar entrega** exige `techpeople.hiring_requests.deliveries.manage.workspace`. Informe título, critérios de aceite, período dentro do início autorizado e o responsável pelo aceite. Projeto e marco são opcionais, escolhidos entre os cadastros que você enxerga; nenhum campo de faturamento do projeto, marco, serviço vendido ou anexo assinado é alterado.
3. Submeta a evidência da entrega. O responsável nomeado decide com `techpeople.hiring_requests.deliveries.approve.workspace`, sempre sobre a versão exata exibida e com motivo. Quem registrou ou submeteu a entrega não pode aceitá-la; o CEO não decide no lugar do responsável.
4. Alterar uma entrega exige motivo e cria nova versão, que precisa de novo aceite. Aceites anteriores continuam no histórico.
5. **Enviar documento fiscal** exige `techpeople.hiring_requests.fiscal_documents.create.workspace`. O arquivo (PDF, XML, PNG ou JPEG, até 10 MB) vai para armazenamento privado próprio, separado dos anexos assinados; o tipo real e o SHA-256 são conferidos no servidor.
6. Regras por regime: **CLT** usa evidência de folha emitida pela entidade WK; **PJ** usa NFS-e ou NF-e com o CNPJ cadastrado do profissional como emitente e a entidade WK como tomadora; **freelance** exige escolher explicitamente a modalidade (NFS-e, RPA ou recibo) — o sistema não presume política fiscal.
7. Documento com o mesmo arquivo ou a mesma identidade (emitente, tipo e número) é recusado como duplicado.
8. Valores, CNPJs e arquivos só aparecem com `techpeople.hiring_requests.fiscal_documents.view.workspace`. A **conferência do Financeiro** exige `techpeople.hiring_requests.fiscal_documents.approve.workspace`, é feita por outra pessoa que não enviou o documento e fica registrada sem possibilidade de edição.
9. A conferência é humana: não autentica o documento na prefeitura ou SEFAZ. O envio e a conferência documental não geram títulos nem pagamentos por si só; a geração de contas a pagar é uma ação separada abaixo. Se a assinatura deixar de estar íntegra ou a solicitação mudar, novos aceites e documentos ficam bloqueados sem apagar o histórico. No modo "Ver como" tudo fica somente leitura.

## Erros comuns

- **Acesso não autorizado:** solicite a permissão específica ao administrador.
- **Entidade legal diverge da origem cliente:** confira a entidade WK no negócio/projeto/contrato antes de vincular.
- **Outra pessoa alterou a solicitação:** recarregue e revise o conteúdo atual antes de salvar. Não há sobrescrita silenciosa.
- **Nenhuma opção disponível:** revise a busca ou permissões do cadastro. Ausência não significa inexistência.

## Relacionados

- [Contratação de fornecedores](/ajuda/contracts/preparar-contratacao-fornecedor)

## Plano econômico e provisão gerencial

**Quem pode fazer:** `techpeople.hiring_requests.economics.view.workspace` para ver valores (além de acesso ao contrato e à pessoa), `.economics.manage.workspace` para montar/enviar, `.economics.approve.workspace` para o **responsável Financeiro configurado** decidir, `.provisions.manage.workspace` para prévia e `.provisions.approve.workspace` para fechar; provisões exigem também `techfinance.provisions.manage.workspace`/`techfinance.provisions.approve.workspace`. Não há concessão automática.

1. Após o início autorizado, abra **Plano econômico e provisão** na lateral e escolha a **modalidade** explicitamente: por entrega (preço fechado), por hora aprovada, mensal ou misto. O valor de referência da demanda não é preço nem dívida e nada é lido do texto do contrato.
2. Cada componente exige valor/taxa, moeda, vencimento (dias após competência ou aceite) e a **cláusula conferida** no instrumento assinado. Mensal exige regra explícita: mês integral ou pró-rata por dias corridos do calendário.
3. **Por entrega** aponta a versão exata da entrega; só entra no cálculo depois do aceite daquela versão. Nova versão da entrega deixa a linha pendente até revisar o plano. Horas de referência não mudam preço fechado.
- **Por hora**: usa somente segundos reais de apontamentos **aprovados**, dentro de **fechamento de competência vigente**, nas alocações deste vínculo e da própria pessoa; importações não revisadas ficam fora e aparecem como excluídas. Não há conversão de 160 h ou 30 dias e o faturamento de venda das horas não é alterado.
4. **Misto** exige componentes de tipos e fontes distintos; com mensal, horas precisam de projeto explícito, evitando dupla contagem.
- CLT, PJ e freelance escolhem a modalidade explicitamente; o regime não define modalidade por padrão.
5. Use **Enviar ao Financeiro**. Somente o responsável Financeiro configurado decide, com motivo, e nunca quem montou ou enviou. Nova versão volta a rascunho e exige nova aprovação; histórico e instrumento assinado nunca são alterados.
6. Em **Competência**, use **Calcular prévia**. Fechar só é possível para mês encerrado, sem linhas pendentes e com fontes iguais às da prévia; mudanças exigem revisão encadeada justificada. O histórico central mostra versões, decisões e provisões.

Assinatura alterada/revogada, revisão diferente, mudança de alçada ou entidade WK sem CNPJ bloqueiam novas ações. **Provisão é previsão de custo gerencial: não gera título, conta a pagar, recorrência nem pagamento.**

## Contas a pagar e conciliação

**Quem pode fazer:** `techpeople.hiring_requests.payables.view.workspace` para ver parcelas (com `techfinance.entries.view.workspace` e acesso ao contrato e à pessoa), `.payables.manage.workspace` com `techfinance.entries.create.workspace` para gerar e `.payables_reconciliation.approve.workspace` com `techfinance.entries.update.workspace` para conciliar — esta última somente pelo **responsável Financeiro configurado**. Não há concessão automática.

1. Na lateral **Contas a pagar**, escolha a **Competência**. O cálculo usa o plano econômico aprovado atual, a assinatura e a revisão vigentes.
2. Marque explicitamente as fontes elegíveis. Linhas pendentes (período mensal ainda aberto, horas sem fechamento vigente, entrega sem aceite ou com versão alterada) aparecem com o motivo e não podem ser selecionadas — nunca viram zero.
3. Informe as parcelas com valor e vencimento explícitos; a soma precisa fechar exatamente a obrigação. Selecione o documento conferido: NFS-e/NF-e para PJ e fornecedor, documento freelance para freelance e **evidência de folha** para CLT (sem nota fiscal fictícia). O documento precisa ter tomador = CNPJ WK, emissor = contratado, mesma moeda e saldo suficiente; o saldo nunca é usado duas vezes. A conferência é humana e não equivale a validação na SEFAZ.
4. Justifique e use **Gerar contas a pagar**. Os títulos nascem **em aberto** no Financeiro (Contas a pagar), ligados ao contrato e à entidade WK. Nada é pago aqui: o pagamento é registrado no Financeiro e só ele define o status pago.
5. Se existirem títulos ou recorrências antigos que possam cobrir a mesma competência (folha de pessoas, parcelas do contrato, serviço ou projeto do mesmo contratado), a geração fica bloqueada. O Financeiro configurado vincula o título compatível (mesmo valor, competência, moeda, entidade e contratado) às fontes selecionadas ou declara que **não se relaciona**. Título incompatível não é vinculado e nada é cancelado ou alterado, inclusive títulos pagos.
6. Cada fonte (entrega, mês, apontamento de horas) só pode lastrear uma obrigação. Depois disso, as fontes financeiras do apontamento, do fechamento e da entrega ficam congeladas (o faturamento de venda pode continuar registrando seus próprios vínculos); correções exigem revisão ou aditivo explícito. Os títulos não podem ter valor, vencimento ou contrato alterados, nem ser cancelados ou excluídos diretamente; lançamentos e recorrências manuais para este contrato são recusados.
7. O histórico central mostra parcelas, status, valor pago e **abrir título** no Financeiro, além das conciliações. Fechar provisão não gera título.

## Conferências adicionais antes de gerar obrigações

- Para gerar ou conciliar, são necessários também os acessos de leitura do **plano econômico** e dos **documentos fiscais**, além da leitura dos títulos e da permissão de criar ou editar títulos indicada acima. Campo financeiro oculto/mascarado ou registro fora da carteira bloqueia a operação; ausência de acesso nunca aparece como saldo zero.
- Horas pendentes de aprovação, origem ou fechamento aparecem como pendência e bloqueiam a obrigação correspondente. O custo mensal de uma pessoa com contratos simultâneos ambíguos exige revisão; não se presume um segundo salário/custo.
- A competência de uma entrega é o mês do fim do período executado. O aceite libera o valor, mas não desloca automaticamente a competência. Os dias de vencimento a partir do aceite usam a data UTC registrada; confira as datas explícitas das parcelas antes de gerar.
- **Não se relaciona** exige a prévia atual, motivo e Financeiro configurado. A decisão vale somente para a competência, a versão do plano e os dados do título/recorrência efetivamente conferidos. Mudança de valor, vínculo ou plano exige nova conferência; ela não dispensa os próximos meses e não desativa recorrências.
- O arquivo fiscal precisa ter os bytes atestados no servidor, conferência humana da mesma versão e saldo disponível. CLT usa o CNPJ WK como emitente da evidência de folha e não possui tomador. Freelance usa a identidade fiscal canônica e a modalidade declarada. Não há autenticação externa de NF nem pagamento automático.
- Depois de gerar ou vincular uma obrigação, ajustes de preço, parcela ou fonte exigem revisão/aditivo explícito; este fluxo não contém cancelamento automático nem reversão de títulos pagos. Consulte o Financeiro antes de alterar a operação.
