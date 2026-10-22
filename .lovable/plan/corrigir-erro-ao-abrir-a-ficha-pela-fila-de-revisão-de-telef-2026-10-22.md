# Corrigir erro ao abrir a ficha pela fila de revisão de telefones

Porte P — estimativa de 10 a 25 minutos.

## Diagnóstico (confirmado nos registros)
O link da fila funciona. A ficha que abre carrega dados por rotinas do servidor que usam a credencial administrativa do ambiente. A pré-visualização voltou a rodar sem essa credencial (registro: "Missing SUPABASE_SERVICE_ROLE_KEY"), embora ela exista no ambiente. Por isso a ficha recebe uma página de erro em vez dos dados. Foi o mesmo problema da tela de Permissões. Também aparece um erro secundário ("Cannot read properties of undefined (reading 'method')"), que precisa ser investigado.

## Passos
1. Reiniciar a pré-visualização seguindo o procedimento oficial, para que ela volte a ler a credencial.
2. Com o Playwright, já logado, abrir `/settings/phones` e clicar em nomes de Contato, Lead, Empresa e Pessoa. Confirmar que cada ficha abre sem o aviso vermelho.
3. Investigar o erro `reading 'method'`. Se ele vier do código, corrigir a causa sem mexer em banco, permissões ou RLS.
4. Se o erro voltar com frequência, levantar quais rotinas de leitura das fichas usam a credencial administrativa sem necessidade e propor, em outra etapa, trocá-las pelo acesso do próprio usuário.

## Fora do escopo
Não haverá publicação, mudança de dados nem envio de mensagens.
