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

## Pedido adicional: entrada de 100% sem saldo
**Porte P · ~20 min.** Hoje, com entrada em 100% (ou valor igual ao total), o bloco **Saldo** continua editável com "Entrega final 100%", embora as parcelas já mostrem só a entrada.
- Quando a entrada cobrir o total, o bloco **Saldo** fica desativado com o aviso "Sem saldo: a entrada cobre 100% do total".
- O que for gravado não terá saldo (nem marcos), na cotação, proposta e contrato, que usam o mesmo editor.
- Se a entrada voltar a ser menor que 100%, o saldo reaparece com a sugestão padrão.
- O servidor também passa a recusar entrada de 100% com saldo configurado.

**Total do pacote: porte P/M, ~1 h.**
