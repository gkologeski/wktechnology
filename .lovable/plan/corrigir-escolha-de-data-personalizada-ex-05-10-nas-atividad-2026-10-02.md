# Corrigir escolha de "Data personalizada" (ex.: 05/10) nas atividades

## Situação verificada
- O calendário da data personalizada (tarefa de acompanhamento e campo de vencimento) não tem nenhum dia bloqueado no código. Nada impede escolher 05/10 de propósito.
- A causa ainda **não foi confirmada**. As suspeitas são:
  1. O calendário fica cortado ou escondido atrás da janela da atividade, e a linha do dia 5 fica sem clique.
  2. Quando você clica no dia, a janela que está por trás fecha o calendário antes de gravar a data.
  3. A data é gravada, mas outra coisa a apaga logo em seguida, por exemplo o rascunho automático ou o atalho escolhido.

## Passos
1. **Reproduzir no navegador de teste**, com o seu acesso, nos dois lugares:
   - "Criar uma tarefa de … para acompanhar › Data personalizada", ao registrar uma atividade;
   - "Quando você fará?", ao criar uma tarefa.
   Vou tentar clicar em 05/10 e registrar o que acontece, com imagens da tela. Nada será salvo.
2. **Corrigir a causa confirmada**. Só altero o seletor de data/hora compartilhado e o controle de acompanhamento, sem mudar regras nem dados:
   - se o calendário estiver cortado ou atrás da janela, ajusto a posição e a camada para ele ficar sempre visível e clicável;
   - se o calendário fechar antes da hora, garanto que o clique no dia grava a data antes de fechar;
   - se a data estiver sendo apagada, preservo a data escolhida.
3. **Validar no navegador de teste**: escolher 05/10 e outras datas, conferir o texto exibido e a data que iria para a tarefa, e cancelar sem gravar.

## Fora de escopo
- Atalhos de data, lembretes e regras de dias úteis continuam como estão.
