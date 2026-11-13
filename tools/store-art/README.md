# Bilder til Chrome Web Store

Dette verktøyet lager de fem skjermbildene (1280x800) og den lille kampanjeflisen (440x280) som brukes i Chrome Web Store. Bildene blir lagret i `media/store/`, og er PNG-filer uten gjennomsiktighet, slik Chrome Web Store krever.

Alle bildene av utvidelsen er ekte skjermbilder. Verktøyet legger bare til bakgrunn, overskrifter og rammer rundt dem.

## Skjermbilder som trengs

Verktøyet leser skjermbildene fra `media/raw/`. De er tatt med Playwright i et 1280x800-vindu med `deviceScaleFactor: 2`, mens utvidelsen var lastet inn:

| Fil | Innhold |
| --- | --- |
| `study-plan.png` | Studieplanen for 3. år datateknologi med Emnehjelper |
| `study-plan-without.png` | Den samme studieplanen uten Emnehjelper |
| `course-page-light.png` | Emnesiden til TDT4100 med panelet åpent |
| `panel-light.png` og `panel-dark.png` | Bare panelet, i lys og mørk modus |
| `about-popup.png` | Menyen som åpnes når man trykker på ikonet, 320 px bred |

Hvis NTNU endrer sidene sine, må utsnittene i `R` i `lib.mjs` kanskje justeres.

## Slik lager du bildene

```bash
npm install
npx playwright install chromium
npm run build
```

Tekstene står i `SCENES` i `build.mjs`. Hvis skjermbildene ligger et annet sted, kan du bruke `node build.mjs --raw=<mappe>`, og `--out=<mappe>` for å lagre bildene et annet sted.
