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
- **Dues parts i durada (estil FIFA):** el rellotge sempre marca 2 × 25 minuts útils, però el selector **Durada part** tria quants minuts reals dura cada part (3, 4, 5, 6, 7, 8, 9, 10, 15, 20 o 25 = temps real), com l’opció «Durada de la part» de l’EA FC. Per defecte, 5 minuts reals per part (partit de 10 minuts): el rellotge corre ×5. S’aplica a l’instant, fins i tot a mig partit, i es recorda al navegador. El rellotge de partit, les blaves (2 minuts de rellotge), el desgast i el descans corren a la velocitat del rellotge; el joc, els comptadors de 45/10/5 s i l’espera de les represes continuen en segons reals. Una represa al final de la part sempre disposa d’uns 5 segons reals. Hi ha un descans de deu minuts de rellotge que es pot saltar amb el botó corresponent, mantenint la recuperació dels jugadors i sense avançar sancions. La segona part canvia els extrems atacats i el servei inicial. Marcador, faltes i sancions es conserven; després de la segona part arriba el resultat final, amb empat permès.
- **Llançaments finals:** una directa o penal assenyalats amb menys de tres segons disposen de cinc segons. Un gol o una aturada en aquest supòsit tanca la part sense servei de centre.

La geometria s’ha contrastat també amb els articles 1–3 del reglament tècnic inclòs al PDF oficial. La gestió de suplents i inferioritats segueix els articles 2, 8, 24 i 31 de les regles de joc.

## Presentació professional (tercera tanda)

Tercera tanda implementada el 18 d’octubre de 2026, amb estil de retransmissió de TV:

- **Interfície:** sense barres de botons de prova. Pantalla de presentació (equips, durada i dificultat), menú de pausa amb pestanyes (Opcions, Càmera, Controls, Entrenament), pantalles de descans i final amb estadístiques (xuts, aturades, faltes i blaves) i botó de revenja. Els controls tàctils només apareixen en pantalles tàctils; al mòbil en vertical es recomana girar-lo.
- **Marcador i rètols:** marcador de televisió (equips, gols, part, rellotge, faltes i barra dels 45 s), avisos de reglament sota el marcador (sortida 10 s, camp propi 5 s, booling i inferioritat), rètols centrals per als avisos importants, notificacions breus al peu i grafisme de gol amb el golejador. El HUD es dibuixa a la resolució real de la pantalla.
- **Indicadors de joc:** fletxa sobre el jugador controlat, cercle verd sobre el receptor previst de la passada, arc de càrrega del xut amb la zona verda i targeta sobre el jugador sancionat. Els àrbitres només mostren etiqueta quan senyalitzen.
- **Gràfics:** il·luminació de pavelló amb mapa d’entorn procedural (reflexos al terra), pista de resina blava o parquet a més resolució, tanques d’1 m amb publicitat de patrocinadors ficticis, xarxes darrere les porteries, graderies amb públic animat (instàncies), sostre amb focus, marcador central i marcadors de 45 s que mostren el temps real de possessió. Qualitat automàtica (ordinador / mòbil) amb opció manual.
- **Jugadors i animacions:** proporcions més esveltes, samarretes amb ratlles, número davant i darrere i nom a l’esquena; celebració de gol amb l’estic enlaire, cap cot de l’equip que encaixa i reacció en perdre la bola per una entrada.
- **Sensacions:** so sintetitzat amb Web Audio (cops d’estic, tanca, pal, xiulet, ambient i crit de gol, sense fitxers externs), vibració al mòbil, sacsejada de càmera en xuts forts, pals i gols, i repetició del gol a càmera lenta amb càmera baixa (es pot saltar i desactivar).
- **IA rival:** decisions amb temps de reacció segons la dificultat; valora la qualitat del xut (distància, angle i línies lliures), apunta al pal que el porter deixa obert, tria passades segons desmarcatge i progrés, protegeix la bola del defensor més proper i té en compte el rellotge dels 45 s. En defensa combina el quadre zonal amb marcatge a l’home, pressiona per la línia bola-porteria, talla línies de passada i, en Difícil o si perd al final, avança la pressió. La dificultat (Fàcil, Normal, Difícil) ajusta també el porter rival.
- **Depuració:** amb `?debug` a l’adreça, `window.__okArcade` exposa l’estat per a proves visuals automàtiques.

## Reaccions i animacions (quarta tanda)

