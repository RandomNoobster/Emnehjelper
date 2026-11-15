# Plakater

Dette verktøyet lager plakatene for Emnehjelper som PDF-filer som er klare til utskrift. Det lages to plakater, og de blir lagret i `media/posters/`:

| Fil | Bruk |
| --- | --- |
| `emnehjelper-plakat-A3.pdf` | Henges opp på veggen. Den har stor overskrift, ett bilde og en stor QR-kode, slik at den kan leses fra et par meters avstand. |
| `emnehjelper-plakat-A4.pdf` | Legges på bordene. Den forklarer mer om hva utvidelsen gjør, og viser hvordan man installerer den. |

Plakatene har samme stil som bildene i Chrome Web Store. Alle bildene av utvidelsen er ekte skjermbilder fra `media/raw/`, og QR-koden går til Emnehjelper i Chrome Web Store.

## Utskrift

- Skriv ut i «Faktisk størrelse», ikke «Tilpass til siden».
- De fleste skrivere får ikke skrevet helt ut til kanten av arket. Derfor er de ytterste 5 mm av plakatene helt hvite, og bakgrunnen tones inn derfra. Da blir det ingen synlig kant mellom det som er skrevet ut og den hvite margen.
- Fontene er lagt inn i PDF-filene, og QR-koden er vektorgrafikk, så den blir skarp.

## Slik lager du plakatene

```bash
npm install
npx playwright install chromium
npm run build
```

Verktøyet bruker `study-plan.png` og `panel-light.png` fra `media/raw/`. De lages av `tools/store-screenshots/` med `npm run shots`. Hvis skjermbildene ligger et annet sted, kan du bruke `node build.mjs --raw=<mappe>`, og `--out=<mappe>` for å lagre plakatene et annet sted.

Tekstene står i `T` øverst i `build.mjs`. Hvis du flytter noe, må alt innhold være mer enn 13 mm (A4) og 17 mm (A3) fra kanten, ellers havner det under den hvite kanten.
