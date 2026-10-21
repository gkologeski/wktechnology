# Alocações e Timesheet da Pessoa

## Situação atual (conferida no código)
- **Contrato de prestação**: já lista só contratos de prestação. Falta excluir aditivos.
- **Contrato de compra**: já lista só contratos de compra em que uma empresa do grupo é contratante. Falta excluir aditivos. Os dois filtros já são feitos no servidor.
- **Projeto**: lista todos os projetos, sem prioridade.
- **Cargo/Função**: hoje é texto livre. **Senioridade** usa uma lista fixa local.
- **Empresa**: a alocação não tem campo de empresa cliente.
- **Timesheet**: já lê as horas do TechProjects, mas só as ligadas à pessoa (ou ao login dela). Não mostra o status da aprovação.

## O que muda
1. **Contratos**: os dois seletores ganham busca e deixam de mostrar aditivos. O servidor recusa salvar um contrato de compra no campo de prestação, e o contrário também.
2. **Projeto**: lista com busca. No topo, o grupo "Projetos do contrato de prestação" (os do contrato escolhido); abaixo, "Outros projetos". Ao trocar o contrato, a ordem se atualiza.
3. **Cargo/Função e Senioridade**: usam os mesmos seletores da ficha da pessoa, com os cargos de Presets e cargos e a senioridade dos presets. As sugestões dos serviços do contrato continuam. Um valor antigo digitado à mão aparece como "valor anterior" até ser trocado.
4. **Rateio entre empresas**: nova seção "Rateio por cliente". Ela permite adicionar várias empresas clientes com um percentual para cada uma, e a soma tem que dar 100%. É opcional: sem rateio, a alocação fica como hoje. A regra é conferida também no servidor.
5. **Timesheet**: passa a trazer também os apontamentos ainda não ligados à pessoa, quando o e-mail bate exatamente e só existe uma pessoa com ele. Também mostra a situação de cada apontamento (rascunho, enviado, aprovado, rejeitado, fechado), a tarefa e o projeto, como em Minhas Horas. Nesta tela é só leitura: nenhum vínculo é gravado e nada é aprovado.
