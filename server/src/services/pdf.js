import PDFDocument from 'pdfkit';

const money = (cents) => `$${(Number(cents || 0) / 100).toFixed(2)}`;
const dt = (iso) => (iso ? new Date(iso).toLocaleString() : '');

function build(doc, fn) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    try { fn(doc); doc.end(); } catch (error) { reject(error); }
  });
}

function rule(doc, y) {
  doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y).strokeColor('#d7dde6').lineWidth(0.7).stroke();
}

export function receiptPdf({ receipt, schoolName }) {
  return build(new PDFDocument({ size: 'A5', margin: 34 }), (doc) => {
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    let y = 34;
    doc.font('Helvetica-Bold').fontSize(15).fillColor('#111827').text(schoolName, left, y);
    doc.font('Helvetica').fontSize(8).fillColor('#6b7280').text('Student Accounts & Campus Retail', left, y + 19);
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827').text('PAYMENT RECEIPT', right - 130, y, { width: 130, align: 'right' });
    doc.font('Helvetica').fontSize(8).fillColor('#6b7280').text(receipt.transaction.receipt_no, right - 130, y + 13, { width: 130, align: 'right' });
    y += 44;
    rule(doc, y); y += 12;

    doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827').text(receipt.student?.name || 'Walk-in customer', left, y);
    doc.font('Helvetica').fontSize(8).fillColor('#4b5563')
      .text(`${receipt.student?.student_no || ''}   ${receipt.student?.grade || ''} ${receipt.student?.section || ''}`, left, y + 13)
      .text(`Date: ${dt(receipt.transaction.created_at)}`, left, y + 26)
      .text(`Terminal: ${receipt.transaction.terminal}   Cashier: ${receipt.transaction.cashier}`, left, y + 38);
    y += 60;
    rule(doc, y); y += 8;

    doc.font('Helvetica-Bold').fontSize(8).fillColor('#374151');
    doc.text('ITEM', left, y);
    doc.text('QTY', right - 120, y, { width: 30, align: 'right' });
    doc.text('PRICE', right - 85, y, { width: 45, align: 'right' });
    doc.text('TOTAL', right - 38, y, { width: 38, align: 'right' });
    y += 14;
    doc.font('Helvetica').fontSize(8);
    for (const item of receipt.items) {
      if (y > doc.page.height - 150) { doc.addPage(); y = 40; }
      doc.fillColor('#111827').text(item.name, left, y, { width: right - left - 125 });
      doc.fillColor('#4b5563').text(String(item.qty), right - 120, y, { width: 30, align: 'right' });
      doc.text(money(item.unit_price_cents), right - 85, y, { width: 45, align: 'right' });
      doc.text(money(item.line_total_cents + item.tax_cents), right - 38, y, { width: 38, align: 'right' });
      y += 14;
    }
    y += 4; rule(doc, y); y += 8;

    const totalRow = (label, value, bold = false) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 10 : 8)
        .fillColor(bold ? '#111827' : '#4b5563')
        .text(label, right - 190, y, { width: 110, align: 'right' })
        .text(value, right - 70, y, { width: 70, align: 'right' });
      y += bold ? 17 : 13;
    };
    totalRow('Subtotal', money(receipt.transaction.subtotal_cents));
    if (Number(receipt.transaction.discount_cents)) totalRow('Discount', `-${money(receipt.transaction.discount_cents)}`);
    if (Number(receipt.transaction.tax_cents)) totalRow('Tax', money(receipt.transaction.tax_cents));
    totalRow('TOTAL', money(receipt.transaction.total_cents), true);
    y += 3; rule(doc, y); y += 8;
    for (const payment of receipt.payments) {
      totalRow(payment.method.toUpperCase(), money(payment.amount_cents));
    }
    y += 8;
    doc.font('Helvetica').fontSize(7.5).fillColor('#6b7280')
      .text('Thank you. This receipt is generated from the unified student ledger.', left, y, { width: right - left, align: 'center' });
  });
}

