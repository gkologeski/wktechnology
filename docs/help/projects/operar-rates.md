---
module_key: projects
slug: operar-rates
title: Cadastrar e encerrar tarifas com vigência
summary: Cadastrar e encerrar tarifas com vigência no TechProjects: operação, acesso e limites comprovados no código.
article_type: howto
route_pattern: /projects/settings/rates
min_permission: techprojects.rates.view.workspace
audience: internal
sort_order: 150
version: 1
is_published: true
---
# Cadastrar e encerrar tarifas com vigência

**Para que serve:** A tarifa passa a ser aplicada conforme data, escopo e vigência, preservando o histórico.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. A chave de referência do menu é `techprojects.rates.view.workspace`; alternativas e escopos constam em [Permissões](/ajuda/projects/permissoes).

**Onde fica:** TechProjects > Tarifas e custos (`/projects/settings/rates`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Abra Configurações > Tarifas e custos. Confira as tarifas existentes antes de criar outra.
2. Com gestão de tarifas, informe tipo, escopo, alvo, unidade, moeda, valor e início inclusive; use fim exclusivo quando houver.
3. Se a mudança for retroativa, examine a prévia de impacto e confirme explicitamente. Informe motivo de pelo menos cinco caracteres.
4. Para alterar valor ao longo do tempo, use divisão da vigência; para encerrar, informe o término no comando próprio.
5. Revise as vigências após salvar e confira se não há sobreposição.

## Resultado esperado
A tarifa passa a ser aplicada conforme data, escopo e vigência, preservando o histórico.

## Regras e limites
Leitura: techprojects.rates.view.workspace; gestão: techprojects.rates.manage.workspace. O banco recusa sobreposição e edição direta de valor. Sem tarifa válida, o cálculo fica sem cobertura. Não publique valores reais em capturas.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

<!-- screenshot: Cadastrar e encerrar tarifas com vigência; usar workspace demonstrativo, sem nomes, horas, valores ou credenciais reais. -->
