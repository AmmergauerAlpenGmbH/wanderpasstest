# Wanderpass · Naturpark Ammergauer Alpen

PWA-Prototyp für den Wanderpass mit GPS-Stempeln, Offline-Warteschlange, Gipfelbuch, Profil-Wiederherstellung und vorbereiteter Offline-Vektorkarte. Die aktuellen Stempelziele verwenden einen einheitlichen 200-m-GPS-Radius.

## Lokal starten

```powershell
npm install
npm start
```

Dann `http://localhost:8081` öffnen.

## Profil ohne Passwort

Die Nutzer müssen sich nicht klassisch einloggen.

- Beim Anlegen erzeugt der Server einen zufälligen Sicherungscode.
- Der Browser erhält eine zufällige, langlebige Sitzung als `HttpOnly`-Cookie.
- Der Nutzer sieht im Alltag keinen Login-Dialog.
- Wird das Gerät gewechselt oder die Sitzung verloren, reichen Spitzname + Sicherungscode zur Wiederherstellung.
- Der Sicherungscode wird serverseitig nur als SHA-256-Hash gespeichert.
- Wiederherstellung und Profilanlage sind rate-limitiert.
- Die Sitzung läuft nach 180 Tagen ab und kann durch Wiederherstellung neu aufgebaut werden.

## Offline-Karte

Die App unterstützt eine lokale PMTiles-Vektorkarte. Wegen der Dateigröße ist das eigentliche Kartenpaket nicht im ZIP enthalten.

Siehe `public/maps/README.md` für den empfohlenen Ausschnitt und den Erzeugungsbefehl. Wenn `public/maps/ammergauer-alpen.pmtiles` vorhanden ist, nutzt die App MapLibre + PMTiles. Ohne Paket bleibt die bisherige Online-OpenStreetMap-Karte als Fallback erhalten.

## Produktion

Der aktuelle Server ist für einen kleinen bis mittleren, **einzelnen** Backend-Prozess mit persistentem SQLite-Speicher vorbereitet. Vor dem öffentlichen Start mindestens setzen:

```text
NODE_ENV=production
DB_PATH=/data/gipfelpass.sqlite
ADMIN_USER=admin
ADMIN_PASSWORD_HASH=<Ausgabe von node tools/make-admin-hash.js ...>
TRUST_PROXY=1
```

Die App sollte ausschließlich über HTTPS hinter einem Reverse Proxy betrieben werden. Dadurch wird das Sitzungs-Cookie mit `Secure` geschützt. Der Reverse Proxy muss `X-Forwarded-For` nur dann setzen, wenn er selbst vertrauenswürdig ist; deshalb ist `TRUST_PROXY=1` ausschließlich hinter einem eigenen/vertrauenswürdigen Proxy vorgesehen.


### Abhängigkeiten und Sicherheitsprüfung

MapLibre GL JS ist auf `6.11.2` festgelegt. Diese Version ist die aktuelle nicht verwundbare Version für die zuvor gemeldete XSS-Schwachstelle. Nach dem Entpacken immer einmal ausführen:

```powershell
npm install
npm audit
```

`npm audit fix --force` sollte nicht blind ausgeführt werden, weil dadurch Breaking Changes eingespielt werden können.

### Datenbank

SQLite ist für den Start mit einer einzelnen Serverinstanz weiterhin vertretbar. Entscheidend ist, dass die SQLite-Datei auf **persistentem Speicher** liegt und regelmäßig gesichert wird. Der Server verwendet WAL und einen Busy-Timeout. Für horizontale Skalierung, viele gleichzeitige Schreibzugriffe oder mehrere Backend-Instanzen sollte auf PostgreSQL umgestellt werden; das ist eine separate Migrationsstufe und sollte nicht nebenbei beim ersten Livegang erzwungen werden.

Ein einfacher Backup-Lauf ist über `tools/backup-sqlite.sh` vorgesehen. Backups gehören außerhalb des Containers bzw. auf einen separaten persistenten Speicher.

### Admin-Zugang

Der frühere gemeinsame `x-admin-key` wurde durch eine eigene Admin-Sitzung ersetzt. Anmeldung erfolgt mit `ADMIN_USER` + einem per scrypt gespeicherten Passwort-Hash. Die Admin-Sitzung liegt in einem `HttpOnly`-/`SameSite=Strict`-Cookie und läuft nach 8 Stunden ab.

Passwort-Hash erzeugen:

```powershell
node tools/make-admin-hash.js "DEIN-LANGES-ADMIN-PASSWORT"
```

