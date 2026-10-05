# Padronizar a timeline em todas as telas

## Situação atual
- Os filtros da timeline no padrão HubSpot (abas, busca, Atividade, período, Atribuída a, Expandir tudo) estão no componente compartilhado. Ele já é usado nas fichas de Lead, Contato, Empresa, Negócio e Ticket, na gaveta de detalhe do Negócio e na tela de execução da fila de Prospecção.
- O único lugar fora da timeline que ainda mostra histórico de substatus é o cabeçalho do **Lead**, abaixo do seletor de substatus.

## O que muda
1. **Lead**: tirar o bloco "Histórico de substatus" do cabeçalho. Ao trocar o substatus, a timeline é avisada para recarregar e mostra a mudança na hora, como no Negócio.
2. **Limpeza**: com isso, o componente do histórico isolado deixa de ser usado em qualquer tela e é apagado. A leitura de dados ligada a ele também sai, se nada mais depender dela.
3. **Conferência em todas as telas com timeline**: Lead, Contato, Empresa, Negócio (ficha e gaveta), Ticket e fila de Prospecção. Em cada uma, ver se a barra de filtros cabe bem, inclusive na gaveta e na fila, que são mais estreitas. Onde não couber, os controles quebram em linhas, sem esconder nenhum.

## Fora do escopo
Sem mudanças no banco, nas permissões ou nas regras. O registro automático das alterações continua igual.

## Validação
- Verificação de tipos, lint e testes dos filtros.
- Playwright: na ficha do Lead, o bloco do cabeçalho sumiu e trocar o substatus faz o item aparecer na timeline; capturas da barra de filtros em cada uma das telas acima.
