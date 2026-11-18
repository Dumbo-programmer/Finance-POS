export async function nextReceiptNo(t) {
  const day = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    const receipt = `R-${day}-${suffix}`;
    const existing = await t.get('SELECT id FROM transactions WHERE receipt_no = ?', [receipt]);
    if (!existing) return receipt;
  }
  return `R-${day}-${Date.now().toString(36).toUpperCase()}`;
}
