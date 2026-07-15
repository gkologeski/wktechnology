
-- Substitui o HTML dos templates "Prosposta 001" e "Prosposta 002" por um
-- layout print-first estável no Chrome/PDFium.
UPDATE public.quote_templates
SET html = $HTML$<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>{{quote.title}}</title>
<style>
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    background: rgb(255,255,255);
    color: rgb(15,23,42);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 12px;
    line-height: 1.4;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    width: 297mm;
    min-height: 210mm;
    padding: 14mm 16mm 12mm;
    background: rgb(255,255,255);
  }
  /* Cabecalho */
  .head {
    display: table;
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 10mm;
  }
  .head-l, .head-r {
    display: table-cell;
    vertical-align: top;
  }
  .head-r { text-align: right; }
  .brand-bar {
    height: 6px;
    background: rgb(200,16,46);
    border-radius: 3px;
    width: 64px;
    margin-bottom: 10px;
  }
  .kicker {
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgb(200,16,46);
    font-weight: 700;
    margin-bottom: 4px;
  }
  .title {
    font-size: 26px;
    font-weight: 800;
    color: rgb(15,23,42);
    letter-spacing: -0.01em;
    line-height: 1.15;
  }
  .subtitle {
    font-size: 12px;
    color: rgb(100,116,139);
    margin-top: 3px;
  }
  .quote-no {
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: rgb(100,116,139);
    font-weight: 600;
  }
  .quote-status {
    display: inline-block;
    margin-top: 6px;
    padding: 3px 10px;
    background: rgb(220,252,231);
    color: rgb(21,128,61);
    border-radius: 999px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  /* Meta strip */
  .meta {
    display: table;
    width: 100%;
    background: rgb(248,250,252);
    border: 1px solid rgb(226,232,240);
    border-radius: 6px;
    padding: 10px 14px;
    margin-bottom: 8mm;
  }
  .meta-cell {
    display: table-cell;
    padding: 0 12px;
    border-left: 1px solid rgb(226,232,240);
    vertical-align: top;
  }
  .meta-cell:first-child { padding-left: 0; border-left: 0; }
  .meta-label {
    font-size: 9px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: rgb(100,116,139);
    font-weight: 600;
    margin-bottom: 2px;
  }
  .meta-value {
    font-size: 12px;
    color: rgb(15,23,42);
    font-weight: 600;
  }

  /* Dois blocos: cliente + vendedor */
  .parties {
    display: table;
    width: 100%;
    margin-bottom: 6mm;
    border-collapse: separate;
    border-spacing: 8mm 0;
  }
  .party {
    display: table-cell;
    width: 50%;
    background: rgb(255,255,255);
    border: 1px solid rgb(226,232,240);
    border-radius: 6px;
    padding: 12px 14px;
    vertical-align: top;
  }
  .party-label {
    font-size: 9px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: rgb(200,16,46);
    font-weight: 700;
    margin-bottom: 4px;
  }
  .party-name {
    font-size: 14px;
    font-weight: 700;
    color: rgb(15,23,42);
    margin-bottom: 2px;
  }
  .party-line {
    font-size: 11px;
    color: rgb(71,85,105);
  }

  /* Itens */
  .section-title {
    font-size: 10px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: rgb(100,116,139);
    font-weight: 700;
    text-align: center;
    margin: 4mm 0 3mm;
    padding-bottom: 3mm;
    border-bottom: 1px solid rgb(226,232,240);
  }
  table.items {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
  }
  table.items thead th {
    background: rgb(200,16,46);
    color: rgb(255,255,255);
    text-align: left;
    padding: 9px 12px;
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-weight: 700;
  }
  table.items thead th.num { text-align: right; }
  table.items tbody td {
    padding: 10px 12px;
    border-bottom: 1px solid rgb(226,232,240);
    vertical-align: top;
  }
  table.items tbody tr, table.items tbody td { page-break-inside: avoid; }
  table.items tbody td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .item-name { font-weight: 700; color: rgb(15,23,42); }
  .item-desc { font-size: 10px; color: rgb(100,116,139); margin-top: 2px; }

  /* Rodape: totais + observacoes */
  .foot {
    display: table;
    width: 100%;
    margin-top: 5mm;
    border-collapse: separate;
    border-spacing: 8mm 0;
  }
  .foot-l, .foot-r {
    display: table-cell;
    vertical-align: top;
  }
  .foot-l { width: 60%; }
  .foot-r { width: 40%; }

  .note-block {
    border: 1px solid rgb(226,232,240);
    border-radius: 6px;
    padding: 10px 12px;
    margin-bottom: 3mm;
    background: rgb(255,255,255);
  }
  .note-label {
    font-size: 9px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: rgb(100,116,139);
    font-weight: 700;
    margin-bottom: 4px;
  }
  .note-body {
    font-size: 11px;
    color: rgb(30,41,59);
    line-height: 1.5;
  }
  .note-body p { margin: 0 0 4px; }

  .totals {
    background: rgb(248,250,252);
    border: 1px solid rgb(226,232,240);
    border-radius: 6px;
    padding: 12px 14px;
  }
  .totals-row {
    display: table;
    width: 100%;
    padding: 3px 0;
  }
  .totals-row > span { display: table-cell; }
  .totals-row .k { color: rgb(71,85,105); font-size: 11px; }
  .totals-row .v { text-align: right; color: rgb(15,23,42); font-size: 12px; font-variant-numeric: tabular-nums; }
  .totals-grand {
    border-top: 2px solid rgb(200,16,46);
    margin-top: 6px;
    padding-top: 8px;
  }
  .totals-grand .k { font-weight: 700; color: rgb(15,23,42); font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; }
  .totals-grand .v { font-weight: 800; color: rgb(200,16,46); font-size: 18px; }

  /* Assinatura */
  .sign {
    margin-top: 5mm;
    display: table;
    width: 100%;
    border-spacing: 8mm 0;
    border-collapse: separate;
  }
  .sign-cell {
    display: table-cell;
    width: 50%;
    vertical-align: top;
  }
  .sign-line {
    border-top: 1px solid rgb(15,23,42);
    padding-top: 4px;
    font-size: 10px;
    color: rgb(71,85,105);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    text-align: center;
  }
</style>
</head>
<body>
  <div class="page">
    <div class="head">
      <div class="head-l">
        <div class="brand-bar"></div>
        <div class="kicker">Proposta Comercial</div>
        <div class="title">{{quote.title}}</div>
        {{#if company.name}}<div class="subtitle">Preparado para {{company.name}}</div>{{/if}}
      </div>
      <div class="head-r">
        <div class="quote-no">{{quote.number}}</div>
        <div class="quote-status">Ativa</div>
      </div>
    </div>

    <div class="meta">
      <div class="meta-cell">
        <div class="meta-label">Emitida</div>
        <div class="meta-value">{{quote.created_at}}</div>
      </div>
      {{#if quote.valid_until}}<div class="meta-cell">
        <div class="meta-label">Vaacute;lida ateacute;</div>
        <div class="meta-value">{{quote.valid_until}}</div>
      </div>{{/if}}
      {{#if agent.name}}<div class="meta-cell">
        <div class="meta-label">Vendedor</div>
        <div class="meta-value">{{agent.name}}</div>
      </div>{{/if}}
    </div>

    <div class="parties">
      <div class="party">
        <div class="party-label">Cliente</div>
        {{#if company.name}}<div class="party-name">{{company.name}}</div>{{/if}}
        {{#if contact.name}}<div class="party-line">{{contact.name}}</div>{{/if}}
        {{#if contact.email}}<div class="party-line">{{contact.email}}</div>{{/if}}
      </div>
      <div class="party">
        <div class="party-label">De</div>
        {{#if agent.name}}<div class="party-name">{{agent.name}}</div>{{/if}}
        {{#if agent.email}}<div class="party-line">{{agent.email}}</div>{{/if}}
      </div>
    </div>

    <div class="section-title">Itens da Proposta</div>
    <table class="items">
      <thead>
        <tr>
          <th>Item / Descriaacute;o</th>
          <th class="num" style="width:70px">Qtd</th>
          <th class="num" style="width:110px">Preaccedil;o Unit.</th>
          <th class="num" style="width:80px">Desc.</th>
          <th class="num" style="width:80px">Imp.</th>
          <th class="num" style="width:130px">Total</th>
        </tr>
      </thead>
      <tbody>
        {{#each items}}
        <tr>
          <td>
            <div class="item-name">{{name}}</div>
            {{#if description}}<div class="item-desc">{{description}}</div>{{/if}}
          </td>
          <td class="num">{{quantity}}</td>
          <td class="num">{{unit_price}}</td>
          <td class="num">{{discount_pct}}%</td>
          <td class="num">{{tax_rate}}%</td>
          <td class="num" style="font-weight:700">{{line_total}}</td>
        </tr>
        {{/each}}
      </tbody>
    </table>

    <div class="foot">
      <div class="foot-l">
        {{#if quote.notes}}<div class="note-block">
          <div class="note-label">Observaaccedil;otilde;es</div>
          <div class="note-body">{{quote.notes}}</div>
        </div>{{/if}}
        {{#if quote.terms}}<div class="note-block">
          <div class="note-label">Termos e Condiaccedil;otilde;es</div>
          <div class="note-body">{{quote.terms}}</div>
        </div>{{/if}}
      </div>
      <div class="foot-r">
        <div class="totals">
          <div class="totals-row"><span class="k">Subtotal</span><span class="v">{{quote.subtotal}}</span></div>
          <div class="totals-row"><span class="k">Descontos</span><span class="v">- {{quote.discount_total}}</span></div>
          <div class="totals-row"><span class="k">Impostos</span><span class="v">+ {{quote.tax_total}}</span></div>
          <div class="totals-row totals-grand"><span class="k">Total</span><span class="v">{{quote.total}}</span></div>
        </div>
        <div class="sign">
          <div class="sign-cell"><div class="sign-line">Cliente</div></div>
          <div class="sign-cell"><div class="sign-line">Fornecedor</div></div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>$HTML$,
    updated_at = now()
WHERE name IN ('Prosposta 001', 'Prosposta 002');
