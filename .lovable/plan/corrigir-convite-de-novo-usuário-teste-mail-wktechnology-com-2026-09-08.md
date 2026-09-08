# Corrigir convite de novo usuário (teste@mail.wktechnology.com.br)

## O que eu verifiquei agora

- O convite existe e continua **pendente** (criado 08/09 19:59, expira 22/09, sem data de aceite).
- **Nenhuma conta foi criada** para esse e-mail: ele não aparece na lista de usuários da plataforma, e o registro de auditoria de autenticação não tem nenhum evento com esse endereço.
- Foram registrados **7 envios do e-mail de convite** (o primeiro às 19:59 e os reenvios às 20:05 e 20:17), todos com status "enviado" e sem mensagem de erro.

Conclusão: o login falha porque a conta realmente nunca foi criada. A etapa final do convite (que cria a conta, define a senha e coloca a pessoa no workspace) não chegou a rodar com sucesso — a tela apenas mostrou o erro e mandou para o login. A causa exata dessa falha ainda **não está confirmada**, então o primeiro passo do plano é reproduzir e capturar o erro real.

## Plano

1. Reproduzir a conclusão do convite
   - Abrir o link do convite em navegador e enviar o formulário com nome, telefone e senha, capturando a mensagem de erro exata e a resposta do servidor.
   - Se o erro não aparecer no navegador, chamar diretamente a rotina de conclusão do convite com um e-mail de teste descartável para ver a mensagem original.

2. Corrigir a causa encontrada
   - Ajustar a rotina de conclusão do convite para que qualquer falha parcial seja informada com mensagem clara em português (hoje o usuário só vê "Erro ao aceitar convite") e para que a criação da conta e a entrada no workspace não fiquem pela metade.
   - Garantir que, se a conta já existir, a senha seja redefinida e a pessoa entre no workspace do mesmo jeito.

3. Corrigir o reenvio de convite
   - O reenvio usa sempre a mesma chave de idempotência por convite (`workspace-invite:<id>`), o que faz o serviço de e-mail tratar o segundo envio como repetição e não entregar nada novo — coerente com os 7 registros "enviado" sem o usuário receber.
   - Passar a incluir a tentativa/horário na chave, para que cada reenvio seja uma entrega nova, mantendo a proteção contra duplo clique.

4. Deixar o convite atual utilizável
   - Após a correção, reenviar o convite pendente para `teste@mail.wktechnology.com.br` e concluir o cadastro até o login funcionar.

5. Validar
   - Rodar verificação de tipos, lint e testes.
   - Conferir no banco: conta criada, membro do workspace, perfil, papel padrão e conjunto de permissões aplicados, e convite marcado como aceito.

## Detalhes técnicos

- Arquivos envolvidos: `src/lib/workspace-invites.functions.ts` (`consumeInvite`, `resendWorkspaceInvite`, `sendWorkspaceInviteEmail`) e `src/routes/accept-invite.$token.tsx` (tratamento de erro na UI).
- `consumeInvite` é pública por design (usa o token como credencial); nada de RLS, schema ou permissões será alterado.
- `consumeInvite` faz várias escritas em sequência (auth, `profiles`, `workspace_members`, `user_job_roles`, `user_permission_sets`, `workspace_invites`). A correção incluirá ordem segura e reentrada idempotente, para que um novo clique no link conclua o que faltou em vez de falhar.
- Sem mudanças no webhook de e-mails de autenticação nem nos modelos recém-gerados.
