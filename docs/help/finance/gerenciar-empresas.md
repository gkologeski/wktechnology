---
module_key: finance
slug: gerenciar-empresas
title: Gerenciar empresas e CNPJs
summary: Gerenciar empresas e CNPJs no TechFinance: operação, acesso e limites confirmados no código.
article_type: howto
route_pattern: /finance/legal-entities
min_permission: techfinance.legal_entities.view.workspace
audience: internal
sort_order: 160
version: 5
is_published: true
---
# Gerenciar empresas e CNPJs

**Para que serve:** Gerenciar empresas e CNPJs, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.legal_entities`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Gerenciar empresas e CNPJs (`/finance/legal-entities`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Use Nova empresa para cadastrar razão social e demais identificadores.
2. Informe código, nome fantasia, CNPJ, IE, IM e situação ativa.
3. Edite ou defina a empresa padrão quando tiver autorização por registro.
4. No preenchimento de CNPJs, revise candidatos, escolha registros e valide os documentos antes de aplicar.
5. Busque por nome, código ou CNPJ e filtre Todas, Ativas ou Inativas.
6. Para desativar ou reativar, use o ícone de energia e confirme; os lançamentos e históricos são preservados.
7. Para excluir, revise vínculos e a confirmação. Havendo registros, a exclusão é bloqueada e é possível desativar em vez disso.
8. Em Nova empresa ou Editar, informe um CNPJ válido e clique em **Buscar dados do CNPJ**. Revise razão social, nome fantasia e endereço; confirme a substituição quando já houver dados. A consulta usa BrasilAPI, com ReceitaWS como alternativa, e não salva automaticamente.
9. Na seção **Endereço da empresa**, informe CEP, logradouro, número, complemento, bairro, cidade e UF. Ao sair de um CEP completo ou usar o botão de busca, o ViaCEP sugere logradouro, bairro, cidade e UF; número e complemento permanecem como informados.
10. Clique em **Salvar** e volte à revisão da minuta. Use **Preencher dados da proposta** novamente para incorporar o endereço atualizado; documentos já assinados não são modificados.

## Resultado esperado
Empresa cadastrada ou atualizada no workspace, com identificadores revisados.

## Regras e limites
- Razão social/nome é obrigatório.
- Empresa padrão é uma ação controlada, não autorização para administrar o workspace.
- Preenchimento de CNPJ exige revisão; não presuma correspondência automática correta.
- A empresa padrão não pode ser desativada ou excluída antes de escolher outra padrão ativa.
- Novas atribuições recusam CNPJs inativos ou de outro workspace; edições que mantêm o vínculo histórico continuam permitidas.
- Filtros históricos mostram também empresas inativas. Os totais são agregados no banco sob o acesso do usuário, sem truncar a lista de lançamentos.

- A consulta de vínculos também exige leitura da pessoa jurídica pelo escopo autorizado no workspace ativo. Membro inativo, outro workspace ou deny explícito não recebem contagens por acesso direto à API.

### Campos e controles
Código; razão social; nome fantasia; CNPJ; IE; IM; ativa.
Endereço: CEP; logradouro; número; complemento; bairro; cidade; UF. Buscar dados do CNPJ exige a mesma autorização de criação/edição do cadastro, incluindo membro ativo, workspace e deny. Campos ausentes na consulta não apagam informações já preenchidas.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.
Se a consulta por CNPJ/CEP falhar ou limitar acessos, tente novamente ou preencha manualmente; os dados atuais são preservados. Nome/CPF do representante legal são cadastrados no contato signatário, não obtidos pela consulta de CNPJ.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

![Tela: Gerenciar empresas e CNPJs](/help-media/finance/gerenciar-empresas.webp)
<!-- evidência: src/components/finance/legal-entities-page.tsx; src/components/finance/legal-entity-cnpj-fill-dialog.tsx -->
