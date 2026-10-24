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

A resposta de liveness já pública (/api/public/health/) inclui o header estático
X-TechERP-Access-Revision: hr-actions-0193 para confirmar a revisão do servidor.
É uma exceção operacional pública: continua sem autenticação, consulta de dados
de negócio, credenciais ou PII. Não concede acesso a ações de RH. A confirmação
pelo header não substitui o aceite real no navegador.

Publicação do lote 0193 informada pelo usuário em 23/10/2026. O projeto já
está sincronizado com 45f813981a0558a54901909c24bfe4cdb2b319ef, informa
is_published=true e contém o marcador de revisão no código. A liveness pública
responde HTTP 200/status ok em ambos os domínios. O header de revisão não foi
observado na resposta pública: a confirmação de publicação se baseia no relato
humano e no estado do projeto, não em comprovação independente da revisão servida.

O bloqueio anterior (queue_paused/server_error) fica registrado como histórico
da tentativa anterior. Não é mantido como bloqueio atual com base em informação
antiga. As regras 15/21/26 e os 20 contratos deste lote passam a aplicado,
publicado conforme confirmação do usuário e testado SQL. O aceite funcional no
navegador permanece pendente; o restante da etapa 3 continua aberto.


## Etapa 4 — primeiro lote (0194)

Escopo deste lote: menus/URLs de pessoas, candidatos, onboarding, offboarding e
modelos; ações dos cadastros principais de pessoa/candidato e checklists.
Não conclui toda a etapa 4 nem as frentes restantes de servidor/RLS da etapa 3.

- `HrScreenAccess` barra o carregamento por URL sem view efetivo, durante carga,
  falha da resolução ou ausência de workspace. `HrRecordAccess` exige também o
  predicado de leitura da linha. Menu de desligamento deixa de reutilizar a chave
  de admissão; os cinco menus deste lote não usam fallback por cargo/admin.
- `hr_record_capabilities` consulta os predicados já aplicados em 0193. Retorna
  somente booleanos do próprio chamador, até 200 UUIDs por chamada. Não aceita
  outro usuário/workspace nem abre acesso a linhas. SECURITY INVOKER e EXECUTE
  apenas authenticated; helper não concede permissões aos cargos.
- Criação exige create (não update); edição/exclusão consultam a linha. Seleção
  múltipla só oferece ação quando todos os selecionados permitem a ação. Kanban
  de pessoas verifica cada card; candidato só pode ser arrastado se puder editar.
- Plano: criar, alterar andamento, excluir e criar tarefas são independentes.
  Tipo admissão/desligamento só aparece com as respectivas chaves. Troca do tipo
  limpa o modelo anterior. Executor pode alterar andamento da tarefa, mas editar
  configurações exige update do plano e exclusão usa sua própria permissão.
- Cache de dados tocados e capacidades inclui workspace; formulários são
  desmontados na troca de workspace/registro. Falhas não são apresentadas como
  lista vazia ou carregamento infinito. Não cria nova entrada de data/telefone/
  e-mail; preserva os componentes de validação já existentes.

Validação: 15 cenários SQL novos + 274 anteriores (289); 25 testes novos de
interface/menu/borda + suíte integral (1.559). O gate verify passou. Teste SQL
no banco ativo confirmou Priscila/Head RH lendo e editando por capacidades,
registro ausente e não membro negados e anon sem EXECUTE. Não emite sessão de
usuário: isso é simulação de identidade SQL, não aceite no navegador. Hashes de
186 pessoas, 14 candidatos, quatro planos, tarefas/modelos vazios, 927 overrides,
6.653 presets e 244 memberships preservados. Migração 0194 aplicada.

Permanecem fora deste lote: granularidade por linha/ação das demais abas da
ficha (documentos, metas, 1:1, avaliações, alocações, benefícios, psicossocial,
incidentes), ações de comunicação/pools/vagas/LGPD do candidato e demais módulos.
Não interpretar a proteção de perfil/onboarding como aceite desses painéis.
Aceite funcional real com sessão autenticada continua pendente (etapa 5).
Estado final de build/sincronização/publicação fica nas evidências deste lote.


