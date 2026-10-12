# Hoquei Manager 27

Un fantasy d'hoquei patins de la lliga masculina de màxima categoria (temporada 2026-27), amb els noms dels jugadors, i un mode mànager a l'estil dels mànagers clàssics. Joc de fans, gratuït i sense ànim de lucre, fet per donar a conèixer l'hoquei patins.

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
- **Mànager:** portes un club de l'OK Liga o de l'OK Liga Plata (grups Nord i Sud, amb ascensos i descensos), amb alineacions, tàctica, fitxatges i finances. El mercat és obert tota la temporada i els fitxatges s'incorporen a l'instant. Les ofertes inclouen traspàs, sou, anys de contracte i condicions com feina a la ciutat, pis pagat, cotxe, estudis o promesa de titularitat. Es poden tenir diverses partides alhora; es desen al navegador i, si s'inicia sessió amb Google (Cloudflare D1), també al núvol per continuar-les des de qualsevol dispositiu.
  - **Competicions:** Supercopa d'Espanya, Copa del Rei, Lliga Europea (WSE Champions League) i Copa de la CERS (WSE Cup); a la femenina, Supercopa, Copa de la Reina i Lliga Europea femenina. Es juguen entre jornades.
  - **Pedrera:** els juvenils no poden pujar al primer equip d'entrada. Es poden cedir a Tercera, Segona o Primera Catalana i fer tecnificacions especialitzades (porters, tir, defensa, patinatge).
  - **Retirades:** a partir dels 37 anys els jugadors es poden retirar (se'ls pot convèncer). Des de la J18 es poden repescar exjugadors.
  - **Lliga de veterans:** com a alternativa als fitxatges cars, es poden fitxar jugadors de la Lliga Catalana de Veterans (+35), del Màster 50 (FECAPA) i de la Lliga Màster valenciana (màxim 3, sense traspàs i amb sou petit). Es cansen més que els joves i a final de temporada tornen al seu equip.
  - **Altres:** primes per guanyar, jugadors que volen sortir del seu club, filtres de mercat (preu i mitjana), destitucions, ofertes d'altres clubs a final de temporada i roda de premsa amb crònica del partit.
  - **Escut i fotos:** cada usuari pot posar l'escut del club i fotos dels jugadors. Només es guarden al seu navegador: no van a la partida, ni a l'exportació, ni al núvol.

## Posar-lo en marxa

### 1. Cloudflare Pages (web principal)
`node scripts/build-site.cjs` prepara `dist/`. Publica-la amb `wrangler pages deploy dist --project-name hoquei-manager27 --branch main`; no publiquis l’arrel del repositori. Vegeu PUBLICACIO_GRATUITA.md.

### 2. Partides del mànager al núvol (Cloudflare D1)
Configura Google Identity Services i `GOOGLE_CLIENT_ID` a Cloudflare Pages, com explica PUBLICACIO_GRATUITA.md. Les partides utilitzen D1; Firebase no és necessari per al mànager.

### 3. Firebase (Fantasy)
1. A <https://console.firebase.google.com> crea un projecte (per exemple, `hoqueimanager27`). No cal Google Analytics.
2. **Authentication** → *Sign-in method* → activa **Google**. A *Settings → Authorized domains*, afegeix `hoquei-manager27.pages.dev`.
3. **Firestore Database** → *Create database* (mode producció, regió `europe-west`). A la pestanya *Rules*, enganxa el contingut de `firestore.rules` i publica-les.
4. **Configuració del projecte** → *Les teves apps* → afegeix una app **Web**, copia l'objecte `firebaseConfig` i enganxa'l a `firebase-config.js`.

## Instal·lar-lo al mòbil
Obre https://hoquei-manager27.pages.dev/ al mòbil:
- **Android (Chrome):** menú ⋮ → *Instal·la l'aplicació* (o *Afegeix a la pantalla d'inici*).
- **iPhone (Safari):** botó de compartir → *Afegeix a la pantalla d'inici*.

S'obre a pantalla completa com una app i el mode mànager funciona sense connexió. La partida es desa al mateix mòbil.

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

## Dades
- OK Liga: plantilles FECAPA 2026-27 i estadístiques RFEP de tres temporades.
- OK Liga Plata 2026-27 (RFEP, grups Nord i Sud): plantilles, actes dels partits jugats (porters i cinc inicial) i estadístiques de 2025-26. Sense data de naixement: no es mostra l'edat ni el sou.
- Mercat internacional: una selecció d'estrelles de les lligues portuguesa, italiana i francesa amb el club segons la darrera informació coneguda.

## Avís legal

- Joc **no oficial**: no té cap relació amb la RFEP, la FECAPA, la competició ni els clubs. No fa servir escuts, logotips ni imatges.
- Inclou l'OK Liga, l'OK Liga Plata i l'OK Liga Femenina. Les joves promeses surten de les plantilles de les federacions catalana, gallega, madrilenya i valenciana.
- Els noms dels clubs, dels jugadors, de les jugadores i dels entrenadors només s'hi fan servir per identificar-los. Les **mitjanes, les qualitats dels tècnics, els sous, els valors i els preus són estimacions inventades pel joc** i no corresponen a dades reals de ningú.
- Dels jugadors menors d'edat no se'n mostra l'edat (surt «<18») ni el sou. El repositori no conté dates de naixement.
- Els resultats i estadístiques provenen de les webs públiques de la RFEP i la FECAPA, que se citen com a font.
- Fantasy: només es guarda un identificador del compte de Google, el nom de pila i els equips de cada usuari. No es guarda el correu. Cada usuari pot esborrar les seves dades des del mateix joc.
- És gratuït, sense publicitat i sense premis en diners.
- Si ets jugador o entrenador, o representes un club i vols que es corregeixi o es retiri alguna dada, obre una *issue* en aquest repositori.

## Publicació gratuïta i mòbil

Web principal: https://hoquei-manager27.pages.dev/. Consulta [PUBLICACIO_GRATUITA.md](PUBLICACIO_GRATUITA.md) per activar Firebase Spark sense facturació, instal·lar la PWA i entendre els límits gratuïts.

El contacte i el recompte privat d’instal·lacions utilitzen D1. Vegeu PUBLICACIO_GRATUITA.md per consultar-los al panell Cloudflare. El joc es publica únicament a Cloudflare; Netlify està retirat i l’antiga adreça de GitHub Pages només redirigeix a Cloudflare. El desament del mànager a D1 està implementat; cal configurar `GOOGLE_CLIENT_ID` per activar Google. El Fantasy Firebase continua pendent de configurar.
