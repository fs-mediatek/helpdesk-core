const mysql = require('mysql2/promise');

(async () => {
  const pool = mysql.createPool({
    host: 'localhost', port: 3306,
    user: 'helpdesk', password: 'helpdesk_db_pass', database: 'helpdesk',
  });

  // Ensure columns exist
  for (const col of [
    "ALTER TABLE templates ADD COLUMN type VARCHAR(20) DEFAULT 'answer'",
    "ALTER TABLE templates ADD COLUMN trigger_event VARCHAR(50) DEFAULT 'none'",
    "ALTER TABLE templates ADD COLUMN trigger_recipient VARCHAR(200) DEFAULT NULL",
    "ALTER TABLE templates ADD COLUMN trigger_enabled TINYINT(1) DEFAULT 0",
  ]) {
    try { await pool.execute(col) } catch {}
  }

  const templates = [
    // ANTWORTVORLAGEN
    { name: 'Passwort zurückgesetzt', category: 'Allgemein', type: 'answer', content: 'Hallo {{ersteller_name}},\n\nIhr Passwort wurde erfolgreich zurückgesetzt. Sie erhalten in Kürze eine separate E-Mail mit den neuen Zugangsdaten.\n\nBitte ändern Sie das Passwort nach der ersten Anmeldung.\n\nBei Fragen stehen wir Ihnen gerne zur Verfügung.\n\nMit freundlichen Grüßen\nIT HelpDesk' },
    { name: 'Gerät bestellt', category: 'Hardware', type: 'answer', content: 'Hallo {{ersteller_name}},\n\nIhr gewünschtes Gerät wurde bestellt. Die voraussichtliche Lieferzeit beträgt 5-10 Werktage.\n\nSobald das Gerät eingetroffen ist, melden wir uns bei Ihnen zur Terminvereinbarung für die Einrichtung.\n\nMit freundlichen Grüßen\nIT HelpDesk' },
    { name: 'Fernwartung erforderlich', category: 'Allgemein', type: 'answer', content: 'Hallo {{ersteller_name}},\n\nzur Behebung Ihres Problems benötigen wir einen kurzen Fernwartungszugriff auf Ihren Rechner.\n\nBitte stellen Sie sicher, dass:\n- Ihr Rechner eingeschaltet und mit dem Netzwerk verbunden ist\n- Sie alle wichtigen Dokumente gespeichert haben\n- Sie telefonisch erreichbar sind\n\nWir melden uns in Kürze bei Ihnen.\n\nMit freundlichen Grüßen\nIT HelpDesk' },
    { name: 'Ticket an Dienstleister weitergeleitet', category: 'Allgemein', type: 'answer', content: 'Hallo {{ersteller_name}},\n\nIhr Anliegen wurde an unseren externen Dienstleister weitergeleitet. Wir informieren Sie, sobald eine Rückmeldung vorliegt.\n\nMit freundlichen Grüßen\nIT HelpDesk' },
    { name: 'Rückfrage an Ersteller', category: 'Allgemein', type: 'answer', content: 'Hallo {{ersteller_name}},\n\nvielen Dank für Ihre Anfrage. Zur weiteren Bearbeitung benötigen wir noch folgende Informationen:\n\n- \n- \n\nBitte antworten Sie auf diese Nachricht oder ergänzen Sie die Informationen direkt im Ticket.\n\nMit freundlichen Grüßen\nIT HelpDesk' },
    { name: 'Software installiert', category: 'Software', type: 'answer', content: 'Hallo {{ersteller_name}},\n\ndie gewünschte Software wurde auf Ihrem Rechner installiert und steht ab sofort zur Verfügung.\n\nSollten Sie Fragen zur Bedienung haben, schauen Sie gerne in unsere Wissensdatenbank oder erstellen Sie ein neues Ticket.\n\nMit freundlichen Grüßen\nIT HelpDesk' },
    { name: 'Drucker eingerichtet', category: 'Hardware', type: 'answer', content: 'Hallo {{ersteller_name}},\n\nder Drucker wurde erfolgreich eingerichtet und ist jetzt über Ihren Rechner ansprechbar.\n\nDruckername: \nStandort: \n\nBei Problemen stehen wir Ihnen gerne zur Verfügung.\n\nMit freundlichen Grüßen\nIT HelpDesk' },
    { name: 'VPN-Zugang eingerichtet', category: 'Netzwerk', type: 'answer', content: 'Hallo {{ersteller_name}},\n\nIhr VPN-Zugang wurde eingerichtet. Sie können sich ab sofort von extern mit dem Firmennetzwerk verbinden.\n\nAnleitung:\n1. Starten Sie den VPN-Client\n2. Melden Sie sich mit Ihren gewohnten Zugangsdaten an\n3. Warten Sie bis die Verbindung hergestellt ist\n\nBei Fragen stehen wir Ihnen gerne zur Verfügung.\n\nMit freundlichen Grüßen\nIT HelpDesk' },
    { name: 'Problem nicht reproduzierbar', category: 'Allgemein', type: 'answer', content: 'Hallo {{ersteller_name}},\n\nwir konnten das beschriebene Problem leider nicht nachstellen. Bitte teilen Sie uns mit, ob das Problem weiterhin auftritt.\n\nFalls ja, wäre es hilfreich wenn Sie:\n- Einen Screenshot des Fehlers erstellen\n- Den genauen Zeitpunkt notieren\n- Die durchgeführten Schritte beschreiben\n\nWir schließen das Ticket vorerst. Bei erneutem Auftreten können Sie es jederzeit wieder öffnen.\n\nMit freundlichen Grüßen\nIT HelpDesk' },
    { name: 'Berechtigungen angepasst', category: 'Software', type: 'answer', content: 'Hallo {{ersteller_name}},\n\ndie gewünschten Berechtigungen wurden angepasst. Die Änderungen sind ab sofort wirksam.\n\nBitte melden Sie sich einmal ab und wieder an, damit die Änderungen greifen.\n\nMit freundlichen Grüßen\nIT HelpDesk' },

    // E-MAIL-VORLAGEN
    { name: 'Ticket-Eingangsbestätigung', category: 'System', type: 'email', trigger_event: 'ticket_created', trigger_recipient: '{{ersteller}}', trigger_enabled: 0, content: '<p>Hallo {{ersteller_name}},</p><p>vielen Dank für Ihre Anfrage. Ihr Ticket <strong>{{ticket_nummer}}</strong> wurde erfolgreich erstellt und wird von unserem IT-Team bearbeitet.</p><p><strong>Betreff:</strong> {{ticket_titel}}</p><p>Wir melden uns schnellstmöglich bei Ihnen.</p><p>Mit freundlichen Grüßen<br/>IT HelpDesk</p>' },
    { name: 'Ticket gelöst — Benachrichtigung', category: 'System', type: 'email', trigger_event: 'ticket_resolved', trigger_recipient: '{{ersteller}}', trigger_enabled: 1, content: '<p>Hallo {{ersteller_name}},</p><p>Ihr Ticket <strong>{{ticket_nummer}}</strong> wurde als gelöst markiert.</p><p><strong>Betreff:</strong> {{ticket_titel}}</p><p>Sollte das Problem weiterhin bestehen, antworten Sie bitte auf diese E-Mail oder öffnen Sie das Ticket erneut.</p><p>Mit freundlichen Grüßen<br/>IT HelpDesk</p>' },
    { name: 'Ticket geschlossen — Benachrichtigung', category: 'System', type: 'email', trigger_event: 'ticket_closed', trigger_recipient: '{{ersteller}}', trigger_enabled: 1, content: '<p>Hallo {{ersteller_name}},</p><p>Ihr Ticket <strong>{{ticket_nummer}}</strong> wurde geschlossen.</p><p>Vielen Dank für Ihre Geduld. Bei neuen Anliegen erstellen Sie bitte ein neues Ticket.</p><p>Mit freundlichen Grüßen<br/>IT HelpDesk</p>' },
    { name: 'Onboarding gestartet — IT-Info', category: 'Onboarding', type: 'email', trigger_event: 'onboarding_started', trigger_recipient: 'it@ueag-jena.de', trigger_enabled: 0, content: '<p>Hallo IT-Team,</p><p>für <strong>{{mitarbeiter_name}}</strong> ({{abteilung}}) wurde ein Onboarding-Prozess gestartet.</p><p>Bitte bereitet die IT-Ausstattung vor und arbeitet die Checkliste im HelpDesk ab.</p><p>Viele Grüße<br/>HelpDesk System</p>' },
    { name: 'Offboarding gestartet — IT-Info', category: 'Offboarding', type: 'email', trigger_event: 'offboarding_started', trigger_recipient: 'it@ueag-jena.de', trigger_enabled: 0, content: '<p>Hallo IT-Team,</p><p>für <strong>{{mitarbeiter_name}}</strong> ({{abteilung}}) wurde ein Offboarding eingeleitet.</p><p><strong>Letzter Arbeitstag:</strong> {{austrittsdatum}}</p><p>Bitte bereitet die Geräterücknahme vor und arbeitet die IT-Checkliste ab.</p><p>Viele Grüße<br/>HelpDesk System</p>' },
    { name: 'Gerät zugewiesen — Bestätigung', category: 'Hardware', type: 'email', trigger_event: 'asset_assigned', trigger_recipient: '{{betroffener}}', trigger_enabled: 0, content: '<p>Hallo {{betroffener_name}},</p><p>Ihnen wurde folgendes IT-Gerät zugewiesen:</p><p><strong>Gerät:</strong> {{geraet_name}}<br/><strong>Asset-Tag:</strong> {{geraet_tag}}</p><p>Bitte behandeln Sie das Gerät pfleglich. Bei Verlust oder Beschädigung informieren Sie bitte umgehend die IT-Abteilung.</p><p>Mit freundlichen Grüßen<br/>IT HelpDesk</p>' },
    { name: 'Wartungsankündigung', category: 'System', type: 'email', content: '<p>Sehr geehrte Mitarbeiterinnen und Mitarbeiter,</p><p>am <strong>{{datum}}</strong> finden geplante Wartungsarbeiten an unserer IT-Infrastruktur statt.</p><p><strong>Betroffene Systeme:</strong><br/>[Systeme hier eintragen]</p><p><strong>Zeitraum:</strong><br/>[Zeitraum hier eintragen]</p><p>Während der Wartung kann es zu kurzzeitigen Einschränkungen kommen. Bitte speichern Sie Ihre Arbeit rechtzeitig.</p><p>Vielen Dank für Ihr Verständnis.</p><p>Mit freundlichen Grüßen<br/>IT HelpDesk</p>' },

    // CHECKLISTEN-VORLAGEN
    { name: 'Neuer Mitarbeiter — IT-Setup', category: 'Onboarding', type: 'checklist', content: 'AD-Konto erstellen\nE-Mail-Postfach einrichten\nMicrosoft 365 Lizenz zuweisen\nLaptop/PC vorbereiten und konfigurieren\nMonitor und Peripherie bereitstellen\nTelefon-Nebenstelle einrichten\nVPN-Zugang einrichten (falls erforderlich)\nDrucker zuweisen\nFachsoftware installieren\nZugang zu Fachsystemen einrichten\nSmartphone einrichten (falls erforderlich)\nIntune-Registrierung prüfen\nArbeitsplatz-Übergabe mit Mitarbeiter\nEinweisung in IT-Systeme' },
    { name: 'Mitarbeiter-Austritt — IT-Abbau', category: 'Offboarding', type: 'checklist', content: 'E-Mail-Weiterleitung einrichten\nShared Mailboxes prüfen und übertragen\nOneDrive/Dateien sichern\nSoftware-Lizenzen entziehen\nZugriff auf Fachsysteme sperren\nMobilfunkvertrag prüfen (Kündigung/Übernahme)\nVPN-Zugang deaktivieren\nGeräterücknahme durchführen\nAD-Konto deaktivieren\nMicrosoft 365 Lizenz entziehen\nTelefon-Nebenstelle deaktivieren\nGebäudezugang/Schlüssel/Chipkarte zurücknehmen\nE-Mail-Konto nach 30 Tagen löschen\nGeräte neu aufsetzen und freigeben' },
    { name: 'Laptop-Neuinstallation', category: 'Hardware', type: 'checklist', content: 'Daten sichern (Benutzer informieren)\nWindows neu installieren\nTreiber installieren\nWindows Updates durchführen\nDomäne beitreten\nMicrosoft 365 Apps installieren\nFachsoftware installieren\nDrucker einrichten\nVPN-Client installieren\nIntune-Registrierung durchführen\nFunktionstest durchführen\nGerät an Benutzer übergeben' },
    { name: 'Server-Wartung', category: 'Infrastruktur', type: 'checklist', content: 'Wartungsankündigung an Benutzer versenden\nBackup vor Wartung erstellen und prüfen\nWartungsfenster dokumentieren\nUpdates/Patches installieren\nDienste nach Update prüfen\nSpeicherplatz prüfen\nEventlog auf Fehler prüfen\nZertifikate prüfen (Ablaufdaten)\nNetzwerk-Konnektivität testen\nAnwendungen und Dienste testen\nBackup nach Wartung erstellen\nWartung als abgeschlossen dokumentieren' },
    { name: 'Sicherheitsvorfall', category: 'Sicherheit', type: 'checklist', content: 'Vorfall dokumentieren (Zeitpunkt, betroffene Systeme)\nBetroffene Systeme isolieren\nPasswörter der betroffenen Konten zurücksetzen\nLogs sichern und analysieren\nMalware-Scan durchführen\nBetroffene Benutzer informieren\nGeschäftsführung informieren\nUrsache identifizieren\nSicherheitslücke schließen\nSysteme wiederherstellen\nAbschlussbericht erstellen\nMaßnahmen zur Prävention definieren' },
  ];

  let inserted = 0;
  for (const t of templates) {
    await pool.execute(
      "INSERT INTO templates (name, category, content, type, trigger_event, trigger_recipient, trigger_enabled) VALUES (?,?,?,?,?,?,?)",
      [t.name, t.category, t.content, t.type, t.trigger_event || 'none', t.trigger_recipient || null, t.trigger_enabled || 0]
    );
    inserted++;
  }

  console.log(`${inserted} Vorlagen eingefügt`);
  await pool.end();
})().catch(e => console.error(e.message));