## Continuação integral solicitada — lote 0195 em preparação

O usuário autorizou concluir todas as pendências em 23/10/2026. Não reduzir o
objetivo a este lote: as 32 regras e seis etapas continuam sendo o controle de
conclusão. Estimativa comunicada: conjunto em 3–5 dias; próximo lote 90–150 min.

0195 trata documentos, benefícios, alocações/rateios, metas, 1:1, avaliações,
psicossocial, incidentes e eventos. Servidor e banco verificam recurso/ação/linha;
a criação é vinculada à pessoa e não decorre de update. Novas escritas informam
workspace explicitamente. Sem alteração de defaults. Autoria/tenant/pessoa são
imutáveis; rateios precisam de empresa no mesmo workspace. Eventos de auditoria
não recebem mutações de usuários comuns. Modelos de campo sensível ainda serão
tratados separadamente: não declarar a regra 24 concluída por este lote.

Os painéis de pessoa deixam de usar people.update ou can_view_person_sensitive
como autorização genérica para as outras abas. Cada botão de criar/editar/excluir
usa a capacidade do respectivo recurso/linha. Arquivos: upload novo exige criar
no alvo; substituição exige editar o documento e o mesmo person_id; download
verifica leitura do documento antes do uso do assinador privilegiado.

A falha geral de consultas de módulo/licença foi identificada e corrigida no
código: ausência de dados, erro e carga não significam unrestricted. Falhas de
permissão em cache também deixam de habilitar botões Can. Consulta privilegiada
de licença só ocorre após membership ativa no workspace selecionado.

Validação técnica e aplicação/publicação serão registradas por lote nas
evidências. O Docker local estava sem resposta e a aplicação/auth local estavam
paradas; abrir Docker Desktop foi tentado. Isso não impede as correções e testes
SQL/servidor, mas não deve ser contado como aceite de navegador.


### Revisão e correções do lote 0195

Migração 0195 aplicada. A checagem ativa revelou que o gatilho compartilhado
sync_responsible copia o owner legado (workspace) para assigned_to. O teste
isolado mínimo ainda não incluía esse gatilho. A fixture foi corrigida para
reproduzi-lo e a migração progressiva 0196 normaliza apenas esse caso determinístico
no INSERT para o usuário real. O arquivo 0195 aplicado não foi alterado. Novas
escritas do servidor também informam o responsável onde a coluna existe.

Depois da correção, 21 operações SQL de criar/editar/excluir em sete recursos
foram aprovadas com auth.uid de Priscila e ROLE authenticated na base ativa.
Tudo terminou com rollback. Não equivale a sessão real de navegador.

112 novos cenários de filhos + 289 anteriores = 401 verificações SQL; o gatilho
legado é reproduzido antes da correção. 219 casos de capacidades comparam os
resultados do caminho otimizado e dos predicados canônicos para filhos, pais,
pessoas, candidatos, modelos, planos/tarefas, outra empresa, IDs ausentes,
usuário comum com deny e Ver como somente leitura.

O ensaio de 200 documentos revelou 11.846,70 ms para o cálculo por linha. A
migração 0197 carrega uma vez as chaves efetivas do chamador e aplica o caminho
constante apenas quando as permissões workspace bastam para decidir as ações;
misturas de own/team conservam o predicado canônico. Valida membro ativo,
workspace selecionado, existência e vínculos antes de retornar somente booleanos.
Depois da correção, o mesmo ensaio retornou 200 linhas permitidas em 52,69 ms.
É uma medição dessa RPC, não de toda a aplicação. Sem novos grants por essa
migração. A autorização de dados continua independente no servidor/RLS.

Próximas frentes ainda obrigatórias: dados sensíveis (0198+; implantação em duas
fases para não quebrar os SELECTs existentes), restante de TechHire e módulos,
contratos de todas as URLs/ações, prevenção em CI e aceite de navegador. A ordem
das frentes pode mudar para resolver bloqueios ou regressões encontradas nos
testes, sem reduzir o objetivo de concluir as seis etapas.


