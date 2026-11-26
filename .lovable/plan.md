# Diagnóstico da publicação (somente leitura)

## Achados verificados
- Sandbox: HEAD = origin/main = `31b2528b` (merge do PR #57), árvore limpa. Metadados Git e checkout coincidem.
- Arquivos reais: `projects-imports-hub.tsx` importa e renderiza `ImportJourneyPage` (linhas 7 e 33). O checkout já é o novo.
- Publicação: `published_at` = 26/11 09:35 UTC e `has_unpublished_changes = true`. O deploy 17304115 **não aparece como publicado**.
- `app.wktechnology.com.br` serve `5b6fd769…` (build 04:34:54Z). crm/ats respondem 301 (redirecionam para o domínio principal).
- Não tenho acesso de leitura ao status/logs internos do deploy 17304115; não consigo afirmar se ainda está construindo ou se falhou. Como a data de publicação não avançou depois do merge, o mais provável é que ele não tenha concluído (falhou ou ficou pendente). Não há indício de checkout antigo.

## Recuperação gerenciada (aguarda sua aprovação; nada será feito sem ela)
1. Conferir o status do deploy 17304115 no painel Publish.
2. Se falhou ou ficou parado: **Publish → Publish changes** uma única vez. Isso não reaplica as migrações 0479–0482 (o banco é separado da publicação).
3. Validar depois: `/build-info.json` deve mostrar `816c08c7…` e `published_at` deve ser mais recente.

Porte P, cerca de 5–15 min, só após a aprovação.