export function statementPdf({ profile, schoolName }) {
  return build(new PDFDocument({ size: 'A4', margin: 42 }), (doc) => {
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    let y = 42;
    doc.font('Helvetica-Bold').fontSize(17).fillColor('#111827').text(schoolName, left, y);
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#4f46e5').text('STUDENT FINANCIAL STATEMENT', left, y + 24);
    doc.font('Helvetica').fontSize(9).fillColor('#6b7280').text(`Generated ${dt(new Date().toISOString())}`, left, y + 39);
    y += 66;

    doc.roundedRect(left, y, right - left, 62, 6).fillColor('#f8fafc').fill();
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827').text(profile.student.name, left + 12, y + 10);
    doc.font('Helvetica').fontSize(9).fillColor('#475569')
      .text(`ID ${profile.student.student_no}  ·  ${profile.student.grade || ''} ${profile.student.section || ''}  ·  Card ${profile.student.card_uid || '—'}`, left + 12, y + 26)
      .text(`Wallet balance: ${money(profile.student.wallet_balance_cents)}     Outstanding fees: ${money(profile.stats.outstanding_cents)}`, left + 12, y + 41);
    y += 78;

    doc.font('Helvetica-Bold').fontSize(8).fillColor('#334155');
    const cols = { date: left, kind: left + 95, desc: left + 185, debit: right - 160, credit: right - 105, balance: right - 50 };
    doc.text('DATE', cols.date, y);
    doc.text('TYPE', cols.kind, y);
    doc.text('DESCRIPTION', cols.desc, y);
    doc.text('DEBIT', cols.debit, y, { width: 52, align: 'right' });
    doc.text('CREDIT', cols.credit, y, { width: 52, align: 'right' });
    doc.text('BALANCE', cols.balance, y, { width: 50, align: 'right' });
    y += 15;
    rule(doc, y); y += 6;

    const rows = [...profile.ledger].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    for (const entry of rows) {
      if (y > doc.page.height - 70) {
        doc.addPage();
        y = 50;
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#334155')
          .text(`${profile.student.name} · Statement (continued)`, left, y);
        y += 18;
        rule(doc, y); y += 6;
      }
      doc.font('Helvetica').fontSize(8).fillColor('#111827');
      doc.text(dt(entry.created_at).split(',')[0], cols.date, y, { width: 88 });
      doc.fillColor('#475569').text(entry.kind.replaceAll('_', ' '), cols.kind, y, { width: 86 });
      doc.fillColor('#111827').text(entry.description, cols.desc, y, { width: right - (cols.desc - left) - 170, ellipsis: true });
      doc.fillColor('#475569').text(Number(entry.debit_cents) ? money(entry.debit_cents) : '—', cols.debit, y, { width: 52, align: 'right' });
      doc.text(Number(entry.credit_cents) ? money(entry.credit_cents) : '—', cols.credit, y, { width: 52, align: 'right' });
      doc.fillColor('#111827').text(money(entry.balance_after_cents), cols.balance, y, { width: 50, align: 'right' });
      y += 14;
      rule(doc, y);
      y += 4;
    }
    y += 8;
    doc.font('Helvetica-Oblique').fontSize(8).fillColor('#6b7280')
      .text('Debits are charges. Credits are payments, prepayments, or waivers. Balance is cumulative account position.', left, y, { width: right - left });
  });
}

export function zReportPdf({ session, schoolName }) {
  return build(new PDFDocument({ size: 'A4', margin: 42 }), (doc) => {
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    let y = 42;
    doc.font('Helvetica-Bold').fontSize(17).fillColor('#111827').text(schoolName, left, y);
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#4f46e5').text('Z-REPORT · DRAWER RECONCILIATION', left, y + 24);
    doc.font('Helvetica').fontSize(9).fillColor('#6b7280')
      .text(`Terminal ${session.terminal} · Cashier ${session.cashier}`, left, y + 40)
      .text(`Opened ${dt(session.opened_at)}   Closed ${dt(session.closed_at)}`, left, y + 53);
    y += 82;

    doc.roundedRect(left, y, right - left, 70, 6).fillColor('#f8fafc').fill();
    doc.font('Helvetica').fontSize(9).fillColor('#475569')
      .text('Opening float', left + 14, y + 13)
      .text('Expected cash', left + 14, y + 30)
      .text('Counted cash', left + 14, y + 47);
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827')
      .text(money(session.opening_float_cents), left + 150, y + 13)
      .text(money(session.expected_cash_cents), left + 150, y + 30)
      .text(money(session.counted_cash_cents), left + 150, y + 47);
    const variance = Number(session.variance_cents || 0);
    doc.fillColor(variance === 0 ? '#047857' : variance > 0 ? '#b45309' : '#b91c1c')
      .text(`Variance ${money(variance)}`, left + 300, y + 30);
    y += 88;

    doc.font('Helvetica-Bold').fontSize(9).fillColor('#334155');
    doc.text('PAYMENT METHOD', left, y);
    doc.text('COUNT', right - 140, y, { width: 50, align: 'right' });
    doc.text('AMOUNT', right - 80, y, { width: 80, align: 'right' });
    y += 16;
    rule(doc, y); y += 8;
    for (const m of session.methods || []) {
      doc.font('Helvetica').fontSize(9).fillColor('#111827')
        .text(m.method.toUpperCase(), left, y)
        .text(String(m.count), right - 140, y, { width: 50, align: 'right' })
        .text(money(m.amount_cents), right - 80, y, { width: 80, align: 'right' });
      y += 16;
      rule(doc, y); y += 5;
    }
    y += 16;
    doc.font('Helvetica-Oblique').fontSize(8).fillColor('#6b7280')
      .text('This Z-report is permanently recorded in the audit log. Discrepancies are flagged for follow-up.', left, y, { width: right - left });
  });
}
