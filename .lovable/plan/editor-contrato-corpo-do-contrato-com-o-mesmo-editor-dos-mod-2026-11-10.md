# EDITOR-CONTRATO — corpo do contrato com o mesmo editor dos modelos

**Porte P, ~30–45 min.**

## Problema
Na ficha do contrato (aba Documento), "Cláusulas / corpo do contrato" é uma caixa de texto simples que mostra o código HTML cru (`<p style=...>`). Nos Modelos de Contrato o mesmo conteúdo aparece formatado num editor com barra de ferramentas e rolagem própria.

## O que muda
- Trocar a caixa de texto pelo mesmo editor dos modelos (negrito, alinhamento, listas, tabelas), com barra de ferramentas fixa e rolagem interna (altura máxima 70% da tela).
- O texto continua salvo no mesmo lugar, pelo botão Salvar atual. Nada no banco muda.
- Remover o aviso "Um editor rico será adicionado numa próxima sprint".
- Quem não tem permissão de editar o contrato vê o editor em modo leitura (mesma regra que já vale para os demais campos).
- Atualizar o artigo da Ajuda "Editar a ficha de um contrato" (nova versão).

## Detalhes técnicos
- `src/routes/_authenticated/contracts.$id.tsx`: substituir `Textarea` por `WordEditor` de `@/components/word-editor-lazy` (`value={bodyHtml}`, `onChange={setBodyHtml}`, `minHeight={420}`, `maxHeight="70vh"`), respeitando a flag de edição existente.
- Atualizar hash no `permission-contracts.json` (apresentação, sem novas ações), `docs/help/contracts/editar-contrato.md` + catálogo (bump de versão).
- Validação: permissions:check, typecheck, testes de contratos/Ajuda, Playwright na aba Documento do contrato `fb1f16a5-...`.
