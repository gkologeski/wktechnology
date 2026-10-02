# Proposta: assistente completo e documento final igual ao da cotação

## 1. Data de validade (passo Identificação)
- Usar o seletor de data pt-BR padrão, com Personalizado, Ontem, Hoje, Amanhã e Limpar, ocupando a largura total da coluna e com o rótulo acima do campo, como os outros campos.
- Abrir o calendário para baixo e alinhado ao campo, sem invadir o topo da janela.

## 2. Itens e valores (correção)
- Causa: quando a proposta é criada por "+ Adicionar" no Negócio, o assistente não lê os itens de linha do negócio. Ele só lê os itens quando a proposta parte de uma cotação.
- Correção: nas propostas criadas a partir do negócio, o passo mostra os itens de linha do negócio (serviço, perfil, forma de cobrança e valor). O total já vem somado, e o usuário pode ajustá-lo.
- Na edição de uma proposta, os itens vêm da cotação ou do negócio de origem.

## 3. Conteúdo: modelos de proposta em vez de cláusulas
**Avaliação:** você tem razão. Cláusulas são termos jurídicos do contrato. A proposta precisa de **modelos de proposta**: texto comercial com seções, como escopo, metodologia, SLA, garantia, investimento e prazos.

**Sugestão:**
- **Novo cadastro de modelos de proposta** em Configurações › Modelos de proposta. Cada modelo tem nome, conteúdo com variáveis (cliente, negócio, itens, total, validade) e os serviços do catálogo a que se aplica.
- **4 modelos iniciais prontos**, um para cada serviço: Hunting, Outsourcing, Fábrica de Software e Consultoria. Eles usam as seções que já existem hoje. Você pode editar ou criar outros.
- **No passo Conteúdo:** primeiro aparece a lista de modelos, com o modelo **sugerido** destacado ("Sugerido para Outsourcing de TI"). A sugestão sai do serviço do catálogo que mais aparece nos itens de linha. Ao escolher um modelo, o texto é preenchido com os dados do negócio e dos itens. Depois, o texto continua editável no próprio passo.
- As **cláusulas** saem do assistente de proposta e continuam só no contrato.

## 4. Resultado final: documento, não tela de edição
Hoje, ao concluir, o sistema abre uma tela de edição. Passará a funcionar como a cotação:
- **Concluir** no assistente gera o **documento da proposta**: uma página com o mesmo visual do documento da cotação (cabeçalho com a marca do workspace, dados do cliente, tabela de itens, total, validade e conteúdo do modelo) e o botão "Baixar PDF".
- Cada proposta ganha um link próprio, que pode ser enviado ao cliente. O cliente pode aceitar ou recusar a proposta por esse link, como na cotação.
- **A ficha atual da proposta deixa de ser uma tela de edição.** Ela vira a visualização do documento, com uma barra de ações: Editar (abre o assistente), Enviar para aprovação e aprovar/recusar, Enviar ao cliente, Copiar link, Baixar PDF e Gerar contrato. As aprovações, o travamento e o histórico continuam funcionando como hoje. Só a edição livre sai dessa tela e passa para o assistente.
- No quadro Propostas do Negócio, o menu "..." ganha "Copiar link" e "Baixar PDF".

## Fora do escopo
- Regras de aprovação e travamento, e geração de contrato: nada muda.
- Assistente e documento da cotação: nada muda.

## Detalhes técnicos
- **Migração:**
  - Nova tabela `proposal_templates` (`workspace_id`, `name`, `html`, `is_default`) e a tabela de ligação `proposal_template_services` (`template_id`, `service_catalog_id`). Na mesma migration, nesta ordem: CREATE, depois GRANT, depois RLS por `is_workspace_member`, com escrita para admin.
  - Coluna `proposals.public_token` (única) e `proposals.proposal_template_id`, com preenchimento das propostas existentes.
  - Os 4 modelos iniciais, com INSERT na migration para cada workspace, ligados aos serviços do catálogo pelo nome/código.
- **Servidor:**
  - `proposalDraftFromDeal(dealId)` lê os `deal_line_items`.
  - `listProposalTemplatesForDraft` devolve os modelos e a sugestão (reaproveita `resolveCatalog`).
  - O modelo é preenchido com o renderizador de variáveis da cotação (`renderQuoteTemplate`) e os tokens da proposta.
- **Documento:**
  - Rota pública `src/routes/proposal.$token.tsx`, espelhando `quote.$token.tsx`.
  - `getProposalByToken` e `respondToProposal`, públicas e validadas pelo token.
  - PDF em `src/routes/api/public/proposals/$token.pdf.ts`, reaproveitando o gerador da cotação.
- **Ficha interna:** `/proposals/$id` renderiza o mesmo componente de documento, com a barra de ações. O editor livre e o painel de cláusulas saem dessa tela.
- **Assistente:**
  - O passo Conteúdo usa o seletor de modelos mais o editor. As cláusulas saem.
  - A data usa o `DatePicker` com o rótulo em bloco e `align="start"`.
  - Ao concluir, navega para `/proposals/$id`, que mostra o documento.
- **Configurações:** a tela `settings.proposal-templates.tsx` (lista, edição e serviços vinculados) entra no menu de Configurações do TechSales.
- **Validação:** typecheck, lint e Playwright. O teste percorre os 4 passos com os itens do negócio, verifica a sugestão de modelo e cancela sem criar. A criação real, o documento e o PDF só serão testados com a sua autorização.
