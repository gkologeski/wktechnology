# Excluir o serviço "Recursos Humanos (BPO)"

## Situação atual
- Serviço `BPO002` — Recursos Humanos (BPO), ativo.
- Nenhum item de linha de negócio usa esse serviço.
- Está ligado a 2 presets ("Especialista em Recursos Humanos Especialista" e "Recrutador") e 2 cargos ("Especialista em Recursos Humanos" e "Recrutador").

## O que será feito
1. Tirar a ligação dos 2 presets e dos 2 cargos com esse serviço (eles continuam existindo, só ficam sem linha de serviço).
2. Excluir o serviço do catálogo.
3. Conferir se ele sumiu de Cadastros → Serviços e se a tela Presets e Cargos continua abrindo normalmente.

Não há mudanças de código, estrutura do banco ou permissões. A exclusão é definitiva.

## Detalhes técnicos
- Ajuste de dados: `UPDATE contracting_presets` e `UPDATE job_profiles SET service_catalog_id = NULL WHERE service_catalog_id = 'fb83e7a7-…'`, depois `DELETE FROM service_catalog WHERE id = 'fb83e7a7-…'`.
- Antes de excluir, conferir outras referências (serviços de contrato, modelos de contrato) e, se houver, avisar antes de prosseguir.
