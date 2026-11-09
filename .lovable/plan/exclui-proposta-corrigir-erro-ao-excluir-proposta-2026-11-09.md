# EXCLUI-PROPOSTA — corrigir erro ao excluir proposta

Porte P · estimativa 15–25 min.

## Causa (verificada no banco)
Cada proposta guarda o histórico de versões do documento em `proposal_document_versions`. A ligação dessa tabela com a proposta não tem regra de exclusão (NO ACTION), por isso o banco recusa apagar uma proposta que já tem versões. As outras ligações já estão resolvidas: aprovações são apagadas junto; contratos e minutas apenas perdem o vínculo.

## Correção
- Migration: trocar a ligação `proposal_document_versions_proposal_id_fkey` para `ON DELETE CASCADE` (as versões são parte da proposta e não têm sentido sozinhas). Sem mudança de permissões/RLS: quem já pode excluir a proposta continua sendo o único que consegue.
- Contratos e minutas gerados continuam preservados (vínculo vira vazio), como hoje.
- Teste: incluir no teste Postgres existente de proposta aceita um caso "excluir proposta com versões apaga as versões e preserva o contrato".

## Validação
- Rodar o teste do módulo; verificar a regra no banco após a migration.
- Playwright: excluir uma proposta de teste com versões e confirmar a mensagem de sucesso.

## Fora do escopo
Nenhuma mudança de tela, Ajuda ou permissão.
