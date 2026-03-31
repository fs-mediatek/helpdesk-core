const XLSX = require('xlsx');
const mysql = require('mysql2/promise');

(async () => {
  const pool = mysql.createPool({
    host: 'localhost', port: 3306,
    user: 'helpdesk', password: 'helpdesk_db_pass', database: 'helpdesk',
  });

  const wb = XLSX.readFile('/home/ueag/mobilfunk.xlsx');
  const importSheets = ['Rufnummern_ÜAG', 'Rufnummern_inJena', 'Rufnummern ÜAG o2'];

  let totalImported = 0, totalUpdated = 0, totalSkipped = 0;

  for (const sheetName of importSheets) {
    const ws = wb.Sheets[sheetName];
    if (!ws) { console.log(`Sheet "${sheetName}" nicht gefunden, überspringe.`); continue; }

    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
    if (data.length < 2) { console.log(`Sheet "${sheetName}": keine Daten.`); continue; }

    const header = data[0].map(h => String(h || '').trim());
    const colMap = {
      phone_number: header.findIndex(h => /rufnummer/i.test(h)),
      base_price: header.findIndex(h => /basispreis/i.test(h)),
      connection_costs: header.findIndex(h => /verbindungskosten/i.test(h)),
      discount: header.findIndex(h => /rabatt/i.test(h)),
      total_net: header.findIndex(h => /gesamtbetrag\s*netto/i.test(h)),
      total_gross: header.findIndex(h => /gesamtbetrag\s*brutto/i.test(h)),
      cost_center_1: header.findIndex(h => /kst.*1/i.test(h)),
      cost_center_2: header.findIndex(h => /kst.*2/i.test(h)),
      active_user: header.findIndex(h => /aktiver\s*nutzer/i.test(h)),
      device_id: header.findIndex(h => /geräte.?id/i.test(h)),
      intune_registered: header.findIndex(h => /intune/i.test(h)),
      pin: header.findIndex(h => /^pin$/i.test(h)),
      puk: header.findIndex(h => /^puk$/i.test(h)),
      pin2: header.findIndex(h => /pin\s*2/i.test(h)),
      puk2: header.findIndex(h => /puk\s*2/i.test(h)),
      second_user: header.findIndex(h => /2\.\s*nutzer/i.test(h)),
      comment: header.findIndex(h => /kommentar/i.test(h)),
      status: header.findIndex(h => /^status$/i.test(h)),
    };

    // second_device_id is column after second_user
    colMap.second_device_id = colMap.second_user >= 0 ? colMap.second_user + 1 : -1;

    let imported = 0, updated = 0, skipped = 0;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || !row[colMap.phone_number]) { skipped++; continue; }
      const phone = String(row[colMap.phone_number]).trim();
      if (!phone) { skipped++; continue; }

      const getNum = (col) => { const v = col >= 0 ? row[col] : null; return v !== null && v !== undefined && v !== '' ? parseFloat(v) || 0 : 0; };
      const getStr = (col) => { const v = col >= 0 ? row[col] : null; return v !== null && v !== undefined ? String(v).trim() : null; };

      const record = {
        phone_number: phone,
        base_price: getNum(colMap.base_price),
        connection_costs: getNum(colMap.connection_costs),
        discount: getNum(colMap.discount),
        total_net: getNum(colMap.total_net),
        total_gross: getNum(colMap.total_gross),
        cost_center_1: getStr(colMap.cost_center_1),
        cost_center_2: getStr(colMap.cost_center_2),
        active_user: getStr(colMap.active_user),
        device_id: getStr(colMap.device_id),
        intune_registered: getStr(colMap.intune_registered),
        pin: getStr(colMap.pin),
        puk: getStr(colMap.puk),
        pin2: getStr(colMap.pin2),
        puk2: getStr(colMap.puk2),
        second_user: getStr(colMap.second_user),
        second_device_id: getStr(colMap.second_device_id),
        comment: getStr(colMap.comment),
        status: getStr(colMap.status) || 'Aktiv',
      };

      const [existing] = await pool.execute('SELECT id FROM mobile_contracts WHERE phone_number = ?', [phone]);
      if (existing.length > 0) {
        const sets = Object.keys(record).filter(k => k !== 'phone_number').map(k => `${k} = ?`);
        const vals = Object.keys(record).filter(k => k !== 'phone_number').map(k => record[k]);
        vals.push(existing[0].id);
        await pool.execute(`UPDATE mobile_contracts SET ${sets.join(', ')} WHERE id = ?`, vals);
        updated++;
      } else {
        const fields = Object.keys(record);
        const vals = fields.map(f => record[f]);
        await pool.execute(
          `INSERT INTO mobile_contracts (${fields.join(',')}) VALUES (${fields.map(() => '?').join(',')})`,
          vals
        );
        imported++;
      }
    }
    console.log(`Sheet "${sheetName}": ${imported} neu, ${updated} aktualisiert, ${skipped} übersprungen`);
    totalImported += imported;
    totalUpdated += updated;
    totalSkipped += skipped;
  }

  console.log(`\nGesamt: ${totalImported} importiert, ${totalUpdated} aktualisiert, ${totalSkipped} übersprungen`);
  await pool.end();
})().catch(e => console.error('Fehler:', e.message));
