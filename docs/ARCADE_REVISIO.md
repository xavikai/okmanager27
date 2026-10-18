# Revisió del prototip 3D · feat/arcade

Revisió del 18 d’octubre de 2026. Abast: `arcade.html`, `arcade.js` i la inclusió del prototip a la compilació web. El mode de gestió queda fora d’aquesta revisió.

## Diagnòstic

El prototip ja té escena 3D, patinatge amb inèrcia, passades, càrrega de xut, porters i IA posicional. La prioritat és estabilitzar les regles i les transicions abans d’afegir més detalls gràfics.

| Prioritat | Problema trobat | Resultat d’aquesta revisió |
| --- | --- | --- |
| Alta | El rellotge arribava a zero i es podia continuar jugant | Final explícit, resultat persistent i bloqueig de gols posteriors |
| Alta | Velocitat física calculada per fotograma | Simulació fixa de 60 passos per segon, independent del refresc del monitor |
| Alta | Directes preparades només per al Barça; el rival rebia possessió | Executor, direcció i tir automàtic del rival; penal diferenciat |
| Alta | La blava sempre retirava el jugador d’índex 1 | Sanció sobre l’infractor real; queda fora de control, passades, intercepcions i col·lisions |
| Alta | Qualsevol blava donava directa i durava 25 segons | Suspensió de 120 segons útils; represa segons situació; tercer blau comporta expulsió |
| Alta | Un gol cancel·lava la inferioritat | La sanció es compleix sencera |
| Alta | Un gol podia comptar entrant per darrere, parcialment o per sobre del travesser | Comprovació del pas complet de la bola pel pla frontal, entre pals i sota el travesser |
| Alta | Temporitzadors antics podien alterar un partit acabat de reiniciar | Represes governades per la simulació i cancel·lades amb Nou partit |
| Alta | La compilació web ometia els dos fitxers arcade | `build-site.cjs` els incorpora a `dist/` |
| Mitjana | No hi havia pausa ni reinici complet | Pausa amb P/Escape i botó; pausa en perdre el focus; neteja de tecles i controls tàctils |
| Mitjana | Faltes ordinàries sense canvi real de possessió; reinici des del centre | Represa al lloc de la falta amb separació inicial dels rivals |
| Mitjana | Penalització automàtica inventada de cinc segons darrere la porteria | Eliminada; es manté el control general de possessió |
| Mitjana | HUD mínim de 640 píxels en pantalles petites | Mida real de pantalla, escala del HUD i joystick associat al seu punter |

## Criteri reglamentari

Fonts oficials consultades:

