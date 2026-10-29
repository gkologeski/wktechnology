# Ignorados não podem atrasar o disparo

## O que acontece hoje

- Os grupos da linha "Fora" (sem telefone, inválido, fixo/estrangeiro, duplicado, descadastrado, envio recente, cliente/negociação) **já não entram** na lista gravada ao salvar a campanha. Só os contatos aprovados viram fila.
- O disparo confere tudo de novo antes de cada envio (fixo, envio recente, cliente/negociação, descadastrado). Quem mudou de situação entre salvar e disparar é marcado como "ignorado" nesse momento. Foi o que aconteceu com os 33 da ICP 007: a regra de 30 dias foi ativada depois da campanha criada.
- O problema de tempo: no disparo espaçado (5 a 10 s), cada contato ignorado **consome um intervalo inteiro**, como se tivesse sido enviado. 33 ignorados ≈ 3 a 5 minutos de espera sem nada sair.

## O que vai mudar

1. **Ignorado não gasta intervalo.** Na mesma rodada, o disparo pula quem foi barrado e segue direto para o próximo contato até enviar um de verdade (ou a fila acabar). O espaçamento de 5 a 10 s passa a valer só entre envios reais.
2. **Limpeza ao mudar regras.** Ao salvar alterações de uma campanha pausada ou em rascunho (por exemplo, trocar 7 para 30 dias), os pendentes que deixaram de passar nas regras são retirados da fila na hora, com o motivo registrado, em vez de esperarem o disparo para serem ignorados.
3. As proteções na hora do envio **continuam** (segurança contra mudanças de última hora); só deixam de custar tempo.
4. Nenhum envio já feito é alterado; nenhuma campanha é reiniciada.

Porte P, estimativa 30 a 45 minutos. Sem mudança no banco.
