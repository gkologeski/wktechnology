# CNPJ-ATIVO — Controles das Empresas (CNPJs) e vínculo de registros

Porte: G (fatiado). Estimativa total: 6–9 h. Entrega 1: P/M, 1,5–2 h. Entrega 2: M, 2–3 h. Entrega 3: G, 3–4 h.

## Situação atual (conferida)
- A tela já tem Nova empresa, Editar, Excluir e o switch "Ativa" dentro do formulário.
- 7 CNPJs no workspace WK: CMK (4.324 lançamentos), CW (6.485), GM (16.190), Kologeski (524), Polo (714), WK (34, padrão) e Fluxo (0).
- Hoje só 9 áreas guardam o CNPJ: lançamentos financeiros, faturas, NFS-e, contas bancárias, categorias, centros de custo, contratações (TechHire) e provisões. Leads, negócios, contratos, projetos, pessoas etc. não têm CNPJ.

## Entrega 1 — Controles na tela
- Coluna Status com selo Ativa/Inativa e filtro (Ativas / Inativas / Todas) com busca.
- Ações por linha: Editar, Desativar/Reativar (com confirmação), Definir como padrão, Excluir.
- Desativar nunca apaga nada: lançamentos, faturas e históricos continuam visíveis e filtráveis; o CNPJ só deixa de aparecer como opção em novos cadastros.
- Excluir só é permitido quando não há nenhum registro ligado; caso haja, a confirmação mostra as contagens por área e oferece "Desativar em vez disso".
- Não permitir desativar/excluir o CNPJ padrão sem antes escolher outro padrão.
- Loading, vazio, erro, foco e modo escuro.

## Entrega 2 — Regra no servidor
- Exclusão bloqueada no banco quando houver vínculos (não depende da tela).
- Novos registros e edições não aceitam CNPJ inativo; registros antigos mantêm o CNPJ inativo.
- Seletores de CNPJ em Financeiro/Contratos/NFS-e escondem inativos (mostram o atual se já estiver salvo).
- Permissões: reutilizar as de Empresas (CNPJs) para editar; nova ação "desativar" registrada em /settings/permissions, sem concessão automática; testes permitido/negado/outro workspace/inativo.

## Entrega 3 — Todo registro com CNPJ
- Adicionar CNPJ (opcional, preenchido com o padrão) em: negócios, propostas, cotações, contratos, projetos, pessoas, vagas e assinaturas/serviços.
- Herança automática: proposta/contrato herdam do negócio; projeto e lançamentos herdam do contrato.
- Preencher os registros já existentes com o CNPJ padrão do workspace (WK) ou pela origem, sem trocar os que já têm.
- Leads, contatos e empresas clientes: herdam pelo negócio, sem campo próprio (são da carteira, não de um CNPJ). Confirme se concorda.
- Ajuda: artigo de Empresas (CNPJs) atualizado e versão incrementada.

## Detalhes técnicos
- Migrations novas: gatilho `BEFORE DELETE` em `legal_entities` contando vínculos; gatilho de validação de CNPJ ativo em INSERT/UPDATE de `legal_entity_id`; colunas `legal_entity_id uuid null` + índice e backfill nas tabelas da Entrega 3.
- Server function `getLegalEntityUsage` (contagens por área, RLS do usuário) e `setLegalEntityActive`, ambas em `legal-entities.functions.ts`, usando `deleteRowGuarded`.
- Testes vitest: exclusão bloqueada com vínculos, desativação preserva registros, CNPJ inativo recusado em novo lançamento.

## Não incluído
- Não altera lançamentos existentes, nem muda CNPJ de nenhum registro já preenchido.
