# Sabrina não vê contratos em TechContracts — diagnóstico e correção

## Diagnóstico (confirmado por consulta ao banco)

- `sabrina@wktechnology.com.br` é **membro** (role `member`) do workspace `184b…3f5d`, que é exatamente o workspace dos 14 contratos existentes.
- As policies de leitura da tabela `contracts` **não são o bloqueio**: existe uma policy permissiva por participação no workspace, e os privilégios de leitura da API estão presentes.
- O bloqueio está no **RBAC de aplicação**: o único cargo atribuído a ela é o cargo de sistema **"Read-Only"**, e esse cargo tem **30 permissões, todas de TechSales / TechHire / sistema — nenhuma de `techcontracts.*`**.
- A rota `/contracts` é gatada pelo recurso `techcontracts.contracts` (mapa de recursos de menu), então sem `techcontracts.contracts.view.*` o item de menu e a tela ficam indisponíveis para ela.
- Efeito colateral do mesmo problema: "Read-Only" também não tem nenhuma chave de **TechContracts, TechPeople, TechFinance, TechProjects e TechServices** — qualquer usuário nesse cargo fica sem esses módulos.

Observação sobre a imagem enviada: o "Object not found" ao abrir o PDF do contrato é um problema **diferente** (arquivo ausente no storage) e não está incluído neste plano.

## Correção proposta

### 1. Ajuste imediato para a Sabrina (sem código)
Em `/settings/permissions`, atribuir a ela um cargo que inclua leitura de contratos, ou criar um cargo customizado com:
- `techcontracts.contracts.view.workspace`
- `techcontracts.contract_templates.view.workspace` (opcional, para ver modelos)
- `techcontracts.esign.view.workspace` (opcional)

### 2. Completar o cargo de sistema "Read-Only" (migração)
Adicionar em `permission_set_items` do cargo Read-Only as chaves de **visualização** que hoje faltam, mantendo o cargo estritamente somente-leitura:
- TechContracts: `contracts.view.workspace`, `contract_templates.view.workspace`, `approvals.view.workspace`, `esign.view.workspace`
- Equivalentes de `view.workspace` já existentes no catálogo de permissões para TechFinance, TechProjects, TechPeople e TechServices

Nenhuma chave de create/update/delete/export é adicionada. A migração é idempotente (`ON CONFLICT DO NOTHING`).

### 3. Validação
- Reconsultar as permissões efetivas da Sabrina e confirmar `techcontracts.contracts.view.workspace`.
- Login como ela (ou simulação) e verificar: menu TechContracts visível, `/contracts` lista os 14 contratos, botões de criar/editar/excluir permanecem desabilitados.

## Detalhes técnicos

- Cargo: `permission_sets` id `00000000-0000-0000-0000-0000000000a9` (`is_system = true`); há trigger `guard_system_permission_set` protegendo rename/delete — inserir itens continua permitido.
- Gate de rota: `src/lib/menu-resources.ts` → `"/contracts": ["techcontracts.contracts"]`.
- Nenhuma alteração em RLS, grants ou lógica de negócio de contratos.
