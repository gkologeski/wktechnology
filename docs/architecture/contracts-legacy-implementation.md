# Contratos legados — importação e regularização

## Escopo final

A importação distingue documento em elaboração de contrato legado já formalizado. O legado é reconhecido explicitamente como pendente e regularizado no mesmo contrato, sem cotação, proposta, minuta ou nova assinatura fictícias. Não cria solicitação de contratação, serviço, título, pagamento ou acesso retroativo.

O pacote 5 é o fechamento de segurança das solicitações de profissionais e fornecedores de 18/11 (pacotes 2–4), não a antiga etapa ATS. Sua matriz de aceite está em `hiring-package5-acceptance.md`.

## Auditoria de produção

Antes da entrega havia 66 contratos com arquivo importado: 18 rascunhos, 33 ativos, 14 rescindidos e um encerrado. Entre os rascunhos, 17 tinham referências externas extraídas; sete não tinham contraparte, 14 não tinham CNPJ WK e um tinha ano 0025. Nada disso é corrigido ou atestado automaticamente. O inventário permanece assistido, com ação humana na ficha.

Status e referências extraídos não comprovam assinatura. Pacotes nativos, entregas e-sign, operações ForSign, proposta/cotação/minuta aceita e origem governada de contratação protegem a origem e impedem conversão para legado. Assinatura em curso também impede reconhecimento.

## Implementação

- 0385: permissões específicas, registros/evidências/eventos privados, reconhecimento e regularização humana, impressão digital dos termos e guarda do documento conferido.
- 0386: novas operações de execução revalidam a identidade e autoridade atual do gestor sem repetir o preflight de início. Mantém assinatura, revisão, aprovação, início e histórico.
- 0387: importação atômica por operação estável, classificação mínima para leitores comuns, concorrência com assinatura/aprovação e supressão restrita da liberação automática de cobrança durante regularização.
- 0388: o booleano de regularização usado pela guarda comercial também revalida a leitura canônica do contrato em RPC direta. Membro/workspace ativos, escopo e deny; exceção de serviço exige claim e papel real de serviço. Não retorna evidência privada.
- As migrações são aditivas e registradas no journal; aplicação conjunta somente após revisão e CI completa. Migrações históricas não são editadas.
- Importador individual exige escolha do modo, motivo e original. Legado é revisado antes de criar. O lote mantém o modo, a escolha explícita de papel e Principal/Aditivo; não faz pareamento automático de legado.
- Inserção e reconhecimento são uma transação com cliente do usuário/RLS. O UUID da operação e caminho do arquivo persistem na tentativa; replay exato não duplica, conteúdo divergente é recusado.
- Papel manual prevalece sobre extração: WK contratada indica cliente contraparte; WK contratante indica fornecedor. CNPJ explícito não cai em nome semelhante; ambiguidade exige escolha humana.

## Autorização e evidência

Chaves `techcontracts.legacy_contracts.view|create|approve.workspace`, sem concessões automáticas. Toda ação exige workspace e membership ativos, deny prevalecendo, acesso real ao contrato por escopo próprio/equipe/workspace e chave específica; escrita exige também update canônico. Ver-como somente leitura não autoriza mutação. O atestado de serviço revalida a autoridade atual do autor pelos mesmos escopos.

Reserva do PDF pela RPC do usuário → servidor grava no bucket privado existente → relê os bytes e confirma SHA-256 → RPC de atestado exclusiva de serviço. O original importado nunca é sobrescrito. Download exige autorização da RPC do usuário e URL de 60 segundos. Hash prova integridade, não validade jurídica externa.

O usuário confirma assinatura real, situação, vigência, referência e motivo. Datas plausíveis, assinatura até hoje e renovação conferida são obrigatórias. Início futuro permanece pendente para não antecipar efeitos; não foi criado status agendado. Alterações materiais após reconhecimento exigem rebase explícito e nova evidência; após regularização exigem aditivo.

Arquivos, corpo, partes e vínculos permanecem no mesmo contrato. Serviços e bloqueios de cobrança existentes são preservados. Somente o marcador privado da transação de regularização evita liberação automática de cobrança; não existe bypass por GUC. A guarda comercial aceita associação de negócio apenas para legado regularizado com prova conferida, sem fabricar origem comercial.

## Ficha e Ajuda

Painel de legado na Visão geral, com trilha e ações. Carregamento/falha fecham os caminhos novos de aprovação/assinatura; não fabricam estado “não legado”. Leitores comuns veem somente a classificação mínima, sem evidências privadas. Cache inclui usuário, workspace e permissões.

Ajuda versionada: importar contrato, importar em lote, editar/consultar contratos, regularizar contrato legado e guias das solicitações de profissionais/fornecedores. Catálogo oficial regenerado; publicação de conteúdo usa o botão autenticado Atualizar Ajuda oficial, não upsert de serviço.

## Evidências e limites

Testes reais de RPC/PostgreSQL descartável cobrem permitido, sem chave, deny, outro workspace e inativo; replay/conflito, concorrência, termos alterados, arquivo privado, acesso forjado, preservação e ausência de efeitos financeiros. Integração com assinaturas e inícios reais de fixture impede converter contratações governadas em legado.

Os fixtures de legado isolam algumas tabelas/gatilhos de assinatura e serviços; o teste integrado de títulos carrega também o núcleo real de contratação. Nenhum deles constitui atestado jurídico de contrato real. Navegação de produção é registrada separadamente de mutações SQL isoladas. E2E autenticado opt-in não configurado permanece skipped.

Estado de aplicação, CI, publicação, fingerprint e preservação efetiva devem ser consultados no relatório de release. Preparado, testado, aplicado, publicado e validado são etapas distintas.