### Publicação 0195–0197 e próxima frente de dados privados

O commit 01b9f30d3 foi integrado ao main e publicado. Ambos os domínios servem
index-C7zHbZrV.js; entry, ficha de pessoa, módulo e guard HR conferidos byte a byte
com o build testado. Verify (typecheck/lint/1588 testes) e build completos, com
mesmo source_hash e source_changed=false. Aceite de navegador continua pendente:
usuário informou Docker Desktop fechado ou sem iniciar.

0198/0199 estão em validação técnica, ainda não aplicados neste registro.
0198 prepara a RPC hr_private_fields e 18 chaves independentes de view/update
own/team/workspace para people_sensitive, one_on_ones_private e
allocations_financial. Somente o Head RH da WK recebe overrides conforme
solicitação prévia; defaults, outros cargos/workspaces e denies preservados.

Novos leitores projetam somente colunas públicas e compõem dados privados via
RPC limitada a 200 IDs. Novos gravadores preservam campos omitidos e valores
ocultos em branco, rejeitando mudanças privadas sem autorização. UI diferencia
leitura e edição privada. Relatórios não tratam custo oculto como zero.
Importação em lote exige todas as operações envolvidas e utiliza o cliente do
usuário para dados; storage elevado recebe checagem do documento/pessoa antes.
Folha exige acesso a custos/benefícios e view/create/update de recorrências
financeiras, sem estender permissões financeiras ao Head RH por consequência.

A ativação 0199 é posterior à publicação dos consumidores de 0198. Ela habilita
os gatilhos para INSERT/UPDATE com alteração privada, muda o wrapper legado
can_view_person_sensitive para a nova chave e retira SELECT direto das colunas
privadas e da view legada people_total_cost. Serviços internos sem JWT são uma
exceção explícita. O catálogo e suas políticas globais de hidden/masked/readonly
continuam sendo outra frente; este lote não representa a conclusão da regra 5.


0198 aplicada (hash d5c9acd07e9b5168d4f1033749b2e8228f7bbdf635071ffd88066aaa87c3519b;
journal when 1792795456235, id 202). As duas primeiras tentativas foram
rejeitadas e revertidas: terminador da definição legada copiada e INSERT SELECT
text para enums perm_action/perm_scope. O teste foi ajustado para composição de
múltiplas instruções e tipos exatos do catálogo ativo. Nenhuma alteração parcial
persistiu. Depois da correção, verify 1597 testes e build completos no mesmo
fingerprint, sem alteração de fontes durante os gates.

A simulação SQL de identidade da Priscila retornou view/update privados para
as 186 pessoas visíveis. Isso confirma o cálculo de capacidades, não é uma
operação de edição nem aceite de navegador. Contagens e fingerprints de dados,
defaults, memberships, outros overrides e denies preservados; somente catálogo
e Head RH da WK receberam as 18 chaves planejadas (1703→1721 e 546→564).
Consumidores ainda precisam publicar; ativação 0199 continua bloqueada até a
verificação da publicação, conforme a ordem técnica deste rollout.


### Ativação 0199 de dados privados

Consumidores do commit ab1c5fe128423f730818e8ec7e56f2423e3a61e2 publicados em
ambos os domínios, entry index-BXZ35Hoh.js e ficha people._id-DhImt435.js
conferidos byte a byte com o build testado. Só depois dessa prova foi aplicada
0199 (hash d1cf1af3670566f35a65ac54ca1e66226f70b0126fc2167f44e325d10f4d6109,
when 1792797293002, id 203).

Três gatilhos privados ativos. Leitura direta de bank, private_notes e cost_rate
pela role authenticated retorna sem privilégio, inclusive para Head RH; leitura
permitida passa pela RPC com as chaves individuais. A simulação SQL de Priscila
criou e editou uma pessoa sintética com dados fictícios, confirmou leitura privada
pela RPC, negou SELECT direto e confirmou campos públicos acessíveis. Identidade
sem membership não leu nem editou. Transação integralmente revertida, zero pessoas
sintéticas remanescentes. Não equivale a sessão real de navegador.

