# Jornada comercial e contratação — protótipo aprovado em 14/11/2026

Painel na ficha do negócio: Cotação → Proposta → Minuta → Contrato → Serviço. Dados reais, sem simulações no produto.

## Auditoria e entrega

1. Reutilizar QuoteWizard, ProposalWizard, aprovação jurídica, aceite público da minuta e assinatura nativa/externa. Centralizar a jornada e retirar quadros duplicados da lateral.
2. Seleção explícita de origem: não misturar propostas, minutas e contratos diferentes. Consulta restrita não significa documento inexistente. Consultas por negócio/workspace, sem corpos/URLs de assinatura no resumo.
3. Abertura manual autorizada/idempotente da minuta, hoje dependente do workflow; conferência curta para converter a minuta aceita no contrato definitivo. Preservar texto/versão aceita, em vez de regenerar cláusulas do modelo.
4. Serviço usa evidências de assinatura e fluxos existentes de entrega. Status ativo não comprova assinatura. Ajuda, testes/RLS, CI, publicação e comprovação do hash público.

## Permissões e continuidade

Negócio visível e chave de cada documento; RLS e campos protegidos preservados. Nova chave techcontracts.contract_drafts.create.workspace para abertura manual, sem concessão automática. Revisão/envio continua restrito ao Jurídico listado. Criação mantém contracts.create; assinatura mantém signature_evidence/esign; execução mantém permissões de projetos/serviços. Financeiro é responsabilidade operacional, sem nomes ou bypass fixos. Migração aditiva, sem alterar contratos históricos, cargos ou workflows de terceiros.

Estimativa inicial 6–10 horas incluindo validação/publicação; serviços remotos podem acrescentar espera. Pacotes: modelo/leitura; painel/ações; invariantes SQL; Ajuda/testes/publicação.
