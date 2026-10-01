# Corrigir erro ao responder no Inbox WhatsApp

## Causa (confirmada)
Quando você envia uma mensagem, o sistema grava a conversa com o código do workspace no campo de "dono". A regra de segurança da tabela de conversas só permite criar uma conversa quando o dono é o próprio usuário logado. Por isso o envio é barrado com "new row violates row-level security policy". A conversa recebida foi criada pelo próprio sistema (avisos do WhatsApp), com o dono igual ao workspace. O "gravar ou atualizar" usado no envio passa primeiro pela regra de criação e falha.

## O que será feito
1. No envio pelo Inbox e pelos botões das telas (`sendWhatsAppMessage`):
   - procurar a conversa existente (mesmo contato + mesmo número conectado) dentro do workspace;
   - se ela existir, apenas atualizar a última mensagem e o horário dela, sem recriá-la;
   - se não existir, criar a conversa tendo o usuário logado como dono e o workspace atual.
2. Conferir as mesmas regras na gravação da mensagem enviada (`whatsapp_messages`) e ajustar o dono do mesmo jeito, se necessário.
3. Garantir que a mensagem só vá para o WhatsApp depois que a conversa estiver gravada. Se a gravação falhar, aparece um aviso claro em português no lugar do erro técnico.
4. Os envios automáticos (régua de cobrança, campanhas) usam acesso de sistema e não são afetados. Fica como está.

## Fora do escopo
Não muda nenhuma regra de segurança (RLS), estrutura do banco ou permissão. A correção fica só no código de envio.

## Validação
- `bunx tsgo --noEmit`, `bunx eslint` nos arquivos alterados, `bunx vitest run`.
- Teste real: responder "olá, tudo bem?" na conversa +554891104003, confirmar que a mensagem chega no celular e aparece no Inbox com status de envio e depois de entrega.

## Detalhes técnicos
- Arquivo: `src/lib/whatsapp.functions.ts` (bloco do upsert, por volta da linha 90). A troca é de `upsert` para `select` → `update` por id ou `insert` com `owner_id: userId`.
- A política de UPDATE usa `is_workspace_admin_of(owner_id)`/`can_write_owner(owner_id)`. Se um membro sem papel de admin não conseguir atualizar uma conversa criada pelo sistema, essa atualização vira "melhor esforço": o envio segue e o caso fica registrado como pendência, sem alterar a RLS.
