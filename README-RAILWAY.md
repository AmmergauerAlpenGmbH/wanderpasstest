# railway-testversion

Testdeployment des Ammergauer Alpen Wanderpasses. Bitte keine echten persönlichen Daten verwenden.

## Railway

1. GitHub-Repository `railway-testversion` anlegen und diesen Projektordner hochladen.
2. Railway → New Project → Deploy from GitHub repo.
3. Repository auswählen und deployen.
4. Settings → Networking → Generate Domain.
5. Für persistente Testdaten optional ein Railway Volume anlegen und unter `/data` mounten; dann `DB_PATH=/data/wanderpass.sqlite` setzen. Ohne Volume dürfen Daten bei Redeployments verloren gehen.
6. `NODE_ENV=production` setzen.
7. `/api/health` ist als Healthcheck hinterlegt.
