# Não responder sem ler mensagens que chegaram durante a geração

Porte P/M, estimativa de 1h a 1h30.

## O que aconteceu (confirmado no banco)
- 09:57:20: Vinicius escreveu "O responsável... é o Luiz Velez".
- A Lia esperou 5 s e começou a escrever a resposta às 09:57:26, olhando só essa mensagem.
- 09:57:37: chegou o cartão com os 2 telefones do Luiz, enquanto ela ainda escrevia.
- 09:57:38: a resposta saiu pedindo o contato, sem considerar o cartão. Nenhum novo turno foi criado para o cartão, então ela não corrigiu depois.

A regra de "indicação completa" está certa; o erro é de tempo: a resposta não confere se o cliente mandou algo novo antes de enviar.

## O que será feito
1. **Conferência final antes de enviar:** logo antes de mandar, o sistema verifica se chegou mensagem do cliente depois da última que a IA leu. Se chegou, a resposta é descartada sem envio e a IA refaz o turno com a conversa completa (cartão incluído). Limite de 2 refações para não travar em rajadas; depois disso, envia a última versão já com tudo lido.
2. **Mensagem que chega durante a geração nunca fica sem turno:** se o envio já saiu e chegou algo novo no meio, um novo turno é aberto para essa mensagem (hoje ela é "engolida" pelo turno em andamento).
3. **Cartão com 2 telefones:** confirmar que os dois números são lidos (hoje só o primeiro é gravado) e gravar o segundo como celular adicional do Lead indicado. "OTSP" é sigla da empresa e será tratada pela limpeza de nome já feita.
4. **Caso do Vinicius:** nada é reenviado automaticamente. Se quiser, envio uma correção curta: "Desculpe, vi agora o contato do Luiz. Obrigada, Vinicius!" — me confirme.

## Testes
- Mensagem nova chegando durante a geração → resposta descartada e refeita com o cartão; nenhum pedido de contato.
- Cartão com dois telefones → ambos reconhecidos.
- Sem mensagem nova → envio normal, sem atraso.

## Detalhes técnicos
- `src/lib/prospecting/sdr/worker.server.ts`: antes do `sendSdrMessage` do turno `reply`, reler `whatsapp_messages` inbound com `created_at` > última inbound do histórico usado; se houver, recarregar histórico e reexecutar `decideTurn` (máx. 2). Mesmo cuidado no `service-worker.server.ts` (e-mail/chat).
- Garantir que o ingest crie/reabra `sdr_turn_jobs` quando o job atual já está `running` (hoje coalesce no job em andamento).
- `parseSharedPhone` em `conversation-state.ts`: aceitar lista de números separados por vírgula; `ReferralInfo` ganha telefones extras, gravados por `saveReferral`.
