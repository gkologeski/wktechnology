# BUSCA-EMPRESA-IMPORT — campo Decisão com busca de empresas

Porte P · estimativa 45 min–1h.

## O que muda
Na aba **Mapeamentos** dos importadores Jibble e Clockify (mesma tela compartilhada), quando o **Tipo = Clientes**, o campo "Escolher destino" da coluna Decisão vira o campo padrão de busca de empresas do sistema: ao digitar alguns caracteres, a busca já começa e mostra as empresas encontradas. Só permite escolher empresa existente (não cria nova).

- Pessoas e Projetos continuam com a lista atual.
- Botões Vincular e Ignorar, sugestões e regras de importação não mudam.
- A busca respeita as permissões de leitura de empresas que já existem (nenhuma permissão nova, nenhum acesso ampliado).

## Detalhes técnicos
- `src/components/projects/clockify-import/clockify-review.tsx`: para `entity === "client"`, trocar o `Select` por `CompanyPicker` (`mode="pick"`, placeholder "Buscar empresa"), mantendo o mesmo estado de decisão por linha; se a linha já tiver destino, hidratar o nome pelo id.
- Conferir que o id da empresa escolhida é o mesmo tipo de destino aceito hoje pelo vínculo (clientes → `companies`); se a lista atual vier de outra tabela, ajustar antes.
- Atualizar contrato de permissões (hash) do arquivo; mudança só de apresentação, sem ações/dados novos.
- Atualizar artigos de Ajuda de importação Clockify/Jibble (bump de versão).
- Validar: `permissions:check`, testes do importador, `help:coverage`, e Playwright na tela do Jibble digitando "BROO".
