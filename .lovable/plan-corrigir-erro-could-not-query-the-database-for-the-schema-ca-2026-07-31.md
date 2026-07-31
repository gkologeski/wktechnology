# Corrigir erro "Could not query the database for the schema cache" na busca de prospects

## O que está acontecendo

A mensagem não vem do código da aplicação: é uma resposta da camada de API do banco quando o cache de schema dela está sendo recarregado. Isso acontece logo após alterações de estrutura de tabela (as colunas de responsável foram adicionadas e removidas em Leads, Contatos, Empresas e Negócios nesta sessão). Enquanto o cache não termina de recarregar, qualquer chamada ao banco pode falhar por alguns instantes.

Diagnóstico ainda não confirmado: preciso validar se o cache já se recuperou ou se o erro persiste.

## Passos

1. Verificar o estado atual do banco e da API: consulta simples de leitura em `leads` e `prospecting_searches`, além do log do servidor de desenvolvimento, para confirmar se o cache voltou ao normal.
2. Se ainda estiver degradado, forçar o recarregamento do cache de schema (`NOTIFY pgrst, 'reload schema'`) e reconfirmar.
3. Revisar a busca de prospects (`src/lib/prospecting/*` e o formulário de busca) para garantir que nenhuma coluna inexistente está sendo selecionada — o mesmo tipo de erro que quebrou a fila (`assigned_to`, `lifecycle_stage`) pode existir no fluxo de busca.
4. Tratar o erro na interface: exibir mensagem em português com ação sugerida ("tentar novamente") em vez do texto técnico do banco, mantendo o `ErrorState` padrão do design system.
5. Adicionar nova tentativa automática (retry) na chamada da busca para erros transitórios de cache de schema.

## Detalhes técnicos

- Passos 1 e 2 usam apenas leitura no banco e recarregamento de cache; sem alteração de estrutura.
- Passo 3 compara os `select(...)` do fluxo de busca com as colunas reais das tabelas envolvidas.
- Passos 4 e 5 ficam restritos aos componentes e às server functions de prospecção, sem tocar em RLS, autenticação ou regras de negócio.

## Como validar

Abrir `prospecting?tab=prospecting`, executar uma nova busca e confirmar que ela retorna resultados; em caso de falha, ver mensagem em português com botão de tentar novamente.