- **Aturades vives:** en xiular, ningú es queda congelat. Els jugadors frenen i encaren l'àrbitre; la víctima d'una entrada cau i s'aixeca; l'infractor alça la mà; un o dos companys (dos si és blava) s'acosten a protestar amb els braços oberts; la resta espera dreta (mans a l'estic o a la cintura). El sancionat marxa cap a la banqueta.
- **Represes visibles:** quan el motor recol·loca els jugadors (lliures, directes, penals, serveis i canvis), els models hi patinen en comptes d'aparèixer-hi. A la pista es marca el punt de la represa, la fletxa de l'equip que la treu i, en el lliure indirecte, el cercle de 3 m.
- **Àrbitre articulat:** encara l'acció, porta el xiulet a la boca, assenyala la direcció de la falta (o el punt de penal/directa), alça la targeta amb un braç i assenyala el jugador amb l'altre, indica el centre en un gol i aixeca els dos braços al booling.
- **Gol:** el golejador patina cap a la tanca celebrant-ho; els companys hi van i l'abracen; l'equip que encaixa abaixa el cap i torna lentament; el porter encaixat s'agenolla i pica l'estic; el que ha marcat celebra. La repetició arriba després de la celebració.
- **Joc:** la pala acompanya la bola real en conduir; el cap segueix la bola; el xut té recàrrega amb l'estic enrere, contacte i acabament pel costat contrari segons la potència; passada amb escombrada; recepció esmorteïda; entrada amb estocada i pas endavant; topades entre rivals; el porter s'estira cap al costat de l'aturada.
- **Rètols més clars:** «Falta de [jugador] · Lliure indirecte per al [equip]», «Targeta blava a [jugador] · [equip] juga amb un menys».

## Patinatge i estic (cinquena tanda)

- **Gambada d'hoquei patins:** genolls més flexionats; cada cama empeny cap enfora i enrere amb la punta oberta i el cantell interior a terra, i torna aixecada per sota del cos. El pes passa d'una cama a l'altra i les espatlles contrarroten.
- **Girs i frenades:** encreuaments (la cama de fora passa per davant) als girs tancats, lliscament amb peus paral·lels i frenada de costat amb els patins girats quan es perd velocitat de cop.
- **Estic sense bola:** a una mà mentre es patina ràpid, amb el braç lliure balancejant; el receptor d'una passada ofereix la pala cap a la bola; el defensor proper posa l'estic a terra cap a la bola del rival.
- **Conducció:** la pala acompanya la bola real amb tocs i el canell gira cap a on va.
- **Passada:** petita preparació, escombrada fins al cop i acabament apuntant al company, amb gir del tronc. La bola surt de la pala en el moment del cop.
- **Xut:** l'estic s'aixeca enrere fins a l'alçada de l'espatlla mentre es carrega, amb el tronc de costat; baixada ràpida, cop i acabament alt pel costat contrari. La IA també prepara el xut 0,3 s (es veu venir).
- **Protecció de la bola:** quan un rival s'acosta pel costat, el portador posa el cos i el patí entremig, aparta la bola al costat lliure i, si el rival ve per l'esquerra, porta l'estic a una mà i fa barrera amb el braç. Al motor, això fa que la bola quedi més lluny del defensor i costi més robar-la.

## Models 3D orgànics (sisena tanda)

- **Models nous** a `models/skater.glb` (patinadors i àrbitres) i `models/goalkeeper.glb` (porter), generats amb Blender per `scripts/build_players_blender.py` (`pip install bpy` i `python3 scripts/build_players_blender.py -- models`). Cos d'una sola malla corba (espatlles, pit, cintura, cuixes i bessons), cap esculpit amb nas, conques, pòmuls, barbeta, orelles i cabell, guants i genolleres. Esquelet de 19 ossos amb pesos automàtics.
- **Personalització per jugador:** samarreta de l'equip amb número i nom (UV pròpia), mànigues, pantalons i mitjons de l'equip, vuit tons de pell i de cabell, cara pintada amb ulls, celles i boca, barba en alguns jugadors. L'àrbitre fa servir el mateix model amb la camisa groga i negra.
- **Animació:** el joc continua calculant la postura (malucs, tronc, cap, genolls, peus, colzes i mans) i la trasllada als ossos amb cinemàtica inversa de dos ossos. L'estic, els patins, el casc, les guardes i els guants del porter continuen sent peces del joc.
- **Seguretat:** si els GLB o els carregadors no es poden obtenir, el joc continua amb els models geomètrics anteriors. Els carregadors (`GLTFLoader`, `SkeletonUtils` de three r128) s'obtenen de jsDelivr. La compilació copia la carpeta `models` a `dist/`.
- **Substituir-los:** qualsevol model fet a mà funciona si exporta en GLB, Y amunt, x endavant, amb els mateixos noms d'ossos (Hips, Spine, Chest, Neck, Head, Shoulder/UpperArm/ForeArm/Hand.L/R, Thigh/Shin/Foot.L/R) i materials (Jersey, Sleeve, Shorts, Socks, Skin, Face, Hair, Glove, Pad).

## Simplificacions i següents millores

