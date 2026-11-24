# Empresa prestadora: corrigir "Preencher dados da proposta" e permitir troca em todos os pontos

**Porte:** M · **Estimativa:** ~2h a 2h30 (correção ~25 min; troca em todos os pontos ~1h30; testes/Ajuda ~30 min)

## Parte 1 — Correção do erro da Sabrina
1. A rotina que lê os dados da minuta passa a devolver a empresa prestadora gravada na minuta.
2. "Preencher dados da proposta" usa essa empresa ao montar o texto.
3. Se a minuta não tiver empresa, usa a da proposta, depois a da cotação, depois a empresa padrão do workspace. Se nada existir, a mensagem orienta a escolher a empresa na própria tela (Parte 2).

## Parte 2 — Trocar a empresa prestadora em todos os pontos
Um mesmo campo "Empresa prestadora (CNPJ WK)", lendo só empresas do workspace ativo:

| Onde | Quando pode trocar |
|---|---|
| Cotação | Enquanto não aceita |
| Proposta (assistente) | Enquanto não aceita (já existe; conferir) |
| Revisão da minuta | Enquanto não aprovada pelo Jurídico |
| Contrato (Visão geral) | Enquanto rascunho/em revisão; depois de assinado, só por aditivo |

Ao trocar na minuta ou no contrato, o sistema avisa que o texto precisa ser preenchido de novo e registra o histórico (quem, quando, de qual para qual empresa). Documentos aceitos ou assinados não mudam.

## Permissões
- Trocar exige a mesma permissão de alterar o documento (cotação, proposta, minuta ou contrato) — sem nova chave, pois é edição do mesmo registro.
- Servidor confere membro ativo, mesmo workspace e se a empresa pertence ao workspace; deny prevalece.
- Testes: permitido, sem permissão, deny, outro workspace, membro inativo.

## Detalhes técnicos
- Migração nova recriando `contract_draft_merge_source` com `legal_entity_id`; função `contract_draft_set_legal_entity` (SECURITY DEFINER, checa status `pending_legal`/rascunho e workspace) e equivalente para contratos em rascunho.
- `prepareContractDraftText` repassa `contractingLegalEntityId`; `buildMergeContext` ganha a cadeia de fallback.
- Reaproveitar `legal-entity-select.tsx` nos quatro pontos.
- Contratos de permissões com hashes atualizados; testes unitários da cadeia de fallback e testes de banco das regras de status.
- Artigos da Ajuda de cotação, proposta, minuta e contrato atualizados (version bump).

## Validação
`permissions:check`, tipos, testes, build e Playwright: reproduzir o erro na minuta da Brooks, aplicar a correção e confirmar o preenchimento; trocar a empresa em cada tela.

**Status:** nada implementado ainda. Fica para depois: publicar.
