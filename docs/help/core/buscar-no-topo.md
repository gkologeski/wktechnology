---
module_key: core
slug: buscar-no-topo
title: Buscar registros no topo do TechERP
summary: Encontrar contatos, empresas, negócios e atividades pela busca global.
article_type: howto
route_pattern:
min_permission:
audience: internal
sort_order: 11
version: 2
is_published: true
---
# Buscar registros no topo do TechERP

**Para que serve:** Encontrar registros acessíveis sem abrir cada listagem.

**Quem pode fazer:** Membros autenticados e ativos. Cada resultado respeita as permissões, a carteira, o workspace e os campos protegidos.

**Onde fica:** Botão Buscar ou perguntar no cabeçalho, ou atalho Ctrl K no Windows e Command K no Mac.

**Antes de começar:** Entre no workspace correto com sua conta ativa.

## Passo a passo
1. Abra a busca e digite pelo menos três caracteres. Prefira um nome, domínio, e-mail ou palavra específica.
2. Aguarde os grupos aparecerem. Você já pode abrir um resultado enquanto outros grupos carregam. As atividades encontradas pelo assunto aparecem sem aguardar a consulta ao conteúdo.
3. Para reduzir a busca, selecione Contatos, Empresas, Negócios, Tickets, Atividades, Candidatos ou Vagas.
4. Clique no registro, ou navegue pelas opções com as setas e pressione Enter.
5. Para comandos de navegação, comece com uma barra. Para uma pergunta interpretativa, use Perguntar ao Copilot.

## Resultado esperado
Os grupos mostram registros autorizados conforme ficam prontos, sem esperar uma resposta de IA.

## Regras e limites
- A busca comum não depende de uma resposta de IA.
- Ao mudar o termo ou fechar a janela, as requisições antigas são canceladas. Resultados do termo anterior deixam de aparecer. Consultas e caches são separados por usuário, workspace e permissões de leitura.
- Uma correspondência no e-mail ou no texto de uma atividade pode aparecer mesmo que a palavra não esteja no título.
- Se a pesquisa no conteúdo das atividades ultrapassar seu orçamento de tempo, o sistema indica resultados parciais. Refine o termo e tente novamente; ausência de um resultado parcial não comprova que o registro não existe.
- Campos ocultos ou mascarados não podem revelar resultados por meio de uma pesquisa por esse campo.
- Recentes e fixados conferem a visibilidade e o nome atual dos registros ao abrir a busca; o título salvo anteriormente não autoriza acesso.
- Em caso de falha ou resultado parcial, use **Tentar grupos pendentes**. Apenas os grupos incompletos são consultados novamente; os resultados disponíveis permanecem na tela.

## Erros comuns
**Alguns grupos não puderam ser buscados:** refine o termo ou selecione uma categoria e tente novamente. Se persistir, informe ao suporte o termo e a categoria.

**Nenhum resultado:** confirme o workspace, o termo e as permissões. Não é necessário conceder administração geral para usar a busca.

## Relacionados
- [Usar a Ajuda](/ajuda/core/usar-ajuda)
