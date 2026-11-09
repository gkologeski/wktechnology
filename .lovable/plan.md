# ACOES-MODELO — controles completos para Modelos de Contrato

Porte P · estimativa 40–60 min.

## Situação verificada (Playwright com sua sessão)
- Na lista, cada linha só mostra dois ícones soltos (duplicar e lixeira), sem rótulo, e eles demoram ~20 s para aparecer porque esperam a checagem de permissão por linha.
- Não há botão "Editar" (só clicar no nome abre), nem "Arquivar"/"Reativar" na lista ou dentro do modelo.
- Dentro do modelo existem apenas Pré-visualizar, Salvar e Publicar; não dá para excluir, duplicar ou arquivar dali.
- Sua permissão permite editar e excluir (confirmado na resposta do servidor) — não é falta de permissão.

## O que muda
**Lista** — coluna Ações vira um menu "⋯" por linha com:
- Editar (abre o modelo)
- Duplicar
- Publicar / Voltar para rascunho / Arquivar / Reativar (conforme o status atual)
- Excluir (com confirmação; vermelho)
Itens sem permissão aparecem desabilitados com dica, em vez de sumirem. O menu aparece já na carga da lista, usando uma única checagem de permissão para todas as linhas.

**Dentro do modelo** — cabeçalho ganha menu "Mais ações": Duplicar, Arquivar/Reativar, Voltar para rascunho e Excluir (com confirmação, volta para a lista).

## Regras
- Mesmas permissões já existentes (criar, alterar, excluir de modelos de contrato); nada novo é concedido. O servidor continua validando cada ação.
- Mudança de status usa a função de atualização já existente; sem mudança de banco.
- Excluir mantém a mensagem "Contratos já gerados não são afetados".

## Entregáveis
- Ajustes nas telas de lista e de detalhe do modelo.
- Atualização do contrato de permissões dos arquivos alterados e do artigo da Ajuda de Modelos de Contrato (com nova versão).
- Validação: checagem de permissões, cobertura da Ajuda, build e Playwright (abrir menu, arquivar, reativar, duplicar e excluir a cópia).
