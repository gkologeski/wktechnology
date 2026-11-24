# Itens de linha: rascunho preservado e botão "Concluído"

**Porte P · estimativa ~40 min** (implementação + teste na tela + Ajuda).

## Situação atual (verificada no código)
- A janela "Itens de linha" do negócio grava cada campo automaticamente quando você sai dele.
- O botão **Salvar** grava e deixa a janela aberta.
- O que estiver digitado num campo ainda em edição (sem sair dele) se perde se a janela for fechada pelo X, Esc ou clique fora.

## O que muda
1. **Rascunho automático:** tudo que você digitar fica guardado como rascunho neste navegador, por negócio e por usuário. Se a janela fechar antes de gravar, ao reabrir os valores voltam com o aviso "Rascunho restaurado" e opção **Descartar rascunho**.
2. **Botão "Concluído"** (no lugar de "Salvar"): grava o que estiver pendente, espera terminar e **fecha a janela**. Se a gravação falhar, a janela continua aberta com a mensagem de erro e o rascunho é mantido.
3. Ao gravar com sucesso, o rascunho daquele item é apagado.
4. Permissões não mudam: quem não pode alterar o negócio continua sem abrir a janela; o rascunho é só local e nunca grava sem a mesma validação de hoje.