RPC privada: 186 linhas em 49,16 ms (medição só da RPC). O primeiro ensaio de
1730,81 ms incluía a consulta dos IDs sob RLS; não deve ser interpretado como
latência da RPC. Os 18 novos grants estão apenas no Head RH da WK. A matriz geral
de hidden/masked/readonly, outras ações/módulos e o aceite no navegador seguem
frentes pendentes do plano de seis etapas.


### Próxima frente: vagas do TechHire (0200, preparada)

Estimativa comunicada: 2–3 horas. O lote alinha CRUD e helper can_access_ats_job
à ação efetiva e vínculo real de owner/responsável/gestor/recrutador ou grupo do
workspace. Remove políticas permissivas de owner/membership, preserva fences
restritivas e valida o registro antigo antes de permitir edição. Workspace e
autoria são imutáveis; responsável continua editável conforme update efetiva.
Publicação exige sua chave específica. Sem novos grants ou alterações de defaults.

UI de URL direta e ações usam as mesmas capacidades. O campo legado Proprietário
da vaga passa a exibir Criado por sem edição, coerente com a autoria já documentada
no gravador; o Responsável usa a permissão de edição real. Configuração LinkedIn
deixa de gravar com admin após simples leitura. Copiloto não usa fallback admin e
exige leitura da vaga e view/create do próprio recurso. Exportações do servidor
exigem chaves de export, incluindo candidatos quando contêm seus dados pessoais.

O estado persistido de publicação em provedores torna-se somente leitura para
APIs de usuário: alterações só pelos handlers guardados ou worker interno assinado.
Os novos upserts informam workspace explicitamente e falhas do provedor não viram
sucesso. A conta de integração, publisher e os demais gravadores de importação
continuam uma frente própria da regra 9; este lote não os certifica.

Listar vagas em modo somente leitura não cria/promove pipeline. O catálogo de
pipelines usado no board/picker é uma exceção explícita de metadados compartilhados
do workspace, autorizada por pipelines.view ou jobs.view. Criação/promoção exige
separadamente create/update de pipelines. O CRUD/RLS completo de pipelines ainda
deve ser auditado. Vagas/pipelines/notificações criados pelo workflow usam
ctx.workspaceId do registro de origem. API pública por chave continua uma exceção
a auditar: tenant fixado na chave, feature flag e contrato de status precisam
revisão separada; não é validação de navegador.

11 grupos SQL de vagas, incluindo reprodução prévia do bypass e da negativa
indevida ao Head, passaram. Foram repetidas as equivalências de capacidades de RH
após estender os helpers. 26 testes de handlers + 3 de origem de workspace do
workflow passaram; tipos sem erro. Aplicação, publicação e gates completos ainda
precisam ser registrados.


0200 aplicada (hash 4b465b491183ba8286356cd77463ab22badc24a145c387af4060fe4af14fa22d,
when 1792799590341, id 204). Verify 1626 testes/tipos/lint e build completos no
mesmo fingerprint, sem mudança de fonte durante os gates. Simulação SQL de
Priscila confirmou criar/ler/editar/excluir uma vaga sintética em rascunho e as
capacidades correspondentes; mudança de autoria negada; usuário não membro sem
leitura. Estado de provedor não editável diretamente por authenticated, inclusive
Head; serviço preservado. Rollback integral e zero vagas sintéticas restantes.

Contagens/fingerprints de vagas (5), publicações (4), pipeline (1), defaults
(6653), memberships (244), overrides (971) e catálogo (1721) permaneceram idênticos.
Nenhum grant novo neste lote. Interface ainda precisa ser publicada e conferida;
aceite com sessão real no navegador permanece pendente do ambiente.


### Funis do TechHire (0201)

