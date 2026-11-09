# DADOS-CONTRATO — preenchimento automático do contrato

Porte: **M/G** · Estimativa: **3h30–4h30** (implementação + testes + Ajuda + permissões). Dependências: consulta pública de CNPJ (BrasilAPI, já usada no CNPJ-ATIVO).

## 1. Ajustes de dados (imediato, ~10 min)
- Signatário da ÓGEA: registrar **Marcos Gulfier** com CPF `168.773.388-04` (contato novo ou existente, a confirmar) e retirar o CPF `105.890.297-03` de Alan Fuentes.
- GM Kologeski & Cia Ltda ME: endereço completo preenchido pela consulta do CNPJ `19.133.530/0001-36`.

## 2. Novos campos na Proposta
- **Parcelamento**: quantidade de parcelas + dia/forma de vencimento.
- **Vigência (dias)**: padrão **90 dias**.
- Editáveis no `ProposalWizard`, exibidos na ficha, link público e PDF.

## 3. Novos campos no Contrato
- **Multa (%)**: padrão **2%**.
- **Foro**: padrão **Florianópolis-SC**.
- Editáveis na tela do contrato/minuta; o modelo pode sobrescrever o padrão.

## 4. Preenchimento automático
- Ao gerar minuta/contrato da proposta: copia parcelamento e vigência da proposta; multa e foro do contrato (ou padrão).
- Novas variáveis no modelo: razão social, CNPJ, endereço e signatário (nome/CPF) da contratante e da contratada; parcelas, vencimento, vigência, multa, foro.
- Endereço de PJ (cliente e prestadora) vazio é completado automaticamente pela consulta do CNPJ, sem sobrescrever dado manual.
- Checklist de prontidão na revisão jurídica bloqueia o envio da minuta se faltar dado essencial.

## 5. Ajuda e permissões
- Artigo da Ajuda atualizado (propostas e contratos) com bump de versão.
- Reutiliza as permissões atuais de editar proposta/contrato; contratos de permissão atualizados e testes de negação.

## Detalhes técnicos
- Migration aditiva: `proposals.installments_count`, `installments_due_day`, `validity_days DEFAULT 90`; `contracts.penalty_percent DEFAULT 2`, `jurisdiction DEFAULT 'Florianópolis-SC'`. Sem alterar RLS.
- Conversão em `src/lib/sales-flow.server.ts`; variáveis no renderizador de modelos.
- Testes: padrões (90 dias, 2%, Florianópolis-SC), cópia proposta→contrato, endereço não sobrescrito.

## Ponto a confirmar
- O signatário da ÓGEA passa a ser **Marcos Gulfier** (substituindo Alan Fuentes) ou ambos assinam?
