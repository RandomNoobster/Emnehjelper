# Plakater

Dette verktøyet lager plakatene for Emnehjelper som PDF-filer som er klare til utskrift. Det lages to plakater, og de blir lagret i `media/posters/`:

| Fil | Bruk |
| --- | --- |
| `emnehjelper-plakat-A3.pdf` | Henges opp på veggen. Den har stor overskrift, ett bilde og en stor QR-kode, slik at den kan leses fra et par meters avstand. |
| `emnehjelper-plakat-A4.pdf` | Legges på bordene. Den forklarer mer om hva utvidelsen gjør, og viser hvordan man installerer den. |

Verktøyet lagrer også et JPG-bilde av hver plakat, som README-en viser. GitHub kan ikke vise PDF-filer direkte.

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

## Skarpere skjermbilder

Skjermbildene i `media/raw/` er tatt med dobbel oppløsning (2x). Det er nok for A4, men studieplanen på A3 blir bare skrevet ut med 176 dpi, så den kan se litt uskarp ut på nært hold. For å få skarpere plakater kan du ta de to skjermbildene på nytt med fire ganger oppløsning, og så lage plakatene på nytt:

```bash
cd ../store-screenshots
npm run shots -- --scale 4 study course-light
cd ../poster
npm run build
```

Da blir studieplanen skrevet ut med 352 dpi på A3. Det trengs ingen andre endringer, og bildene til Chrome Web Store ser ut som før.

## Tekst og plassering

Tekstene står i `T` øverst i `build.mjs`. På A4 velger verktøyet selv tekststørrelsen i kolonnen ved siden av panelet, slik at teksten fyller plassen over QR-kortet akkurat. Hvis du endrer teksten, blir størrelsen justert automatisk. `&shy;` i tekstene viser hvor lange sammensatte ord kan deles over to linjer. Hvis du flytter noe, må alt innhold være mer enn 13 mm (A4) og 17 mm (A3) fra kanten, ellers havner det under den hvite kanten.