Den ausgegebenen Wert als `ADMIN_PASSWORD_HASH` im Hosting-Secret hinterlegen – nicht in Git einchecken.

### Deployment

Ein `Dockerfile` ist enthalten. Für einen ersten Livebetrieb reicht ein einzelner Container mit persistentem `/data`-Volume, HTTPS-Reverse-Proxy und täglichem Datenbank-Backup. Für mehrere Instanzen müssen Rate-Limit und Session-/Datenbankstrategie gemeinsam geplant werden.

## Noch vor Livegang prüfen

- GPS-Koordinaten vor Ort verifizieren; der aktuelle Stempelbereich beträgt 200 m um den hinterlegten Zielpunkt.
- Offline-PMtiles lokal testen.
- Guestbook-Moderation aktiv betreiben.
- Datenschutz/Impressum ergänzen.
- Admin-Zugang mit eigener Admin-Sitzung und starkem Passwort betreiben.
- `ADMIN_PASSWORD_HASH` ausschließlich als Hosting-Secret hinterlegen.
- Vor Livegang einen persistenten Datenbank-Volume und automatisierte Backups einrichten.
- Stempel-Anti-Cheat weiter härten (GPS-Genauigkeit, Zeitfenster, Plausibilität und ggf. Geräte-/Attestierungsmechanismen).

## v25 – Tourenseiten & Gipfelbuch-Logik
- 12 Stempelziele nach offizieller Tour-Schwierigkeit sortiert, innerhalb der Stufen nach Aufstiegshöhenmetern.
- Zielnamen an die offiziellen Tournamen angepasst (u. a. Scheinbergspitz, Große Klammspitz).
- Eigene Touren-Detailseiten innerhalb der PWA mit Distanz, Aufstieg, Gehzeit, Startpunkt und Tourzusammenfassung.
- Keine Weiterleitung auf externe Tourenseiten aus der Nutzeroberfläche.
- Gipfelbuch-Einträge können serverseitig nur für bereits gesammelte Stempel erstellt werden.
- Nach erfolgreichem Stempel erscheint ein Hinweis zum direkten Eintrag ins Gipfelbuch.
- Sichtbarer Eintrag-schreiben-Button und Tourenbutton in der Karte.
- Titel/Abzeichen bei 5, 10 und 12 gesammelten Gipfeln: Bronze, Silber und Gold.
- Admin-Statistik um Profile, Wanderer mit Stempel, gesammelte Gipfel und Gästebucheinträge erweitert.


## v30
- Header: mehr Abstand zwischen Logo und „Dein Wanderpass“.
- Laber: Distanz und Gehzeit auf den Aufstieg gekürzt; Tourkarte zeigt nur den Aufstieg bis zum Laber.
- Tourkarten verwenden einen eigenen Zielmarker statt des fehlerhaften Standardmarkers „Mark“.

- v30: Tourkarten verwenden am Ziel ausschließlich Leaflet circleMarker statt eines Marker-Icons. Damit kann kein fehlendes Default-Markerbild bzw. Alt-Text „Mark“ erscheinen. Service-Worker-Cache auf v30 angehoben.


v31: Tourkarten zeigen nur einen blauen Startpunkt; kein separater Zielmarker.


## v40 – Security dependency update
- MapLibre GL JS von 5.0.1 auf 6.11.2 aktualisiert.
- Keine Änderung an der Leaflet-Fallbackkarte.
- Offline-PMTiles/MapLibre-Unterstützung bleibt erhalten.


## Lokale Testversion – GPS-Stempel umgehen

Diese ZIP ist eine **separate Testversion** und kein Produktionsstand. Sie bindet den Server ausschließlich an `127.0.0.1`, verwendet standardmäßig die Datenbank `gipfelpass-test.sqlite` und hat einen zusätzlichen Test-Endpunkt für Stempel. Die Stempel-Schaltflächen buchen dadurch ohne echte GPS-Prüfung.

Start:
```powershell
npm.cmd install
npm.cmd start
```
Danach `http://localhost:8081` öffnen.

Die Testversion bitte **nicht öffentlich deployen** und nicht als v41 behandeln. Für den echten Betrieb bleibt die GPS-Prüfung aus v40/v39 unverändert.

## v6
- Große Klammspitz: Kartenpunkt auf OSM-Gipfelknoten 47.58061, 10.90936 angepasst.
- Kreuzspitze: Kartenpunkt auf OSM-Gipfelknoten 47.52654, 10.91799 angepasst.
- PWA-Cache auf v75 erhöht.
