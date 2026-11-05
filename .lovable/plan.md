# Fluxo de contratação integrado (TechSales → TechHire → TechPeople → TechContracts → TechProjects → TechFinance)

Porte: G (épico) — estimativa total 14–20 h, entregue em 5 pacotes P/M. Cada pacote é testado e relatado antes do próximo.

## Regras de negócio (do pedido)

1. **Origem do fluxo**
   - Profissional que atende cliente (CLT, PJ ou Freelance): começa no **TechSales**, a partir de um negócio ganho com serviço de Hunting/Outsourcing.
   - Time interno (administrativo, marketing, financeiro) e cargos técnicos de gestão compartilháveis entre projetos/contratos: começam direto no **TechHire/TechPeople**, sem negócio.
2. **Vínculo de CNPJ (Outsourcing)**: ao contratar, o prestador e o cliente ficam ligados ao **mesmo CNPJ da WK** escolhido no negócio. O sistema bloqueia CNPJs diferentes.
3. **Período**: o período de alocação/provisionamento vem por padrão das datas do contrato de venda do serviço; pode ser alterado manualmente, com registro de quem alterou e por quê.
4. **Modelo de acesso por área e cargo**: cada cargo tem um modelo de acesso. Ao admitir, o usuário recebe o modelo do cargo (nunca acesso automático além dele).
   - Ex.: Desenvolvedor de Outsourcing → apontar horas só no projeto alocado + seus dados pessoais.
   - Ex.: Assistente Financeiro → acesso controlado a TechFinance, TechSales, TechPeople e TechProjects.

## Pacotes

1. **Auditoria e desenho (P, 1–1,5 h)** — mapear o que já existe: perfis de vaga do negócio, requisição TechHire, admissão TechPeople, CNPJs WK (`legal_entities`), alocações, cargos (`job_roles`) e pacotes de permissão. Entrega: matriz do que reaproveitar e lacunas. Nenhuma alteração.
2. **Origem e tipo de contratação (M, 3–4 h)** — campo "tipo" (Cliente: CLT/PJ/Freelance | Interno | Gestão compartilhada) na requisição; exigir negócio ganho para tipo Cliente; caminho direto para Interno/Gestão.
3. **CNPJ WK único + período (M, 3–4 h)** — CNPJ WK escolhido no negócio é herdado pela requisição, contrato do prestador e contrato do cliente, com trava no banco; período padrão do contrato de venda, editável com auditoria.
4. **Modelos de acesso por cargo (M, 4–6 h)** — tela em Configurações → Permissões para associar cargo → modelo; aplicação automática na admissão e remoção no desligamento; dois modelos iniciais (Desenvolvedor de Outsourcing, Assistente Financeiro) para você revisar antes de ativar.
5. **Integração e testes ponta a ponta (M, 3–4 h)** — da venda ganha até o primeiro apontamento de horas e lançamento financeiro; testes de permissão (permitido, sem chave, negado, outro workspace, inativo); teste no navegador.

## Detalhes técnicos

- Reutilizar RPCs `role_profile_*` e a regra de 1 requisição TechHire por perfil (sem duplicar vagas).
- Trava de CNPJ via gatilho de validação (não CHECK); migrations aditivas.
- Modelos de acesso sobre `job_roles` + pacotes locais por workspace; deny prevalece; membership ativo obrigatório.
- Novas ações cadastradas em `permissions` com contrato em `permission-contracts.json`; `permissions:check` antes de tipos/testes.

## Dúvidas a confirmar durante o pacote 1

- Freelance também usa o CNPJ WK do negócio ou contrato direto pessoa física?
- Quem pode alterar o período e o modelo de acesso (admin, gestor do projeto, RH)?
