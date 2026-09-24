# Enriquecimento do Bruno Marchioro: erro e telefone

## Diagnóstico (confirmado no banco)
- **Erro:** a tentativa das 21:36 falhou com "chave do Apollo inválida" (401). É o mesmo erro corrigido antes. As duas tentativas seguintes (21:37) funcionaram, sem falha. O mais provável é que a primeira tenha sido feita no site publicado, que ainda roda a versão antiga, ou antes da atualização chegar ao preview.
- **Telefone:** o Apollo não devolve o celular na hora. Ele envia depois, em segundo plano. O enriquecimento em massa pede o telefone, mas não guarda o aviso de "telefone pendente para este contato". Quando o número chega, o sistema não sabe de quem é e ele se perde. Para o Bruno não existe nenhum registro pendente. A prospecção e a qualificação já guardam esse aviso, e para elas os telefones chegam normalmente (há vários casos "aplicado").

## O que fazer
1. **Registrar o telefone pendente no enriquecimento em massa:** quando o Apollo encontrar a pessoa e o telefone for pedido, gravar o registro pendente (workspace, contato ou lead, id da pessoa no Apollo, LinkedIn, e-mail). Isso usa o mesmo mecanismo já usado pela prospecção. Assim, quando o número chegar, ele é gravado no contato.
2. **Usar o telefone de trabalho que já vem na resposta:** se o Apollo já devolver um número na hora, ele continua sendo gravado (modo "preencher vazios").
3. **Mensagem no resultado:** quando o telefone ficar pendente, o aviso final passa a dizer "telefone solicitado, chega em alguns minutos". Assim ninguém acha que falhou.
4. **Publicar** depois de validar, para que o site publicado deixe de dar o erro de chave inválida.

## Validação
- Enriquecer o Bruno no preview e conferir que não há falha e que o registro pendente foi criado.
- Aguardar alguns minutos e conferir se o telefone chegou no contato. Isso depende de o Apollo ter o número.
- Rodar os testes, a checagem de tipos e o lint.

## Detalhes técnicos
- `enrichment-engine.server.ts`: `apolloMatch` passa a retornar `apollo_person_id`. Depois do match, chamar o helper de registro pendente de `apollo-phone-reveal.server.ts` com `entity_type` igual a contact ou lead.
- Não muda a estrutura do banco, as permissões nem as regras de acesso.
