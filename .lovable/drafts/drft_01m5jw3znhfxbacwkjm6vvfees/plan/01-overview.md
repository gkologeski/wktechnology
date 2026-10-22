# Lia: parar quando a resposta é automática (só no prompt)

**Porte P, cerca de 20 a 30 minutos.** Não mexo em código, banco nem regras. Só no texto da persona da Lia.

## O que muda
Entra uma instrução nova na persona publicada da Lia, na parte de encerramentos:

> "Se a mensagem do cliente for uma resposta automática (horário de atendimento, ausência, 'retornaremos em breve', menu de URA, 'mensagem automática', aviso de férias), não responda nem faça perguntas. Encerre o atendimento sem enviar mensagem, com a situação 'closed_no_reply_needed' e o motivo 'resposta automática'."

Também entra um exemplo de controle: uma frase real escrita pelo cliente ("estou fora hoje, falo amanhã") **não** é resposta automática e a conversa continua.

## Passos
1. Ler a persona publicada da Lia na WK e confirmar onde ficam os encerramentos.
2. Criar um rascunho com a instrução nova e o texto do Paulo como exemplo.
3. Testar no painel de teste da Lia, que não envia nada de verdade. Testo com a mensagem do Paulo (a Lia deve encerrar sem responder) e com a frase de controle (a Lia deve continuar).
4. Publicar essa nova versão da persona (só a persona, não o site). A versão atual fica guardada e pode ser restaurada.

## O que não muda
- Nenhuma mensagem é enviada ao Paulo nem a outros clientes.
- A conversa atual do Paulo não é alterada. Se você quiser, encerro ela depois, com uma ordem sua.
- O site não é publicado.
