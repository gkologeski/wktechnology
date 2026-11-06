# Manual de Treinamento "Como fazer?" — PDF

**Porte: G — estimativa 3h a 4h** (captura de telas + diagramação + revisão visual de todas as páginas).

## Objetivo
Gerar um PDF único de treinamento, organizado por perguntas "Como fazer?", seguindo o fluxo completo do TechERP de ponta a ponta, com capturas reais das telas (dados fictícios do workspace WK).

## Estrutura do material
```text
Capa + Sumário clicável + "Como usar este manual"
Parte 0 - Primeiros passos (login, navegação entre módulos, busca, notificações, Ajuda)
Parte 1 - TechSales (fluxo comercial)
  Como cadastrar um lead? / importar leads (CSV)?
  Como qualificar um lead? / desqualificar?
  Como converter lead em contato, empresa e oportunidade?
  Como agendar uma reunião?
  Como registrar atividade, tarefa, ligação, nota, e-mail e WhatsApp?
  Como atualizar oportunidades (etapa, valor, kanban)?
  Como criar cotação -> proposta -> link/PDF?
  Qual o fluxo do negócio em assinatura de contrato?
  Qual o fluxo do negócio ganho? E perdido?
  Como usar a Inbox, campanhas de WhatsApp, sequências e agentes (Lia/Bruna)?
Parte 2 - TechContracts (contrato, modelos, assinatura eletrônica, aditivos, serviços)
Parte 3 - TechHire (vaga -> candidatos -> pipeline -> entrevista -> oferta -> contratação)
Parte 4 - TechPeople (cadastro, alocação, documentos, benefícios, onboarding, ciclo do vínculo)
Parte 5 - TechProjects (projeto, listas, tarefas, marcos, timesheet, importações)
Parte 6 - TechFinance (pagar/receber, faturas, NFS-e, bancos, conciliação, DRE, fluxo de caixa)
Parte 7 - Configurações e administração (usuários, cargos/permissões, canais, integrações, White Label)
Anexo - Fluxo integrado (Lead -> Negócio ganho -> Contrato -> Contratação -> Alocação -> Projeto -> Faturamento) e glossário
```
Cada "Como fazer?" terá: objetivo, quem pode (permissão), caminho no menu, passo a passo numerado, captura da tela, dicas/erros comuns.

## Fonte do conteúdo
- Reaproveita os 425 artigos da Ajuda (`docs/help/<módulo>/*.md`) e as 328 capturas já geradas em `public/help-media/`.
- Capturas novas com Playwright (sessão autorizada, workspace WK, somente leitura) para telas de fluxo ainda sem imagem (ex.: formulários de criação abertos, modais de conversão, agendamento).
- Diagramas de fluxo desenhados no próprio PDF.

## Entrega
- `/mnt/documents/manual-treinamento-techerp.pdf` (estimativa 120–200 páginas, A4, PT-BR, identidade visual WK).
- Opcional: um PDF por módulo, se desejar.

## Detalhes técnicos
- Geração em Python (reportlab Platypus + fonte DejaVu para acentos), roteiro em `/tmp`, sem alterar código do app nem dados.
- Capturas via Playwright sem clicar em salvar/enviar (nenhuma gravação no banco, nenhum disparo).
- QA obrigatório: converter todas as páginas em imagem e revisar cortes, sobreposição, imagens ausentes e ordem; relatar problemas encontrados e corrigidos.

## Fora do escopo / limitações
- Telas públicas com token (link de proposta, portal, oferta) e as 35 pendências de mídia já listadas podem ficar com descrição sem captura.
- Homologação editorial pelos líderes de área continua sendo deles.