Estimativa comunicada: 1–2 horas. Remove bypass de membership/owner/admin
no CRUD dos pipelines; ações independentes por registro e escopo real, selected
workspace e membro ativo. Autoria e workspace imutáveis. Definir ou retirar
padrão exige update.workspace, pois pode alterar outra linha do workspace.
Gatilho protege exclusão do padrão e de funis vinculados a vagas, inclusive
quando a vaga não é visível ao solicitante. Defaults/grants existentes preservados.

Catálogo compartilhado usado pelas vagas permanece exceção somente leitura;
/pipelines e ações de edição exigem permissões próprias. Tela não cria/promove
funis sem as chaves necessárias; criação de cópia não é sobrescrita pela seleção
automática. Testes SQL cobrem own, team, workspace, deny, inativo, outro tenant,
ViewAs, padrão, vínculos e equivalência das capacidades. Aceite autenticado no
navegador segue dependente do ambiente local.


Publicação 0200 confirmada: commit c666c7b44f2fd206b47adefc716c206012078605
entregue nos dois domínios, entry index-BzS7WDJV.js e chunks de vagas/listagem/
capacidades conferidos byte a byte contra o build testado. Não substitui o aceite
autenticado em navegador; este continua pendente. A consulta SQL de Priscila
confirmou leitura das cinco vagas (uma de outro criador) e quatro publicações.

0201 aplicada: hash 2c5180d1f0ecd443578aeb6996ecd3d58a29f98cce703d9300fea6acb5e5a0e1,
when 1792800721831, id 205. Verify com 1634 testes, tipos/lint e build completos
no mesmo fingerprint c95c8b543e7a919e5671add95ca88f5c63ccb2c6f1e804e2410197c681513614,
sem mudança de fonte. Dez grupos SQL de funis e regressões de vagas/capacidades
aprovados. Simulação SQL de Priscila confirmou CRUD sintético e acesso ao funil
de outro criador, autoria imutável e não membro sem leitura. Rollback integral,
zero resíduos. Pipeline existente/defaults/overrides/memberships/catálogo intactos.
O construtor da primeira vaga cria funil sem promover padrão quando só possui
create; o teste dessa borda também passou. Interface aguarda publicação.


Publicação 0201 confirmada no commit b9422963b409fdda28c83075dece2c7e0b121f57,
entry index-DTLzrL_v.js e chunks de funis/capacidades conferidos byte a byte nos
dois domínios. Aceite autenticado no navegador continua pendente do Docker.

### Candidaturas e timeline (0202, preparada)

Estimativa comunicada: 2–3 horas. Candidatura é parte do agregado de candidato: usa
as chaves existentes de candidatos, sem novo catálogo/grants, mas exige leitura
do candidato E da vaga. Remove bypass de membership/owner. Create separado de
update, atribuição requer assign; autoria, workspace e pais imutáveis. Relações
de grupo reais no escopo team. Cascatas de exclusão seguem o pai já autorizado.

Timeline deixa de ser leitura geral de workspace. Exige candidatura visível, pais
consistentes e ator real; anexação por ação específica, sem UPDATE/DELETE de
usuário. Serviços confiáveis mantêm logs. A timeline ainda registra ações de
serviço/aplicação; não se declara prova forense de toda transição de negócio.

UI de arrastar e ações em massa usa capacidade por registro, exportação exige
chave própria e avaliação sua chave de score. Quadro usa etapas configuradas,
com bucket visual de compatibilidade para etapas históricas, sem regravar dados.
Portal público usa workspace para vagas e branding, exige módulo habilitado e
vaga publicada; mantém o portal padrão legado no host compartilhado. Repetir
candidatura não reabre nem sobrescreve processo; novas escritas e intake stage
usam o tenant/pipeline reais. Worker LinkedIn também usa esse tenant e não escolhe
candidato ambíguo; erro preserva página para retry sem fingir sucesso. Conta e
publisher da integração continuam na frente da regra 9.