- [World Skate · Reglament de joc 2027, actualització juny 2026](https://www.worldskate.org/rink-hockey/about/regulations.html?download=8907:rink-hockey-reglamento-de-juego-2027).
- [World Skate · Aclariments de gener 2026](https://www.worldskate.org/rink-hockey/about/regulations.html?download=8268:clarifications-rink-hockey-rulebook).
- [Índex vigent de normativa World Skate](https://www.worldskate.org/rink-hockey/about/regulations.html).

Referències principals: arts. 3–4 (temps i possessió), 23 (directa a la desena falta i cada cinc posteriors), 24 (blaves), 27–30 (represes) i 31 (inferioritat). El reglament complet de juny 2026 és la referència principal d’aquesta implementació; els aclariments de gener són context addicional.

## Banqueta, dimensions i partit complet

Segona tanda implementada el 18 d’octubre de 2026:

- **Deu jugadors per equip:** dos porters i vuit patinadors. Els cinc suplents nous de cada equip tenen noms genèrics i l’etiqueta «demo»; no es presenten com a esportistes reals.
- **Canvis reversibles de porter i patinadors:** botó **Banqueta** o tecla **B**, selecció del jugador que surt i del que entra i botó **Fes el canvi**. El partit es pausa durant la selecció. Es conserven la posició, el control i el rellotge. No es pot fer entrar un jugador suspès, expulsat o que ja sigui en pista, ni canviar un porter per un patinador. Es poden tornar a utilitzar els jugadors substituïts.
- **Descans i desgast:** la frescor baixa amb el temps en pista i es recupera a la banqueta i al descans. El rival pot canviar patinadors cansats en els serveis de centre.
- **Sancions separades:** les suspensions personals corren independentment dels períodes consecutius d’inferioritat. Una nova blava pot requerir un suplent mentre l’equip continua amb tres patinadors i porter. La falta de quatre jugadors aptes, inclòs un porter, suspèn el partit.
- **Escala única:** 25 unitats de simulació per metre, compartides pel dibuix i les decisions del motor. Pista de 40 × 20 m i cantonades de 3 m; obertura de porteria d’1,70 × 1,05 m; línia de gol a 2,70 m de la tanca; àrea de 9 × 5,40 m; cercle central de 3 m; punts de penal i directa a 5,40 i 7,40 m. El diàmetre dels pals és de 7,5 cm. La bola i els pals utilitzen les mateixes dimensions a la malla i a les col·lisions.
- **Dues parts:** per defecte, 2 × 25 minuts útils. El selector permet preparar un partit arcade de 2 × 3 minuts; la selecció s’aplica amb **Nou partit**. Hi ha un descans de deu minuts que es pot saltar amb el botó corresponent, mantenint la recuperació dels jugadors i sense avançar sancions. La segona part canvia els extrems atacats i el servei inicial. Marcador, faltes i sancions es conserven; després de la segona part arriba el resultat final, amb empat permès.
- **Llançaments finals:** una directa o penal assenyalats amb menys de tres segons disposen de cinc segons. Un gol o una aturada en aquest supòsit tanca la part sense servei de centre.

La geometria s’ha contrastat també amb els articles 1–3 del reglament tècnic inclòs al PDF oficial. La gestió de suplents i inferioritats segueix els articles 2, 8, 24 i 31 de les regles de joc.

## Simplificacions i següents millores

1. **Canvis amb joc en moviment.** L’intercanvi actual es fa instantàniament amb el joc aturat o en pausa. Queda pendent animar la sortida i entrada per les portes sense interrompre el joc.
2. **Represes completes.** Els indirectes es resolen donant la bola a un executor; falten la immobilitat prèvia i el control del segon toc. En directes i penals, la resta queda quieta fins al xut. Falta arbitrar el transport darrere la porteria. La detecció d’ocasió manifesta és una aproximació geomètrica.
3. **Física i porters.** La forma de la carcassa posterior de la porteria encara és una aproximació. Cal completar el contacte amb el travesser i la xarxa, trajectòries aèries i col·lisions contínues.
4. **Competició, disciplina i IA.** Falten temps morts, pròrrogues, tandes de desempat, registre de grogues i detecció d’infraccions molt greus. Cal afinar cobertures, suport al portador i decisions segons marcador.
5. **Presentació i distribució.** Revisió visual en ordinador i mòbil, rendiment amb GPU real, contrast i teclat. Three.js es carrega d’un CDN: no es garanteix el funcionament arcade sense connexió.

## Verificació

```sh
node --check arcade.js
node --test tests/arcade-rules.test.mjs tests/arcade-runtime.test.mjs
node scripts/build-site.cjs
```

Les proves de regles executen les funcions del motor de producció amb la renderització substituïda. La prova d’arrencada executa el fitxer complet amb DOM i GPU simulats. Inclou comparació de moviment i rellotge a 30, 60 i 144 FPS. Cap d’aquestes proves substitueix una comprovació visual amb WebGL real.

La segona tanda passa 43 proves locals: canvis de patinadors i porters, retorns sense duplicar identitats, suspensions i sancions consecutives, canvi de camp i gols dels dos equips a la segona part, descans manual i automàtic, recuperació, punts de llançament, final de les dues parts, interacció amb el diàleg de banqueta i compilació web.

## Comprovació visual independent

Comprovació completada el 18 d’octubre de 2026 amb un navegador headless aïllat i Three.js real sobre WebGL per programari (SwiftShader). No s’han utilitzat les finestres obertes ni els perfils personals de Chrome o Edge.

S’han capturat i inspeccionat la pista completa de la primera part, la selecció i confirmació del canvi d’Aragonès (#55) per Reserva 1 (#31), la pista després del canvi, el descans i la segona part. El porter del Barça passa de l’esquerra a la dreta; el del Reus fa el canvi contrari. El marcador indica la segona part i els models 3D coincideixen amb les posicions del motor.

La prova utilitza una còpia servida en memòria amb un ganxo d’observació. Només s’escurça el rellotge final de la primera part per evitar esperar 25 minuts; es comproven la transició real al descans i el botó d’inici de la segona part. El navegador no ha registrat errors JavaScript. Les captures i el registre de la prova són a la carpeta de treball `arcade-season/visual-qa-corrected/`.

La primera inspecció va detectar models inicials sense sincronitzar en pausa i una panoràmica que retallava la pista. S’ha separat l’actualització visual de la simulació, inicialitzat la càmera i els models abans del primer fotograma i ajustat la panoràmica a la mida de la pista i la proporció de pantalla. La pausa conserva ara el rellotge però permet veure canvis de càmera i de jugadors. S’ha afegit una prova de regressió específica.

Queden pendents el rendiment amb GPU física i una revisió visual completa en dispositius mòbils. No s’ha publicat cap desplegament.
