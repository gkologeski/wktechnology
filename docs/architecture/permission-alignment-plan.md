# Alinhamento de autorização do TechERP

Iniciado por autorização do usuário em 23/10/2026. Abrange TechSales, TechHire,
TechPeople, TechContracts, TechProjects, TechFinance e áreas compartilhadas.
`techservice` é namespace legado, não um sétimo módulo.

## Fontes e estados

- `docs/security/permission-alignment.json`: decisões normativas das 32 regras
  levantadas e contratos explícitos das operações já tratadas.
- `docs/security/permission-route-inventory.csv`: 416 declarações de rota do
  inventário estático. Inclui layouts, APIs, retornos e redirecionamentos; não é
  contagem de telas distintas nem prova de enforcement.
- Código/SQL aplicados e testes de comportamento demonstram implementação;
  presença de uma chave em mapa/importação não demonstra autorização.
- Uma regra não fica concluída por código escrito. Distinguir preparado,
  testado, aplicado no banco, publicado e aceito no ambiente real.

## Decisão comum

Ator autenticado → membership ativo → workspace correto → permissão efetiva da
AÇÃO (deny prevalece) → escopo real da LINHA → proteção de CAMPOS → regras do
PROCESSO (alçada, estado, versões, período fechado, idempotência, consentimento).

Own é chave + vínculo de titularidade. Team é chave + equipe efetiva. Workspace
não ultrapassa tenant. Admin não é substituto genérico da ação e não deve anular
uma negativa explícita. Políticas permissivas se combinam por OR; a regra antiga
não pode continuar oferecendo uma alternativa que contorne a nova.

Exceções técnicas, pessoais, públicas por token, de plataforma e de serviço
precisam declarar identidade, alcance, validade e teste de negação. Não conceder
chaves novas a todos os cargos/workspaces como forma de fazer o teste passar.

## Sequência e estimativas iniciais

1. Matriz oficial incremental: inventário e sete contratos do primeiro lote
   registrados; ainda em andamento para as demais ações.
2. Riscos críticos: primeiro lote SQL (0191) aplicado e testado. Lote 0192 de configurações de pagamentos, NFS-e e reuniões aplicado, publicado e testado;
   evidências registradas no relatório do lote.
3. Servidor/RLS por módulo: priorizar TechPeople/TechHire, depois os demais;
   consolidar políticas, eliminar atalhos por owner/admin e escopos incorretos.
4. Interface e ações: menus/URL/abas/botões, projeção de campos, exportações,
   falhas de resolução e referências ausentes no catálogo.
5. Aceite dos cargos: permitido, sem chave, deny explícito, equipe/workspace
   diferente, inativo e URL/API direta. A sessão real de onboarding de Priscila
   não foi declarada validada pelos testes isolados.
6. Prevenção: checks automáticos da matriz e catálogo e cobertura obrigatória
   das novas funcionalidades na integração contínua.

Previsão inicial comunicada: primeira entrega em 60–90 minutos; conjunto em
3–5 dias de trabalho, dependente da quantidade de fluxos que precisarem ser
reconstruídos e do aceite real. São estimativas, não cronograma garantido nem
execução agendada em segundo plano. Cada nova frente exige sua própria previsão.

## Lote 0191 — aplicado

- Get entity field catalog é SECURITY INVOKER, autentica membro ativo no
  workspace selecionado e vincula p_owner_id ao ator. Service_role é exceção
  técnica explícita para filtros de campanhas. Retorna somente metadados e
  opções canônicas de enum/boolean, nunca amostras de linhas de negócio.
  Choices canônicos de pipelines/cadastros continuam no consumidor existente.
  Campos de texto sem cadastro canônico deixam de inferir opções por amostras.
- Anonimização nega ator NULL, inativo, workspace incorreto e View As somente
  leitura; exige compliance.delete.workspace E update de candidato em workspace
  ou próprio comprovado. Revoga consentimentos e registra auditoria atômica.
- Cinco helpers internos perdem EXECUTE para PUBLIC/anon/authenticated/API
  subject. Seus gatilhos SECURITY DEFINER preservam a execução como proprietário;
  service_role mantém o acesso de serviço.
- O teste do gatilho Silver Medalists revelou variável pool_id ambígua com
  plpgsql.variable_conflict=error. A variável local foi renomeada para v_pool_id,
  preservando a transição e ON CONFLICT. Correção necessária para validar o fluxo.

## Evidências e limites

101 verificações PostgreSQL passaram: 44 de RLS de RH, 15 de FK/salvamento e
42 de RPCs críticas. A fixture reproduziu as exposições anônimas antes da mudança
com dados sintéticos e rollback; depois confirmou bloqueios, escopos, denies,
registro de auditoria, recálculos de negócio/pagamento, seed de três modelos e
pool de recrutamento. Usa corpos reais selecionados dos helpers e triggers, mas
não é clone integral nem aceite de navegador/GoTrue/PostgREST.

Após aplicar, conferir EXECUTE, invoker/definer, hash da migração e hashes dos
overrides/memberships. Estes últimos permaneceram idênticos. Não houve publicação
de frontend: neste lote não há mudança de aplicação; a proteção SQL já está ativa.

Backups das definições/ACLs estão nos artefatos locais da auditoria. Em regressão,
priorizar correção progressiva ou contenção da porta afetada; nunca restaurar
EXECUTE anônimo para recuperar disponibilidade. Script de contenção:
`docs/security/0191-emergency-containment.sql` (não foi executado em produção).


