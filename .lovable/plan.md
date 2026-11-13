# AJUSTA-ADITIVO — Remover "Valor mensal" do modelo Aditivo_NEXID

Porte P, cerca de 10–15 min. Só muda o texto do modelo; nenhum código, permissão ou estrutura de dados é alterado.

## O que muda
- No modelo Aditivo_NEXID, tirar os trechos `{{contract.monthly_value}}` e `{{contract.monthly_value_extenso}}` (por exemplo: "correspondente ao valor de ... (por extenso)").
- No lugar, a cláusula de valor fica assim: `{{contract.total_value}} ({{contract.total_value_extenso}})`, seguida do cronograma `{{contract.payment_schedule}}` (entrada de 50% em 07/12/2026 e saldo em 21/12/2026).
- Publicar uma nova versão do modelo, para o assistente parar de pedir Valor mensal.

## Passos
1. Ler o texto atual do Aditivo_NEXID e mostrar ao usuário as frases exatas que serão trocadas, antes de gravar.
2. Gravar a nova versão do texto e publicar o modelo.
3. No navegador, abrir o assistente com a proposta 32dba375 e o Aditivo_NEXID e conferir que a etapa Dados não mostra mais "Valor mensal" nem "Falta" nesse campo.
4. Gerar o contrato e conferir o valor total por extenso e o cronograma no texto final (somente com sua autorização, porque cria um contrato real).

## Detalhes técnicos
- A edição usa o caminho normal de salvar e publicar modelos (o usuário precisa ter permissão de edição de modelos; quem não tem continua sem poder editar).
- Os outros modelos não mudam. A Ajuda não muda, porque nenhuma tela foi alterada.
