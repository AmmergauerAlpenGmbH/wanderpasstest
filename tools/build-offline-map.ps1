param(
  [string]$Date = "20260924",
  [string]$OutFile = "public/maps/ammergauer-alpen.pmtiles"
)
$ErrorActionPreference = "Stop"
$bbox = "10.80,47.48,11.20,47.72"
$url = "https://build.protomaps.com/$Date.pmtiles"
Write-Host "Erzeuge Offline-Karte für die Ammergauer Alpen ..."
Write-Host "Quelle: $url"
Write-Host "Ausschnitt: $bbox"
if (-not (Get-Command pmtiles -ErrorAction SilentlyContinue)) {
  throw "pmtiles CLI nicht gefunden. Bitte zuerst von https://github.com/protomaps/go-pmtiles/releases installieren."
}
pmtiles extract $url $OutFile --bbox=$bbox --maxzoom=14
Write-Host "Fertig: $OutFile"
