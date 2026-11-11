# EXCLUI-WHATSAPP-BRUNA — remover a conexão +55 48 6136-5335

Porte P, cerca de 15 minutos.

## O que será feito
1. Guardar uma cópia do cadastro da conexão "Bruna" (+55 48 6136-5335) e do seu vínculo de atendimento, para poder recuperar se necessário.
2. Excluir o vínculo de atendimento (1 registro) e depois a conexão.
3. Preservar todo o histórico: conversas, mensagens, campanhas e contatos continuam no sistema, sem apagar nada.
4. Conferir na tela de canais que o número não aparece mais e que o WhatsApp da Lia (+55 48 6137-0317) continua ativo.

## O que não muda
- O número continua existindo na Meta; apagar aqui não remove a linha nem o histórico lá.
- Campanhas que usavam esse número deixam de ter um remetente; vou listar quais são para você escolher outro canal.

## Detalhes técnicos
- Registro: `service_channel_accounts` id `92c37951-a88d-4d13-80f9-e2d61a895d8a` (source_key `1311815615348040`); sem chaves estrangeiras apontando para ele; 1 linha em `service_channel_bindings` referencia o id.
- Backup em tabela/JSON de auditoria antes do DELETE; exclusão pelo cliente do usuário (RLS), verificando linhas afetadas.