13 grupos SQL de candidaturas/timeline passaram, incluindo autoria, ambos os
pais, own/team, deny/inativo/ViewAs, metadados e cascatas com workspace legado
nulo. A fixture preservou inclusive o deny de update.workspace do Head deixado
por um teste anterior; o novo caso usa uma linha efetivamente editável. Em
produção, as 12 chaves de candidatos da Priscila foram conferidas como permitidas.
Entrevistas, respostas de avaliação, alçadas de contratação/ofertas e regras
globais de campo/API seguem contratos posteriores, ainda não concluídos.

0202 aplicada: hash 31fdfbd79e31ea5cb035de7e1ec0744c21aa1d9ea09b22cf62e9098c7d099247,
when 1792802324945, id 206. Verify: 1647 testes/tipos/lint e build completos no
mesmo fingerprint 393fd8d1fe4faa54c0aaca5d729f4aac2e2e188bde54437c679a4d5bfcf05ccd,
sem mudança de fonte. Simulação SQL de Priscila confirmou cinco candidaturas
reais legíveis e editáveis; todas são de sua autoria, portanto o teste de edição
de outro criador foi feito com dados sintéticos em transação revertida. CRUD
próprio e de outro criador, capacidade por registro, autoria imutável, timeline
anexada e sem edição, cascata e não membro sem leitura passaram. Zero resíduos.
Candidatos (14), candidaturas (5), eventos (13), seus fingerprints, catálogo (1721),
memberships, defaults e overrides preservados. Interface aguarda publicação.


Publicação 0202 confirmada no commit 9a62553f85ba911c068b82da8da9f3c471f79b5c.
Entry index-i-5wxdCI.js e chunks de vaga, carreiras e capacidades conferidos byte
a byte nos dois domínios. Aceite autenticado no navegador segue pendente.

### Entrevistas, respostas e anotações de IA (0203, aplicada e publicada)

Estimativa comunicada: 90–150 minutos. Entrevistas exigem leitura da candidatura
real e chave própria de visualização; agendamento e pontuação são independentes.
Remove gates antigos que usavam owner_id como workspace e atalhos de membership.
Pais, autoria, workspace e avaliador imutáveis. Participantes, kit, pool, reunião
e referência de reagendamento pertencem ao tenant e contexto corretos. Cancelar
substitui DELETE direto de histórico; cascata do pai já autorizado é preservada.
Modelos com respostas não podem apagar histórico por cascata de exclusão do modelo;
devem ser desativados. CRUD de modelos e kits segue a próxima frente.

Resposta usa score, sem herdar edição do candidato. Total ponderado é calculado
no banco, com critérios conhecidos, notas 0–5 e modelo ligado à vaga correta.
Edição de resposta de outro criador preserva seu avaliador. Campos de análise de
IA exigem score e view/create de copiloto; transcrição humana usa score. UI nega
por registro/erro/carregamento/ViewAs antes de montar formulário e seus loaders.
Notetaker protege URL e usa provedor do workspace; não exige chave global da
Lovable quando outro provedor está configurado e não inventa ai_model. Gerar
anotações emite notes_generated; completed só na transição real para done.

As duas portas públicas de autoagendamento verificam token, validade e horário
ofertado futuro. Atualização condicional por token e pending_candidate admite
apenas um vencedor concorrente e só então registra sucesso/evento. Isso protege
a mesma convocação; não é certificação de disponibilidade cruzada de todas as
agendas. Calendário/slots/pools e integrações ainda precisam dos contratos próprios.
A porta legada usa kind video válido, tenant do pai e expiração de sete dias.

Treze grupos SQL e regressões anteriores passaram, incluindo 200 metadados iguais
às regras canônicas, mistura de escopos e ações, autoria, denies, inativo, ViewAs,
modelos/pais de outro tenant e cascatas. Caminho amplo valida todos os pais e
reaproveita chaves efetivas; own/team misto permanece na referência canônica.
Não é medição de desempenho geral nem aceite de navegador/provedor real.

