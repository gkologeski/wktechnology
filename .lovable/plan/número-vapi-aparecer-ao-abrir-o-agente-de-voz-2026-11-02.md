# Número Vapi aparecer ao abrir o Agente de voz

Porte: P — estimativa ~10 min (1 arquivo).

## Causa (confirmada no código)
A tela carrega a configuração salva (com o id do número), mas a lista de números da Vapi só é buscada ao clicar no botão de atualizar. Sem a lista, o seletor não acha o item correspondente e fica vazio.

## O que muda
- Buscar a lista de números automaticamente ao abrir a tela (igual já acontece com as vozes).
- Enquanto a lista carrega ou se a busca falhar, o seletor mostra o número salvo como "Número salvo (carregando…)" em vez de vazio, sem apagar a escolha.
- Separar o indicador de carregamento de vozes e números, para um não travar o botão do outro.
- Falha na busca automática mostra aviso discreto, sem perder a seleção salva.

## Técnico
- `src/components/prospecting/pages/voice-agent-page.tsx`: `useEffect` de montagem chama `loadPhones`; item de fallback no `Select` quando `vapi_phone_number_id` não estiver em `phones`; estados `busy` independentes.
- Sem mudança de banco, servidor ou permissões (apresentação; atualizar hash do contrato existente).

## Validação
`permissions:check`, ESLint e Playwright com a conta do usuário: abrir `/settings/voice-agent` e ver o número sem atualizar.
