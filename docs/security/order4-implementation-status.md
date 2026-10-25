# Ordem 4 — TechSales e integrações

Status: EM IMPLEMENTAÇÃO. Não aplicada nem publicada em produção.
Não tratar as migrações 0222/0223 como prontas para implantação: há fluxos pendentes abaixo.

## Preparado e validado localmente

- Catálogo e políticas de 108 tabelas comerciais/configurações; referências por pai, workspace selecionado e membership ativo, responsabilidade atual, own/team/workspace, deny e restrições de View As preservadas.
- Gates iniciais em 340 operações do servidor. Este número mede preparação, não revisão funcional completa de cada operação.
- Clientes de usuário com projeções sem tokens privados; ACL de coluna é a proteção efetiva no banco.
- API v1 de leads/contatos/negócios/reuniões executa por port NOLOGIN/NOBYPASSRLS, intersectando a chave com os direitos atuais do proprietário e workspace de origem protegido.
- Aprovação de propostas por revisor explícito, sem autoaprovação; versão revisada invalidada ao editar; envio exige autorização, selo/hash/data do servidor; resposta pública atômica e sem replay.
- Compartilhamento usa operações finitas sob role NOLOGIN/NOBYPASSRLS, sem devolver tokens nas listagens. Configuração de credenciais por ports restritos.
- Workers de WhatsApp/e-mail, sequências e SDR revalidam fonte/responsável/destinatários. Respostas SDR continuam independentes de quotas comerciais.
- OAuth Google revalida o direito atual antes da troca e novamente na gravação atômica das credenciais; origem vem do state assinado, sem mudar de workspace por preferência posterior.
- RPCs legados de busca/visibilidade/carteira/vinculação/atribuição alinhados ao chamador/RLS; seed de perfis protegido por gestão de usuários ativa. Referência mínima de empresa em outra carteira exige chave explícita.
- Vínculo por domínio considera o workspace, registros visíveis e correspondência única. O trigger de entrada também não escolhe empresa ambígua.
- Propostas/cotações possuem gates por ação nas telas revisadas; importação DOCX exige criação de proposta e conversão para contrato exige criação de contrato.

## Evidência

- 119 testes reais GoTrue/PostgREST: CRM/RPCs/anônimo 51, API 21, propostas 26, workers/OAuth 21.
- Ensaios completos das migrações em banco descartável com ROLLBACK; nunca replay do histórico.
- Verificação completa anterior: 1.736 testes de código, TypeScript e lint sem erros. Deve ser repetida após qualquer mudança; confiar no hash atual dos arquivos `.verification`.
- Aceite visual real local: URL de propostas bloqueada sem permissão; leitura da listagem/documento permitida sem botões de alteração/compartilhamento/envio.
- Fixture visual removida e overrides temporários restaurados. Sem envios externos.
- Produção consultada sem alteração; Lovable continua no commit 225c0533537bb186ed22b07715241eb36c5ec602.

## Trabalho ainda necessário para concluir a Ordem 4

1. Revisar todas as operações do mapa, especialmente os usos administrativos que recebem IDs, ações de upsert/duplicação, enriquecimento, importações e exports; corrigir heurísticas iniciais e provar os escopos positivos e negativos.
2. Completar a autorização no restante dos workers/cadências/workflows/HubSpot e sincronizações de contas; validar callbacks/webhooks e DTOs de logs auxiliares, inclusive vínculos polimórficos. O port de worker existente deve ser reutilizado onde aplicável.
3. Finalizar as telas comerciais restantes (ações por registro, lotes, atribuição, exportação e leitura) e as configurações/relacionamentos auxiliares de SDR. Rever a experiência de prévia interna de cotações em rascunho, já que rascunhos deixaram de ser públicos.
4. Validar HTTP real da API v1 e navegador nas demais áreas, com permitido, negado, inativo, outro tenant, View As e realtime; sem comunicações reais.
5. Executar novamente verify + build + perf:check no MESMO source_hash, ensaio SQL final e reconciliação de todos os dados/overrides antes/depois.
6. Só então promover a preparação para main e sincronizar com o Lovable, aplicar 0222, publicar código, ativar 0223 e realizar aceite de produção. Confirmar publicação por build-info dos dois domínios e UI do Lovable; botão Publicar disponível não comprova deploy.

Não alterar defaults/denies de cargos, não conceder acesso global para obter testes verdes e não publicar esta preparação como Ordem 4 concluída.
