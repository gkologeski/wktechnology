# OCULTA-BRUNA-WHATSAPP — remover o +55 48 6136-5335 da tela de WhatsApp

**Porte P · cerca de 20 minutos**

## O que encontrei
Na exclusão anterior saiu o canal de atendimento da Bruna, mas o cadastro do número na **conexão da Meta** continuou guardado:
- Conexão da Meta antiga (criada em 27/10), já **desligada**.
- Número +55 48 6136-5335 "Bruna", situação **BANNED** (bloqueado pela Meta).

A tela de WhatsApp lista os números de todas as conexões, inclusive as desligadas, por isso ele ainda aparece. Os outros três números (6136-9512, 6136-9564 e 3012-1055) estão conectados e não mudam.

## O que vou fazer
1. Guardar uma cópia do cadastro da conexão antiga e do número, para poder recriar se precisar.
2. Excluir a conexão antiga da Meta e o número da Bruna do sistema. Conversas, mensagens e contatos ficam como estão. Nada muda na Meta.
3. Ajustar a tela de WhatsApp para nunca mostrar números de conexões desligadas, para isso não voltar a acontecer.
4. Conferir na tela que o número sumiu e os outros três continuam.

## Detalhes técnicos
- Tabelas: `wa_cloud_connections` (id 8c310c60…, enabled=false) e `wa_cloud_numbers` (phone_number_id 1311815615348040). Checar vínculos antes de apagar; se houver referência histórica, só apagar o número e manter a conexão desligada.
- Listagem em `src/lib/whatsapp/cloud-connections.functions.ts` (consulta da linha ~23) passa a filtrar números só de conexões `enabled = true`, como já faz `listCloudSenders`.
- Atualizar o hash do arquivo no contrato de permissões; sem nova permissão (mesma leitura).
- Validação: `permissions:check`, testes de `src/lib/whatsapp`, Playwright em `/settings/whatsapp`.