1. **Canvis amb joc en moviment.** L’intercanvi actual es fa instantàniament amb el joc aturat o en pausa. Queda pendent animar la sortida i entrada per les portes sense interrompre el joc.
2. **Represes completes.** Els indirectes mantenen la bola immòbil i els rivals a 3 m (mesurats fins al cos del jugador) fins a la passada, amb la bola almenys a 70 cm de la tanca, també als córners arrodonits. La IA executa la passada i es pot substituir l’executor. La represa força una passada a un company; l’executor no pot recuperar-la fins que un altre jugador la toqui, encara que passin segons o reboti a la tanca. Falta el límit de temps per executar i l’excepció del rebot a l’exterior de la porteria. En directes i penals, tots esperen immòbils 1,8 s abans del xiulet (inclòs el porter defensor); el xiulet allibera simultàniament el llançador i els altres jugadors, i reinicia el cronòmetre. La resta espera dins l’àrea de l’altra mitja pista. Falta arbitrar el transport darrere la porteria. La detecció d’ocasió manifesta és una aproximació geomètrica.
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

## Ajust del ritme de patinatge

L’arcade continua en desenvolupament a `feat/arcade`, sense fusió a `main` ni desplegament públic.

El ritme inicial passa de Pausat a **Equilibrat**. El selector ofereix Tranquil, Equilibrat i Ràpid. S’ha augmentat moderadament l’acceleració del jugador controlat i s’han unificat la velocitat base i el lliscament de la IA amb els del jugador, conservant els atributs, l’esprint i el cansament.

En una prova rectilínia a 60 passos de simulació per segon i sense altres jugadors que interfereixin, el jugador recorre 20 metres en **3,97 segons**, davant dels **5,85 segons** anteriors. La IA també arriba abans a les pilotes dividides. Són mesures del motor en una prova aïllada, no estadístiques de partits reals.

El bucle accepta ara fins a 200 ms acumulats per fotograma en lloc de 50 ms: així una baixada a 10 FPS no redueix la velocitat de tota la simulació. Les aturades llargues continuen limitades per evitar recuperacions sobtades. S’ha corregit també l’arrodoniment de l’acumulador de passos.

Les 46 proves arcade inclouen comparació de moviment i rellotge a 10, 30, 60 i 144 FPS, recorregut de 20 metres amb els tres ritmes i persecució de pilota dividida per part de la IA.


### Identificació del jugador

Els noms ja no es projecten sota els jugadors. Un panell fix inferior mostra el dorsal, nom, equip i energia del jugador controlat, i la potència mentre carrega el xut. S’actualitza amb els canvis de control i les substitucions. En mòbil queda per sobre del joystick per evitar superposicions; es conserva l’anell de selecció a la pista.


### Booling (World Skate 2027, articles 6 i 13)

Represa neutral amb dos patinadors elegibles, un per equip, mirant cap a la seva direcció d’atac i amb els estics a 20 cm de la bola. La resta manté 3 m fins al xiulet. Aturada de l’àrbitre, col·locació i espera de 1,8 s amb el rellotge aturat; després del xiulet tothom pot disputar la bola. El jugador humà participa amb moviment o Passa/Roba; la IA té un temps de reacció i no rep una possessió predeterminada. La primera recepció estableix possessió i reinicia els comptadors.

Detecció automàtica de bola lenta atrapada entre les proteccions del porter, bola lenta retinguda a l’exterior de la porteria i impacte al sostre virtual (8 m). Una bola que queda quieta en pista lliure o un rebot normal no provoquen booling. Es detecten també dos intents d’entrada d’estic amb contacte frontal simultani fora de les àrees; aquesta identificació de doble falta és una aproximació geomètrica. Si només un equip arriba al cicle de directa per acumulació, preval la directa; si els dos hi arriben, es cancel·len i hi ha booling. Les blaves simultànies no es modelen en aquesta detecció.

Al porter, xarxa i zona de darrere la línia de gol, es desplaça la represa al cantó de l’àrea més proper; un impacte al sostre porta al centre. La separació de l’estic es calcula amb l’offset visual de 15,5 unitats; al costat de la tanca s’ajusta el punt prou per encaixar els dos cossos. La retenció es modela amb contacte de baixa velocitat (menys de 0,65 unitats/pas), perquè el prototip no simula malles deformables ni proteccions articulades.


### Primera millora dels models i el patinatge

Models procedurals de patinadors amb proporcions menys caricaturesques, tors afuat, cap més petit, genolleres i quatre rodes visibles. Cames amb cinemàtica de dos segments: genoll flexionat i patins recolzats al parquet, impuls lateral i recuperació curta. La inclinació es fa amb el tronc i no tombant tot el cos sobre els patins. Colzes articulats i mans que segueixen el mateix estic en conducció, càrrega i continuació de passada/xut. Rodes animades segons la velocitat i transicions d’impuls a lliscament suaus.

