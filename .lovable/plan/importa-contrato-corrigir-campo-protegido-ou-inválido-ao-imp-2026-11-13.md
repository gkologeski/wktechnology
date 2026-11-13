# IMPORTA-CONTRATO — corrigir "Campo protegido ou inválido" ao importar contrato

Porte P, estimativa 15–25 min.

## Causa (confirmada no código e no banco)
Ao clicar em salvar na importação de contrato, a tela envia, junto com os dados lidos do arquivo, os campos de assinatura eletrônica (provedor, id do documento e id da operação de assinatura). O banco protege esses três campos — só o fluxo de assinatura pode gravá-los — e recusa o salvamento inteiro com "Campo protegido ou inválido."

## O que muda
- A importação deixa de enviar esses três campos protegidos; todo o resto (título, valores, datas, multa, foro etc.) continua sendo salvo.
- Se o arquivo trouxer o provedor/ids de assinatura, eles ficam guardados como informação de referência do contrato importado (dentro das informações extras do contrato), sem tocar nos campos protegidos.
- Nenhuma regra de acesso do banco é alterada.

## Detalhes técnicos
- `src/components/contracts/import-contract-file-dialog.tsx` → `buildPatch`: remover `signature_provider`, `signature_document_id`, `signature_operation_id`; quando presentes, enviar em `metadata.imported_signature` (mesclando com o metadata atual lido do contrato criado, para não sobrescrever).
- Conferir que todas as demais chaves do patch existem em `contracts` (consulta de colunas) e retirar qualquer uma inexistente.
- Teste unitário extraindo `buildPatch` para função pura (`src/lib/contracts/import-patch.ts` + teste) garantindo que nenhuma chave protegida sai no patch.
- Ajuda: nota em `docs/help/contracts/` (artigo de importação) + bump de versão; hash em `permission-contracts.json` (mesma permissão de edição de contrato, sem chave nova).
- Validação: teste unitário, typecheck e importação real no navegador.
