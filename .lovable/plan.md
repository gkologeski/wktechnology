# Papel "Representante de Vendas (externa)" — acesso só ao que é dela

## O que verifiquei hoje
- Já existem os cargos Vendedor, Vendedor Interno e External Collaborator. Nenhum deles restringe a leitura ao que é da pessoa.
- **Ponto crítico:** no banco, Leads, Contatos, Empresas e Negócios podem ser lidos por qualquer membro do workspace. A regra do banco só checa o workspace, não o dono nem a permissão. Esconder registros só na tela não protege de verdade: alguém que trabalha para um concorrente poderia ler a carteira inteira pelo navegador ou por uma exportação. Esse papel só é seguro se o banco também restringir a leitura.
- Workflows disparados pelo que ela faz rodam com as permissões de quem publicou o fluxo (o admin), não com as dela. Isso já atende o pedido: ela não fica travada em outros módulos quando um workflow é disparado pelo usuário dela.

## Papel proposto: "Representante de Vendas (externa)"
**Módulo:** apenas TechSales. TechHire, TechPeople, TechContracts, TechFinance, TechProjects, Configurações, Relatórios gerais e Inbox de outras pessoas ficam ocultos e bloqueados no banco.

| Área | Ver | Criar | Editar | Excluir | Exportar |
|---|---|---|---|---|---|
| Leads | só os dela | sim | só os dela | só os criados por ela | não |
| Negócios | só os dela | sim | só os dela | só os criados por ela | não |
| Contatos / Empresas | os dela + os "vinculados" (abaixo) | sim | só os dela | só os criados por ela | não |
| Atividades (tarefas, ligações, e-mails, notas) | todas, nas entidades dela | sim | só as dela | só as dela | não |
| Cotações / propostas | só dos negócios dela | sim | rascunhos dela | não | não |
| Catálogo de produtos e preços | leitura | — | — | — | — |
| Dashboards | só os números dela | — | — | — | — |

"Dela" quer dizer que ela é a responsável ou a criadora do registro. **Exclusão:** só o que ela criou. Um registro em que ela é apenas a responsável, mas que foi criado por outra pessoa, ela não exclui.

## Visibilidade "vinculada" (o caso da empresa já existente)
Ela vê uma empresa ou um contato de outra pessoa só quando esse registro está ligado a um lead ou negócio dela. Mesmo assim, vê uma **ficha resumida**:
- **Visível:** nome, CNPJ, cidade/UF, setor, site, o responsável principal e os contatos da empresa (nome, cargo, e-mail, telefone).
- **Oculto:** outros negócios e valores, histórico de atividades de outros vendedores, notas, arquivos, faturamento e contratos.
- **Somente leitura:** ela não pode editar a ficha, só associar a empresa ao lead dela.
- **Busca ao criar um lead:** ao digitar o nome ou o CNPJ, o sistema informa "Empresa já cadastrada" e permite vincular sem abrir a lista completa. Isso evita duplicidade sem expor a carteira.

## Possibilidades que talvez você não tenha considerado
1. **Conflito de carteira (decidido: liberar):** ela pode criar o lead normalmente. A tela avisa que a empresa já tem outro vendedor, e o responsável da empresa recebe uma notificação.
2. **Descoberta por busca:** a busca global, o autocomplete e a checagem de duplicidade não podem listar registros de terceiros. Mostram só "já existe", sem detalhes.
3. **Saída de dados:** sem exportar, sem importar em massa, sem ações em massa sobre registros de outras pessoas. Opcional: marca d'água ou registro de auditoria de cada visualização de ficha vinculada.
4. **Comunicação:** o e-mail e o WhatsApp dela ficam separados. Ela não vê a Inbox nem as conversas da equipe, e os modelos de mensagem são só leitura.
5. **Preços e descontos (decidido: sem regra):** não haverá limite de desconto. Custos e margens continuam ocultos.
6. **Workflows:** ela não cria nem edita workflows. Os disparados por ela não devem enviar para ela (por e-mail ou notificação) dados de outros módulos.
7. **Comissão:** depende de o negócio estar registrado em nome dela. Isso reforça manter o "responsável" travado depois de ganho.
8. **Desligamento:** já coberto pelo fluxo de desligamento. Revoga o acesso e reatribui a carteira dela a um gestor, sem apagar o histórico.
9. **Acesso por tempo e horário:** opcional. Expiração do acesso alinhada ao fim do contrato, e alerta de login de local incomum.
10. **IA/Copilot:** as respostas devem respeitar as mesmas regras. Hoje é preciso confirmar se o Copilot consulta com as permissões do usuário ou com acesso amplo.

## Fases
1. **Proteção no banco (obrigatória):** as regras de leitura de Leads, Contatos, Empresas, Negócios, Atividades e Cotações passam a respeitar o escopo do papel: só os registros dela, os da equipe ou todos. Para todos os cargos atuais, nada muda, porque eles continuam com "todos". Só o novo papel fica com "só os dela + vinculados".
2. **Ficha vinculada resumida:** consulta própria, que devolve apenas os campos permitidos de empresas e contatos ligados aos registros dela.
3. **Cargo novo** "Representante de Vendas (externa)" com as permissões da tabela, e menu só com TechSales.
4. **Tela:** aviso de "empresa já cadastrada" (e de "outro vendedor", sem bloquear), ficha resumida com contatos, ações em massa e exportação ocultas.
5. **Validação:** teste no navegador com um usuário de teste nesse cargo, conferindo:
   - não vê registros de outras pessoas, nem pela busca;
   - cria um lead numa empresa existente e vê só a ficha resumida;
   - exclui só o que ela mesma criou;
   - um workflow disparado por ela cria registros em outros módulos sem erro;
   - os outros cargos continuam vendo tudo.

## Detalhes técnicos
- Hoje, `ws_select_companies` usa `workspace_id IN (current_user_workspaces())`. O mesmo padrão vale para leads/contacts/deals; vou confirmar cada tabela na fase 1. A nova política: `workspace_id IN (...) AND (user_data_scope() = 'workspace' OR assigned_to/created_by = auth.uid() OR (team) OR is_linked_to_my_records(...))`.
- O escopo vem de `job_roles.data_scope` (`own|team|workspace`). O novo cargo usa `own` mais um flag `linked_read`.
- A ficha resumida usa uma função `security definer` com projeção fixa de colunas, para não abrir a tabela inteira.
- Os workflows continuam rodando com o dono publicado (sem mudança). Vou auditar se algum passo envia dados ao usuário que disparou.
- Toda mudança de política vem com um teste por papel antes e depois: admin, vendedor atual e representante externa.