Interpolació entre passos de física per a jugadors, àrbitres i bola (inclòs l’angle per la ruta curta). Les recol·locacions grans es fan sense arrossegament visual. Canvis de selecció, pausa i regles conserven la simulació de 60 Hz i les velocitats anteriors. Millor tractament del color sRGB, to de la llum i ombres. Els porters s’han refet en una iteració posterior, descrita a continuació. No són models escanejats ni animacions capturades; una següent fase amb assets humans riggejats i clips de patinatge permetria un salt de qualitat més gran.


### Models i animació dels porters

Silueta més proporcionada amb samarreta de porter, malucs i coll, casc compacte i reixa metàl·lica oberta. Guardes i guants amb perfils arrodonits i detalls de costures; patins de quatre rodes sota les guardes. Genolls i colzes de dos segments connecten malucs, peus i mans. L’estic segueix la mà dreta i manté la pala baixa davant de les guardes.

Les quatre postures existents (pantalla, sortida, genoll a terra i pas de tanca) comparteixen un esquelet i una transició exponencial independent del refresc. Cada postura defineix totes les coordenades: no persisteixen rotacions de l’aturada anterior. Les guardes roten sobre l’extrem del patí i els patins es mantenen recolzats, amb inclinació lateral suau en els desplaçaments. També s’unifica el color sRGB de la pista de fusta. No es modifiquen ni els radis d’aturada ni la IA, la velocitat o les regles de booling. Els models continuen sent procedurals, sense animació capturada.


### Passades assistides i recepció

El botó de passada sempre selecciona un company de pista elegible: prioritza la direcció d’entrada i, si no hi ha ningú en aquell sector, el company més proper. La mateixa passada assistida s’aplica a la IA: bola rasa dirigida al receptor real, velocitat mantinguda durant el trajecte i correcció d’angle limitada. Ja no s’apunta a una estimació avançada de la posició que enviava la bola a l’espai. El receptor de la IA s’acosta a la passada i el jugador humà passa a controlar el destinatari. El marge de recepció és lleugerament més ampli per al destinatari, mantenint les intercepcions per contacte del rival més proper.

Com a decisió de jugabilitat, qualsevol passador queda exclòs de la recuperació automàtica i de l’acció de robar fins que un altre jugador toqui la bola; la IA tampoc el fa perseguir la seva passada. El bloqueig no és un temporitzador i no es cancel·la per un rebot a la tanca. El contacte d’un altre jugador o porter l’allibera. Una represa nova, un gol o final de part netegen l’estat. L’assistència s’atura en tocar un porter, un pal o la tanca, si el destinatari deixa de ser elegible o si passen 4,5 segons: no es corregeixen passades de manera indefinida ni després d’un rebot. No s’arbitra com una nova falta reglamentària.


### Canvi de jugador i transició defensiva

En atac el control es manté al portador i, durant una passada, al receptor. En perdre la possessió hi ha una sola selecció automàtica del defensor més útil segons la distància a la jugada prevista i la posició entre la bola i la pròpia porteria. La passada interceptada també activa aquesta transició. Les passades posteriors entre rivals no provoquen salts de control.

Q, Tab i el nou botó Canvia seleccionen un altre patinador elegible, prioritzant la intercepció i descartant porters, jugadors no disponibles i el passador que encara no pot recuperar la seva passada. Diverses pulsacions ràpides recorren les opcions sense alternar només dos jugadors. Un petit triangle blanc mostra el candidat del pròxim canvi, sense noms flotants. El panell inferior continua identificant el jugador controlat.

Els patinadors que queden avançats repleguen cap al bloc defensiu amb una ruta prioritària que no és sobreescrita per la IA posicional. Frena primer la inèrcia d’atac i es manté la recuperació fins arribar a una posició útil, encara que s’esgoti el temporitzador antic. En recuperar la possessió tornen a les funcions d’atac. No es modifica la velocitat base de patinatge.


### Xut amb més força i gest automàtic
- Un sol control K/X o botó XUT: carregar i deixar anar. Força més diferenciada de les passades i menys dependent del ritme de patinatge; model compartit amb la IA i les directes.
- Pala/cullera segons costat corporal de la bola i orientació del llançament; gest fixat en començar a carregar, sense oscil·lar amb el driblatge. Animació de preparació, tronc i acompanyament a cada costat, amb una elevació moderada diferenciada. Cap gest té penalització de potència.
- Preferència de costat comuna del prototip, no dades reals de lateralitat dels jugadors. La distinció de costats es basa en el material educatiu [HA OK](https://repositori.educacio.gencat.cat/bitstream/handle/20.500.12694/3377/ha_ok_2018.pdf?isAllowed=y&sequence=1). Velocitats i elevació són calibratge de joc.
- Es conserven apuntat, càrrega, bloqueig abans del xiulet i dispersió per sobrecàrrega. Canvis locals a feat/arcade, sense publicar.
