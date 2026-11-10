# TEXTO-CONSULTORIA — Padronizar texto da proposta de Consultoria

Porte: P/M — estimativa 45–75 min.

## Objetivo
Trocar as seções Diagnóstico inicial, Metodologia, Entregáveis, Cronograma e Especialistas alocados do modelo de proposta "Consultoria" pelo texto enviado, com variáveis preenchidas automaticamente.

## O que muda
1. **Cópia de segurança** do modelo atual ("(backup antes de TEXTO-CONSULTORIA)").
2. **Texto novo** nas cinco seções, exatamente como enviado; o restante do modelo (itens, Condições comerciais, validade) fica intacto.
3. **Variáveis na proposta**: hoje a proposta só conhece `{{company.name}}` e `{{contact.name}}`. Passa a aceitar também, com os mesmos nomes do contrato:
   - `{{counterparty.name}}` — nome da empresa cliente.
   - `{{signer.full_name}}` — signatário da empresa (contato marcado como signatário legal; se não houver ou houver mais de um, usa o contato da proposta).
   - `{{signer.cpf}}` e `{{signer.email}}` — mesmas regras.
4. **Ajuda**: lista de variáveis do artigo de modelos de proposta atualizada (versão +1).

## Fora do escopo
Outros modelos (Hunting, Outsourcing, Fábrica), propostas já criadas (precisam reaplicar o modelo), permissões e telas.

## Detalhes técnicos
- Contexto de variáveis no `proposal-wizard.tsx` (bloco ~linha 219) ganha `counterparty` e `signer`; busca do signatário reutiliza a regra do contrato (custom_fields.signatario_legal, único).
- Atualização do `proposal_templates` da Consultoria via escrita autorizada (sem migração de schema; sem mudança de RLS).
- Teste unitário: signatário único → nome dele; dois signatários → contato da proposta.
- Verificações: permissions:check, help:coverage, testes de propostas, Playwright aplicando o modelo num negócio real.
