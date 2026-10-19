# railway-testversion-v4

Testdeployment des Ammergauer Alpen Wanderpasses.

Änderungen gegenüber v2-fixed:
- „Wie funktioniert’s?“ vollständig aktualisiert
- Belohnungsbezeichnung auf „Pin“ umgestellt
- Wanderwarzi ausdrücklich als Kinder-Abzeichen beschrieben
- Kartenmarker in MapLibre auf `anchor: center` korrigiert, damit die Koordinate bei einem runden Marker exakt im Mittelpunkt liegt
- Gipfelkoordinaten für Scheinbergspitz, Große Klammspitz und Kreuzspitze präzisiert
- Service-Worker/Asset-Version erhöht, damit die neue Version trotz PWA-Cache geladen wird

Railway-Fixes bleiben enthalten: kein Dockerfile-VOLUME `/data`; Serverport über `process.env.PORT`.


## Änderungen in v7
- GPS-Stempelradius client- und serverseitig auf 100 Meter reduziert.
- Nach einem Gipfelbucheintrag zeigt das jeweilige Ziel den vorhandenen Eintrag an, statt erneut zum Schreiben aufzufordern.
- API liefert die bereits beschriebenen Ziele des angemeldeten Profils; doppelte Einträge pro Profil und Ziel werden serverseitig verhindert.
- PWA-Cache auf v76 angehoben.