0203 aplicada: hash 47412b87ca8bb00c7bd366048a3ef127701fddf3a9f581bc02677f13d44bd413,
when 1792804741329, id 207. Verify: 1672 testes/tipos/lint e build completos no
mesmo fingerprint 07a1eb6f248431b1e172a51eed42e2592ae6c221beb32429aa7ecab0eea11477,
sem mudança de fonte. A revisão final também oculta dados antigos após negativa
de acesso, limpa leituras com erro e impede uma resposta lenta de outra entrevista
de preencher a seleção atual. A limpeza global existente por troca de identidade
foi conferida e preservada.

Simulação SQL de Priscila confirmou criar entrevista/avaliação, editar as de outro
criador, preservar avaliador/autoria, calcular 3,67 a partir dos critérios, negar
DELETE de histórico, consultar capacidades e manter cascata de exclusão do pai.
Não membro sem leitura. Transação revertida, zero resíduos. Nenhum convite, email,
chamada de IA ou provider externo foi executado por esse ensaio. Sem entrevistas
ou respostas reais anteriores (ambos zero); modelo existente (1), seus dados,
catálogo (1721), defaults, memberships e overrides permaneceram intactos.
Metadados de 200 registros no teste isolado: referência canônica 1942,606 ms,
lote 12,229 ms com resultados iguais; não é medição do ERP em produção.
Publicação confirmada no commit 2812408acc33297f96bcf560e3a07514d9fef5e1.
Entry index-Dmydshuk.js e os chunks de vaga, notetaker, autoagendamento e
capacidades foram conferidos byte a byte nos dois domínios públicos.
Aceite no navegador com sessão real permanece pendente.

### Etapa 5 — ambiente recuperado e primeiro aceite autenticado de RH

Docker Desktop recuperado após encerramento normal e SIGTERM não resolverem um
backend antigo travado. Não havia VM ativa; foi necessário encerrar apenas esse
backend e reabrir o aplicativo. Engine 29.8.2 voltou a responder, sem exclusão de
volumes. O ambiente anterior foi preservado.

Uma segunda stack local, techerp-permissions-20261023, usa API 127.0.0.1:54521
e cópia descartável da aplicação na porta 5175. Estrutura extraída do catálogo
atual: 418 tabelas, 2230 políticas, 506 funções; catálogos globais de 1721 chaves
e sete namespaces de módulos (inclui namespace legado). Nenhum dado de cliente,
segredo ou sessão de produção foi importado. Ações HTTP externas/cron ficaram
inertes; as contas e registros são sintéticos. A extração não foi feita pela
reaplicação do histórico de migrations.

Nove testes com login real do GoTrue, JWT e SDK/PostgREST passaram: Head RH
fictício como membro sem admin, criação/edição de pessoa, criação/edição de plano,
bloqueios de usuário sem chave, membro inativo e outro workspace, e limpeza com
cascata. O perfil fictício recebe todas as chaves TechPeople/TechHire apenas no
tenant de teste; não é uma reprodução integral dos grants ou da sessão da
Priscila em produção.

Chrome em perfil temporário confirmou cadastro de pessoa e onboarding pela UI,
persistência após recarregar, negação de tela sem chave de RH e negação da ficha
para administrador de outro workspace, sem montar formulário de edição. Nenhum
pageerror no fluxo positivo. As tentativas anteriores do roteiro foram corrigidas
para aguardar hidratação, aceitar os parâmetros da URL, tolerar redirecionamentos
e usar o link Abrir da linha; não foram contadas como aceites aprovados.

Todos os registros de pessoa/onboarding desses ensaios foram removidos via
sessão autenticada local. Nenhum convite, chamada de IA ou integração externa
foi acionado. Evidências e prints no relatório local
outputs/permission-alignment-completion-2026-10-23/aceite-rh-ambiente-recuperado.html
(no diretório do projeto ChatGPT; não no repositório).

Este lote remove o bloqueio de infraestrutura e aprova esses caminhos locais.
Não conclui o aceite de todos os cargos/ações, a sessão real de Priscila em
produção nem as demais frentes de servidor, interface e CI do plano.


