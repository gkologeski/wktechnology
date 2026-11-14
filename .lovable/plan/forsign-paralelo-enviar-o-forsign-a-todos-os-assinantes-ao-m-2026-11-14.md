# FORSIGN-PARALELO: enviar o ForSign a todos os assinantes ao mesmo tempo

Porte P, previsão de 40 min a 1 h, incluindo um envio real de teste.

## O que a documentação mostra

- Na criação do envelope, a documentação do ForSign diz que `order: false` faz todos assinarem em paralelo e `order: true` segue a posição de cada assinante.
- O TechERP já envia `order: false`. Mesmo assim, o envelope 803 voltou como sequencial: o ForSign registrou as posições 1, 2, 3 e 4 e só notificou o Gustavo.
- Hoje o TechERP também manda uma posição diferente para cada assinante (0, 1, 2, 3). Pela documentação de "Adicionar assinante", quem está na mesma posição assina em paralelo e as posições começam em 1.
- Causa mais provável: posições diferentes fazem o ForSign montar uma fila, apesar do `order: false`. A documentação não confirma isso diretamente. Por isso o plano inclui um teste real.

## O que muda

1. Quando o envio é paralelo (o seu padrão), todos os assinantes vão na mesma posição (1), mantendo `order: false`.
2. Depois de criar o envelope, o TechERP confere a resposta do ForSign. Se ainda vier "sequencial", o painel mostra um aviso claro, em vez de parecer que todos foram notificados.
3. Teste real com um envelope sem vínculo a contrato, para você e mais um e-mail interno, como no teste 802. Consome 1 crédito. Se os dois receberem o convite na hora, a causa fica confirmada.
4. Ajuda "Assinar pelo ForSign" atualizada: os convites saem para todos ao mesmo tempo, e o quadro mostra "Convite enviado" ou "Na fila".

## Envelope atual do aditivo NEXID (803)

Ele continua sequencial: você, Sabrina e Aline só recebem depois que o Gustavo assinar. Opções depois da correção, decididas por você:
- manter como está; ou
- cancelar o 803 e reenviar pelo quadro já corrigido. Todos recebem juntos, e isso consome mais 1 crédito.

## Detalhes técnicos

- `src/lib/integrations/forsign/forsign-core.ts`: `buildMembers` passa a usar `orderPosition: 1` em todos quando é paralelo. Teste unitário para a regra.
- `src/lib/integrations/forsign/forsign-service.server.ts`: ler `order` da resposta de `createOperation` e gravar o aviso em `last_error` se vier `true`.
- Atualizar o hash em `docs/security/permission-contracts.json`. Nenhuma permissão nova, nenhuma mudança no banco.
