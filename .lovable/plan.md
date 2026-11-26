# Posicionar a assinatura de cada signatário no ForSign

**Porte M — estimativa 90–120 min.** Sem publicar automaticamente.

## Situação atual (confirmada no código)
- O TechERP gera o PDF do contrato e cria a operação no ForSign enviando apenas nome, e-mail, CPF e papel de cada signatário.
- Nenhuma posição de assinatura é informada, por isso o ForSign não sabe onde cada pessoa assina e a assinatura não cai acima do "_________".

## Solução
A API do ForSign aceita **assinatura por TAG**: marcamos no PDF um texto (ex.: `{{ASSINA-1}}`) e o ForSign coloca ali a assinatura do signatário correspondente ([5](https://docs.forsign.digital/docs/conceitos/assinaturas-por-tag)). É o equivalente automático ao posicionamento manual do portal.

1. **Identificar o local de cada signatário no contrato**: no bloco final de assinaturas, cada linha "_________" é seguida do nome/papel (Contratante, Contratada, Testemunhas). O sistema associa cada linha ao signatário escolhido no envio, pelo papel e pela ordem.
2. **Marcar o PDF**: acima de cada linha, gravar uma tag única por signatário em texto mínimo e na cor do fundo (invisível na leitura, mas legível para o ForSign).
3. **Enviar a operação** informando para cada signatário `hasSignatureTag: true` e sua tag.
4. **Fallback seguro**: se o contrato não tiver linhas suficientes ou houver ambiguidade, o sistema adiciona ao final uma página de assinaturas com uma linha rotulada por signatário — nunca envia sem posição e nunca troca um signatário de lugar.
5. **Rubricas em todas as páginas**: no rodapé de cada página do PDF, gravar uma tag de rubrica por signatário (lado a lado, invisível na leitura), e enviar `hasRubricTag: true` + `rubricTag` para cada um. Assim todos rubricam todas as páginas, inclusive anexos gerados no pacote.
6. **Aviso no envio**: o modal mostra "Local da assinatura: identificado / página de assinaturas adicionada" para cada pessoa.

## Fora do escopo
- Assinatura nativa (não-ForSign) e contratos já enviados permanecem como estão.

## Detalhes técnicos
- `forsign-core.ts`: função pura `planSignaturePlacements(blocks, signers)` → tag por signatário + fallback; `buildMembers` passa `hasSignatureTag`/`signPositionTag`.
- `forsign-pdf.ts`: registrar posição dos blocos de linha e desenhar a tag acima; gerar página extra no fallback; desenhar tags de rubrica no rodapé de todas as páginas (incluindo anexos PDF do pacote, sem sobrepor o texto existente).
- `forsign-service.server.ts`: usar o plano ao montar o payload; gravar tags em `requested_members` (auditoria). Sem migration, RLS ou permissões novas (mesma ação de envio já autorizada).
- Testes: associação por papel/ordem, ambiguidade → fallback, tags únicas, rubrica presente em cada página, payload com tag; Ajuda do envio ForSign atualizada (bump de versão).
- Validação real: depende de envio de teste no ForSign (sandbox/credencial do workspace) para confirmar o posicionamento visual.
