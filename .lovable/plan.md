# Público WhatsApp: operador configurável entre grupos (E / OU)

## O que muda
- Acima da lista de grupos aparece o seletor **"Combinar grupos com: E / OU"** (padrão OU, como hoje).
- O separador entre os cartões passa a mostrar o operador escolhido ("E" ou "OU"), e o botão vira "Adicionar grupo E" / "Adicionar grupo OU".
- Com **E**, o destinatário precisa atender a todos os grupos; com **OU**, basta um. Contagem ao vivo acompanha a troca.
- Grupos vazios continuam ignorados. Campanhas e segmentos salvos antes continuam como OU.
- Salvar como segmento e carregar segmento preservam o operador.

## Validação
- Testes: E entre grupos faz intersecção; OU faz união; ausência do campo = OU; operador inválido recusado.
- Typecheck, lint, testes e build com resultados reais.
- Playwright em /campaigns/whatsapp: dois grupos, alternar E/OU e conferir que a contagem com E é menor ou igual à com OU. Nada salvo, enviado ou publicado.

## Detalhes técnicos
- `campaign-audience.ts`: entrada ganha `groupsLogic?: "and" | "or"` (padrão `"or"`); `combineAudienceGroups(groups, resolve, logic)` intersecta ou une.
- `campaign-audience.server.ts` e schemas zod das server functions de campanha/segmento: aceitar e validar `groupsLogic`, repassar ao combinador.
- `audience-groups-editor.tsx`: novo `Select` com rótulo acessível, prop `groupsLogic`/`onGroupsLogicChange`; `campaign-audience-panel.tsx` guarda o estado e envia na prévia e no salvamento. Sem migration.
