# Corrigir erro ao salvar modelo de proposta

**Porte P — estimativa ~20–30 min** (correção + teste + conferências). Sem mudança de banco, permissões ou dados.

## Causa (confirmada no código)
Ao salvar, o sistema apaga e regrava os serviços vinculados ao modelo. Todo comando de gravação do TechSales passa por uma proteção que, para confirmar que a exclusão não foi barrada pelas permissões, pede de volta a coluna `id` da linha apagada. A tabela de vínculo modelo↔serviço (`proposal_template_services`) não tem `id` (a chave é modelo + serviço), então o banco responde "column proposal_template_services.id does not exist". O erro não depende de trocar o nome: ocorre em qualquer edição de modelo existente.

## O que muda
- Ao limpar os serviços do modelo, pedir de volta `template_id` (coluna que existe), mantendo a proteção contra exclusão silenciosa.
- Revisar os outros vínculos sem `id` (`deal_contacts`, `segment_members`) que usam a mesma proteção; corrigir do mesmo jeito se algum também omitir o retorno.
- Nada muda em permissões: continua exigindo `techsales.proposal_templates` criar/alterar, membro ativo e workspace.
