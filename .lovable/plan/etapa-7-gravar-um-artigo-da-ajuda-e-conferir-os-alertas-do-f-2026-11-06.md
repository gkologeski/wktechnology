# Etapa 7: gravar um artigo da Ajuda e conferir os Alertas do Financeiro

Porte P, cerca de 5 a 10 minutos. Nada de código, migrations, rascunho, outros artigos ou publicação.

## O que será feito
1. Abrir https://app.wktechnology.com.br usando só a sessão autorizada que já está injetada no navegador. Não crio sessão nem credencial. Se não houver sessão, paro e informo que está bloqueado.
2. No navegador, como o próprio usuário e sob as regras de acesso do banco, conferir se a conta pode editar a Ajuda (`help_can_edit`). Se não puder, paro sem gravar.
3. Ler o artigo `people/gerenciar-acessos-vinculo-na-ficha`:
   - se não existir, crio o artigo com o conteúdo fixo enviado, na versão 2;
   - se existir com versão menor que 2, atualizo só esse artigo, e só se a versão ainda for a que eu li (assim não sobrescrevo uma edição feita ao mesmo tempo);
   - se a versão for 2 ou maior, não gravo nada.
   O próprio banco registra o usuário autenticado como autor da mudança.
4. Ler o artigo de novo e conferir versão, autor, título e se o texto bate com o enviado.
5. Abrir /finance só para leitura e observar o bloco "Alertas" por até 45 segundos. Anoto se ele termina de carregar, o tempo que levou, os erros e uma captura.

## Limites
- Esta é a única gravação. Não clico em nada que altere dados.
- Se a regra de acesso recusar a gravação, informo como bloqueado e não tento nenhum outro caminho.
- O relatório trará o resultado real de cada passo e o que não foi possível verificar.