### Modelos, kits, pools e disponibilidade (0204–0205)

Estimativa comunicada: 2–4 horas. Fronteira inclui banco, servidor, ações de UI,
uso de metadados de agenda e preservação do histórico. Em validação final;
aplicação/publicação serão registradas após os respectivos comprovantes.

Administração de scorecards e kits reutiliza suas chaves CRUD existentes. Pools
de entrevistadores e janelas semanais recebem vinte chaves específicas (não se
confundem com pools de sourcing nem com a permissão ampla de scheduling). Grants
novos só para Head RH da WK, ON CONFLICT DO NOTHING preservando denies. Nenhum
preset ou override de outro cargo/workspace é modificado. Administração por own
usa criador; janela própria usa entrevistador real, nunca o criador intermediário.
Team exige grupo real no tenant. Tenant, autoria e vínculos de membros são imutáveis.

O catálogo de uso é exceção só de leitura: view+schedule de entrevistas permite
usar kits, pools e disponibilidade; view+score permite ler critérios de avaliação.
Isso não concede administração nem leitura de candidatos/entrevistas. Páginas de
administração exigem view próprio do recurso e botões consultam a ação por linha.
Scheduling mantém o acesso de tela legado, mas não transforma scheduling.view em
CRUD dos novos recursos. Falha/alteração de permissão limpa ou remonta a tela;
URL direta é protegida antes de montar carregadores e formulários.

Critérios de modelo com respostas e perguntas de kit com entrevistas não podem
ser reescritos/excluídos: há duplicação para nova versão e desativação para novos
usos, preservando o histórico. Novas respostas/entrevistas bloqueiam o modelo em
leitura para serializar contra alteração concorrente. Kit padrão é salvo em RPC
invoker transacional; mudar o padrão exige view/update.workspace, usa lock do
contexto e valida unicidade mesmo por SQL direto. Falha não desmarca o anterior.

Consultas de agenda retornam apenas entrevistador e intervalos ocupados limitados
ao período, incluindo painéis e entrevistas de candidatos invisíveis ao agendador.
Sem nomes, notas, IDs de entrevistas ou candidatos. Alvos precisam ser membros
ativos do tenant; período máximo31dias, máximo8pessoas. Janelas recorrentes usam
fuso IANA real e intervalo UTC; erro de leitura nunca vira disponibilidade livre.
Rotação usa lock no pool e atestação protegida por transação, sem GUC forjável.
Reservas por qualquer porta, inclusive confirmação por token público, serializam
no painel real e rejeitam sobreposição com mensagem sem dados de outro candidato.
Não consulta calendários externos: a disponibilidade deste contrato é das
entrevistas e janelas mantidas no TechHire.

Testes locais: 17 novos testes de servidor/fuso; 8 grupos SQL de configuração,
regressões anteriores e 219 comparações de capacidades preservadas; 17 grupos
com GoTrue/JWT/PostgREST reais, incluindo concorrência de rotação e de reserva,
modelo usado, default atômico e agenda sem PII. Chrome: Head RH não admin cria
modelo/kit/pool e desativa modelo; agendador abre agenda sem criar pool nem
administrar scorecards/kits por URL. Fixtures removidas. A revisão final completa
os gates com o mesmo fingerprint antes de aplicar/publicar.

0204 e 0205 aplicadas em transação única, ids 208 e 209, when 1792842993108 e
1792842993109. Hashes 325d025ab28973f6c0929f2f32dab72f8567902a4bc30ec12214d20c1e08bbb5
e 3b2ad5a0257e02e9f4b706f79761cd1e1fa2537a3c74cc074e07ba426b5fc611.
Verify: 1689 testes, tipos e lint; build completo; mesmo source_hash
944dcb1db55c7c0e843c23493059d2d43f983ed1ec78afb60566ccad6e24ae3c,
source_changed=false. Publicação da interface ainda será conferida.
