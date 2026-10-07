# Offline-Karte

Die PWA ist für eine lokale PMTiles-Karte vorbereitet. Sobald `public/maps/ammergauer-alpen.pmtiles` vorhanden ist, verwendet die Karte automatisch das lokale Kartenpaket.

## Kartenpaket erzeugen

Die PMTiles-Basemap wird aus einem aktuellen Protomaps-Download extrahiert. Protomaps stellt dafür tägliche OSM-basierte Basemap-Dateien bereit und dokumentiert die Extraktion per Bounding Box. Die PWA nutzt anschließend die Datei lokal, ohne Kartenserver oder Online-Kachelabrufe.

### Windows PowerShell

```powershell
# pmtiles CLI installieren: https://github.com/protomaps/go-pmtiles/releases
cd Gipfelpass
.\tools\build-offline-map.ps1
```

### macOS / Linux

```bash
./tools/build-offline-map.sh
```

Der vorgesehene Ausschnitt ist großzügig um die 12 regulären Stempelziele gewählt:
`10.80,47.48,11.20,47.72`

Zoom 0–14 wird für die Offline-Karte verwendet. Für die eigentliche Bergnavigation können wir später zusätzlich die offiziellen Wander-/GPX-Daten als separate lokale Overlay-Ebene einbauen.

## Attribution

Die Basemap basiert auf OpenStreetMap-Daten. In der App wird die Attribution **© OpenStreetMap-Mitwirkende** angezeigt. Die konkrete Datenquelle und Lizenzhinweise müssen bei Veröffentlichung zusammen mit dem Kartenpaket aktuell gehalten werden.
