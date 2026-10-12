# Despeses de desplaçament

Els partits de lliga fora de casa i les eliminatòries / fases de grups de copa amb camp local cobren el viatge al club visitant en liquidar el resultat. També s'aplica als rivals amb pressupost. Les fases finals que el joc simula en pista neutral no utilitzen el club nominalment local com a destinació: queden excloses d'aquest càlcul.

El càlcul és una estimació per equilibrar el joc, no una tarifa real:

- Coordenades de referència per identificador dels 68 clubs (i cinc rivals virtuals), independents de noms editats i idioma. Distància en línia recta multiplicada per 1,2 com a aproximació de carretera. Si falten coordenades es pressuposen 350 km.
- Delegació entre 12 i 16 persones: plantilla més quatre membres del cos tècnic.
- Transport: 80 € de base més 0,85 € per quilòmetre d'anada i tornada. A partir de 900 km s'estima avió: 145 € per persona més 180 € de trasllats.
- Dietes: 6 € per persona per viatges locals, 18 € a partir de 150 km i 36 € si hi ha nit fora.
- Allotjament: una nit a partir de 450 km, 50 € per persona.
- Coeficient de mida del club segons reputació (1 a 5): 0,45 / 0,55 / 0,70 / 0,90 / 1,05. Representa diferents recursos de logística dins de l'economia simplificada del joc.

Tots els imports es converteixen a milers d'euros, igual que la resta del pressupost. La columna Viatges es resta del balanç, mostra si inclou allotjament i acumula els viatges de lliga i copa de la mateixa jornada. Les notícies detallen transport, dietes i hotel; Finances mostra una estimació del pròxim desplaçament de lliga.

No s'apliquen càrrecs retroactius als partits ja liquidats. El marcador travelPaid impedeix cobrar dues vegades el mateix partit; els registres de copa es comproven per fase i equips. Els llibres de finances antics sense el camp travel es llegeixen com a cost zero.

Un club pot tenir un saldo net positiu fora de casa si altres ingressos superen les despeses: el viatge sempre es descompta, sense anul·lar els patrocinis.

Verificació: npm run test:travel comprova distàncies, dietes, hotel, escales de club, pressupost, balanç, duplicats, copes, camps neutrals, la vista de finances i les partides antigues.