## Lote 0192 — aplicado e publicado: configurações de pagamentos, NFS-e e reuniões

Seis chaves próprias (view/manage por recurso) no catálogo. Consultar exige view;
alterar exige view E manage; deny sempre prevalece. Nenhum grant de cargo/preset
é criado. A UI verifica a mesma chave para menu e URL, oferece leitura sem edição
e não monta o formulário em erro de autorização. Erro de carga impede gravação.
O servidor usa o cliente autenticado, seleciona o workspace do perfil e delega a
autorização às RPCs; não usa service_role para as seis operações de configuração.

As três colunas JSON de workspaces perderam SELECT/INSERT/UPDATE diretos para
PUBLIC/anon/authenticated/API subject. As demais colunas mantêm os privilégios
anteriores limitados pelas RLS existentes. Novas colunas de workspaces precisam
de concessão explícita por migração; consumidores devem selecionar apenas as
colunas necessárias, nunca SELECT *. A cobrança autorizada lê o gateway por
service_role como exceção interna; não concede reconfiguração ao operador.

As RPCs validam membro ativo, workspace selecionado, chave efetiva, View As de
leitura, campos permitidos, tipos e limites. Alterações registram ator, seção e
nomes dos campos alterados, sem copiar valores para o log. Save idempotente não
cria outro evento. RPC auxiliar não pode ser invocada diretamente pelo usuário.
Nenhum valor de configuração é alterado pela migração.

61 verificações novas de PostgreSQL (162 somadas às anteriores), 17 testes de
helper/UI e suíte completa passaram. Aceite SQL na base ativa passou (leitura/idempotência do owner, bloqueio de membro sem chave e acesso direto/fora do workspace). Aceite visual com sessão real ainda não
realizado. Estados de aplicação/publicação e hashes constam no relatório do lote.

Publicação confirmada em 23/10/2026 nos domínios app.wktechnology.com.br e
wktechnology.lovable.app, ambos com entrada /assets/index-CCqjsmv4.js. Os três
chunks de configurações publicados contêm o guard, os recursos específicos e o
bloqueio após falha de carga. Commit da aplicação: 628e207678de8fbc7607dcbe9996d88a54459aa9.
Hashes das três configurações e das tabelas de overrides, presets e memberships
permaneceram iguais aos da captura anterior. A aplicação de 0192 não alterou
valores existentes nem concedeu novas permissões a cargos de negócio.


## Etapa 3 — primeiro lote (0193)

Escopo: CRUD de pessoas e candidatos e modelos/planos/tarefas de onboarding e
offboarding. Aplicado e testado; publicação registrada nas evidências
do lote. Não conclui toda a etapa 3 nem o aceite de cargos da etapa 5.

- Quatro políticas permissivas por tabela substituem os caminhos antigos por
  owner/admin, simples membership e a ponte específica de cargo do onboarding.
  As políticas restritivas existentes continuam. Usa chaves efetivas de ação,
  membro ativo e workspace selecionado; não cria permissões nem grants de cargo.
- Own: perfil/responsável da pessoa ou responsável do candidato; planos usam
  responsável/perfil da pessoa, tarefas também reconhecem o executor. Team exige
  grupo do workspace ou gestor da pessoa (inclui manager_id armazenado como ID
  de pessoa com profile_id correspondente). Permissão team sozinha não basta.
- Plano exige pessoa consultável e relações de pessoa/template/plano no mesmo
  workspace; o modelo deve ter o mesmo tipo (admissão/desligamento). Não é
  possível mover registros para outro tenant, trocar a pessoa/tipo do plano ou
  mover tarefa para outro plano. Executor com chave own pode atualizar andamento
  da tarefa, sem reconfigurá-la ou atribuir a conclusão a outra pessoa.
- Servidor separa create de update, usa a verificação SQL por registro, não usa
  privilégio administrativo como fallback e verifica se a edição afetou linha.
  Promoção de candidato exige leitura dele e criação de pessoa; o tenant vem do
  workspace selecionado, não da autoria do candidato. Arquivar exige update.
- Plano e tarefas são criados em uma RPC SECURITY INVOKER transacional. Falha
  numa tarefa desfaz o conjunto. Automação usa workspace_id real da pessoa e
  lock transacional com reaproveitamento de plano existente. Modelos continuam
  selecionados pela regra atual de cargo/tipo de contratação.
- Escrita de pessoa informa explicitamente workspace, autoria e responsável;
  o trigger normaliza workspace copiado para responsável apenas em nova pessoa.
  Não altera defaults nem reescreve registros históricos. Serviços internos
  conservam o acesso já existente como exceção técnica explícita.

112 verificações novas de PostgreSQL e 162 anteriores passaram (274). A suíte
completa passou com 1.534 testes (19 novos), incluindo handlers executados e
contratos de isolamento entre módulos. A fixture reproduz o bypass anterior de
candidatos, mas não é clone integral nem aceite real de navegador/GoTrue.

Continuam pendentes: dados sensíveis e seus campos, helpers de avaliações/metas,
políticas de vagas, LGPD por escopo, documentos/benefícios/alocações/incidentes e
restante dos módulos. A implementação não declara essas lacunas resolvidas.

Aceite SQL na base ativa usando auth.uid de Priscila passou: gravar e editar
pessoa, criar onboarding/offboarding e tarefa, concluir tarefa e excluir registros
de teste; registro inexistente e ator sem membership foram negados. A transação
inteira terminou em rollback. Não foi utilizada uma sessão real do navegador.
