# Nova campanha: mostrar a mensagem do modelo escolhido

## Causa (confirmada no código)
Na tela de campanhas, o campo "Mensagem" é escondido de propósito quando um modelo oficial é escolhido. O texto de um modelo aprovado pela Meta não pode ser alterado. Mas a tela não põe nada no lugar, então parece que o campo sumiu e você não vê o que será enviado.

## O que muda
- Ao escolher um modelo, o campo "Mensagem" continua aparecendo, só para leitura, com o texto exato do modelo aprovado. O idioma e a quantidade de variáveis aparecem junto, e as variáveis ({{1}}, {{2}}…) ficam destacadas.
- Um aviso curto explica que o texto do modelo não pode ser editado e que as variáveis vêm das colunas da lista de destinatários.
- Se o modelo não tiver texto disponível, aparece "Prévia indisponível para este modelo".
- Ao voltar para "Nenhum (texto livre)", o campo volta a ser editável e o que você tinha digitado continua lá.
- Na edição de campanhas, vale o mesmo comportamento.

## Fora do escopo
O envio, as regras de modelo e janela, o banco e as permissões não mudam. Nada é enviado.

## Validação
- Verificação de tipos e de estilo, e consulta da verificação automática do preview.
- Navegador em /campaigns/whatsapp: abrir "Nova campanha", escolher um modelo aprovado e conferir que a mensagem aparece só para leitura. Voltar para texto livre e conferir que o texto digitado foi preservado. Nada é criado nem enviado.

## Detalhes técnicos
- Em `campaigns.whatsapp.tsx`, trocar o bloco `{!isHsm && ...}` por um campo único: `Textarea` editável sem modelo e `readOnly` com `selectedTpl.body` quando `isHsm`, com rótulo associado (`htmlFor`) e `aria-describedby` apontando para o aviso.
