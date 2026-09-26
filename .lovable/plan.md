# Corrigir a identificação dos balões na conversa colada do WhatsApp

## Diagnóstico confirmado

A conversa de Andressa foi gravada em 26/09 com nove balões de cliente e nenhum balão do usuário. O texto exportado identifica a remetente como “Andressa Wolf”, mas o cadastro do mesmo workspace traz “Andressa Wolf Kologeski”. A regra atual reconhece o nome completo do usuário atual, seu telefone ou um nome de membro seguido de telefone; não reconhece essa abreviação. Assim, o visual branco não é apenas uma troca temporária de estilo: já está salvo no registro.

## O que será feito

1. Reconhecer nomes abreviados de membros do workspace somente quando houver correspondência única e outro participante identificado por telefone. Sem essa segurança, manter os balões como cliente, sem inferir remetente.
2. Usar a mesma identificação no momento de salvar novas atividades e edições, preservando as direções nos balões gravados.
3. Corrigir somente a atividade de Andressa identificada na investigação, reconstruindo os balões a partir do texto original fornecido, após conferir que o conteúdo corresponde ao registro. Não reclassificar automaticamente conversas antigas cujo texto de origem não esteja disponível.
4. Adicionar testes para o caso Andressa, nomes ambíguos e a preservação de conversas já salvas. Conferir a conversa após recarregar a tela em desktop e celular.

## Limites técnicos

Ajustes restritos ao conversor, aos testes e, se a conferência do registro permitir, àquela atividade. Sem mudança de schema, RLS, permissões ou demais conversas. A direção não pode ser recuperada com segurança do HTML antigo isolado; a correção pontual depende do texto original anexado.
