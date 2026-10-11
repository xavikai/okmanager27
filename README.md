# OKManager27

El Fantasy de l'OK Liga masculina d'hoquei patins (temporada 2026-27), amb els jugadors reals, i un mode mànager a l'estil del PC Fútbol.

## Què hi ha al repositori

| Fitxer | Què és |
|---|---|
| `index.html` | El joc sencer (HTML, CSS i JavaScript, sense dependències de compilació) |
| `firebase-config.js` | Configuració de Firebase per a les lligues del Fantasy |
| `firestore.rules` | Regles de seguretat de la base de dades |
| `data/config.json` | Calendari oficial de l'OK Liga 2026-27 (RFEP) |
| `data/pts/` | Estadístiques de cada jornada jugada (`index.json` diu quines jornades estan tancades) |

## Modes de joc

- **Fantasy:** lligues amb amics. Cada mànager té 35 M per fer una plantilla de 8 jugadors (2 porters i 6 de pista), alinea cinc titulars i un capità cada jornada, i suma punts segons el que fan els jugadors als partits reals o simulats.
- **Mànager:** portes un club, amb alineacions, tàctica, fitxatges i finances. La partida es desa al navegador.

## Posar-lo en marxa

### 1. GitHub Pages
Settings → Pages → Source: *Deploy from a branch* → branca `main`, carpeta `/ (root)`. El joc queda a `https://<usuari>.github.io/okmanager27/`.

### 2. Firebase (només per al Fantasy)
1. A <https://console.firebase.google.com> crea un projecte (per exemple, `okmanager27`). No cal Google Analytics.
2. **Authentication** → *Sign-in method* → activa **Google**. A *Settings → Authorized domains*, afegeix `<usuari>.github.io`.
3. **Firestore Database** → *Create database* (mode producció, regió `europe-west`). A la pestanya *Rules*, enganxa el contingut de `firestore.rules` i publica-les.
4. **Configuració del projecte** → *Les teves apps* → afegeix una app **Web**, copia l'objecte `firebaseConfig` i enganxa'l a `firebase-config.js`.

## Actualitzar els punts reals
Després de cada jornada es crea `data/pts/jN.json` a partir de les actes de la RFEP, i s'afegeix N a `data/pts/index.json`. Format:

```json
{"j":1,"closed":true,
 "players":{"BAR-marc-grau":{"pl":1,"st":1,"g":2,"a":1,"bl":0,"rd":0,"res":"W","ga":0}},
 "matches":[["REU","CAL",4,2]]}
```

- `pl`: ha jugat
- `st`: ha sortit al cinc inicial
- `g`: gols
- `a`: assistències
- `bl`: targetes blaves
- `rd`: targetes vermelles
- `res`: resultat de l'equip (`W` victòria, `D` empat, `L` derrota)
- `ga`: gols encaixats (només per al porter)

L'id de cada jugador és `CLUB-nom-en-minúscules-amb-guions`.

## Fonts de les dades
- Plantilles 2026-27: FECAPA (Frit Ravich Lliga Catalana) i RFEP.
- Mitges: estadístiques de les OK Liga 2023-24, 2024-25 i 2025-26, i de l'OK Liga Plata 2025-26 per als equips ascendits.
- Calendari: RFEP. Les jornades 13, 25 i 26 encara tenen data provisional.

Les mitges, els preus i els sous són estimacions del joc. No són dades oficials.
