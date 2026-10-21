# Permitir que Aline troque o responsável das conversas da Inbox

## O que acontece hoje (confirmado)
- Aline (aline@wktechnology.com.br) é membro **ativo** da WK com papel **gerente**, não administradora.
- A regra de segurança das conversas (WhatsApp e E-mail) só deixa alterar quem é administrador do workspace ou "dono" do registro. As conversas recebidas são gravadas com o próprio workspace como dono (125 no WhatsApp), e Aline não passa nessa regra.
- O banco recusa a alteração **sem avisar**: a tela não mostra erro, mas o responsável não muda.
- Já existem permissões próprias para isso (`Inbox › WhatsApp/E-mail/Chat › editar`, nos escopos própria, equipe e workspace), mas a regra do WhatsApp e do E-mail não as consulta.

## O que será feito
1. **Troca de responsável pela permissão da Inbox**: uma rotina única no servidor passa a atribuir o responsável de WhatsApp, E-mail e Chat verificando membership ativo e a permissão "editar" da Inbox do canal:
   - escopo **workspace**: qualquer conversa do workspace;
   - escopo **equipe**: conversas sem responsável, suas ou de colegas de equipe;
   - escopo **própria**: só as suas.
   Ela altera **apenas** o campo responsável; nada mais da conversa muda. "Ver como" continua só leitura e as negações (deny) continuam valendo.
2. **Liberar para a Aline**: conceder a ela, só na WK, a permissão "editar" da Inbox (WhatsApp, E-mail e Chat) no escopo **workspace**, como ajuste individual, sem mudar o cargo dela nem o de outras pessoas e sem torná-la administradora.
3. **Aviso claro**: se a pessoa não tiver permissão, aparece "Você não tem permissão para alterar o responsável desta conversa." em vez de nada acontecer.

## Fora do escopo
Não muda quem vê as conversas, outras ações da Inbox, outros usuários ou outros workspaces.

## Validação
- Testes da regra: escopos workspace/equipe/própria, sem permissão, membro inativo, "Ver como" e outro workspace.
- typecheck, lint, testes e build.
- Teste no navegador entrando como Aline: trocar o responsável de uma conversa e voltar ao original, confirmando que a lista mostra o novo nome.
