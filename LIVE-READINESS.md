# Live-Readiness v71

- Produktionsvariante: GPS-Stempel aktiv; Test-Endpunkt deaktiviert.
- Default-Datenbank: `gipfelpass.sqlite`; in Produktion `DB_PATH` auf persistenten Speicher setzen.
- `NODE_ENV=production` für Secure-Cookies und HSTS.
- Hinter HTTPS-Reverse-Proxy betreiben.
- `ADMIN_USER` und `ADMIN_PASSWORD_HASH` als Hosting-Secrets setzen.
- Vor dem ersten Start leere Produktionsdatenbank anlegen; Testdaten nicht übernehmen.
- Regelmäßige SQLite-Backups außerhalb des Containers einrichten.
- Vor öffentlichem Start Datenschutz/Impressum/Hosting-Details mit dem zuständigen Datenschutzbeauftragten final prüfen.
- Vor Saisonstart alle 12 GPS-Ziele und GPX-Tracks vor Ort abnehmen.
