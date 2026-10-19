# OK Liga Plata Femenina

Segona categoria estatal femenina d’hoquei patins. Divisió `FP`, separada de les masculines i de la màxima femenina (`FEM`).

## Font federativa i criteri d’incorporació

Consulta del 18/10/2026 a [RFEP, OK Liga Plata Femenina 2026/27](https://www.hockeypatines.fep.es/league/3571), apartat Plantillas. Hi consten 169 jugadores dels 14 clubs. Les 28 actes de les jornades 1–4 acrediten 148 jugadores; actes històriques i fonts federatives addicionals permeten incorporar-ne 19 més.

S’incorporen **167 jugadores reals** amb demarcació contrastada. La marca «P» acredita la porteria; les inferències a partir de convocatòries o estadístiques s’expliquen individualment a [les evidències](data/female-plata-position-evidence.json). Si una jugadora figura tant de pista com de portera, s’utilitza la demarcació més habitual. No s’han afegit suplents fictícies per completar plantilles de 12.

Continuen pendents Laura González García (HC Ponteareas) i Stela Toro Rabioli (CP Patín Raspeig): les fonts trobades no n’acrediten la demarcació. Es documenten a data/female-plata-rosters.json sense assignar-los una posició inventada.

| Club | Jugadores incorporades | Porteres |
|---|---:|---:|
| Tres Cantos PC | 12 | 2 |
| CP Las Rozas | 11 | 2 |
| CP Mieres | 12 | 3 |
| Traviesas HC | 11 | 3 |
| CP Patín Raspeig | 11 | 3 |
| DP Berenguela | 14 | 3 |
| CP Alcorcón | 15 | 3 |
| CP Alcalá Hockey | 9 | 2 |
| Colegio Virgen de Europa | 10 | 2 |
| Coslada RH | 11 | 2 |
| HC Ponteareas | 12 | 4 |
| Oviedo Roller HC femení | 15 | 3 |
| Gatikako Iusturi | 12 | 3 |
| Santutxu Hockey Taldea | 12 | 2 |

Noms complets, identificadors RFEP, nacionalitats i equips provenen de la font federativa. Les edats no contrastades es mostren amb un guió. Mitjanes, pressupostos i colors són estimacions editorials. No s’han importat gols ni partits oficials com si fossin resultats de la partida.

Les pantalles de selecció, confirmació, plantilla i mercat expliquen la font i les estimacions. L’actualitzador de federacions incorpora la competició 3571; les demarcacions contrastades queden protegides contra correccions antigues incorrectes.

## Regles del mànager

Doble volta: 26 jornades i 182 partits. Les dues primeres no filials pugen a `FEM` i les dues últimes de `FEM` baixen a `FP`. Es mantenen 14 clubs per categoria. No se simulen autonòmiques, ni la Copa de la Princesa. Les copes de la màxima categoria mantenen la seva elegibilitat.

Les partides antigues reben els clubs sense alterar resultats ni jugadores existents. Abans del primer partit s’activa el calendari; amb la temporada iniciada o acabada, s’activa en començar la següent. La migració és idempotent i respecta els ascensos simulats.

Les jugadores simulades de la versió anterior es substitueixen una sola vegada, mantenint els identificadors disponibles, estadístiques, energia, lesions i contractes. Els registres ficticis sobrants queden arxivats a la partida i fora de la plantilla activa. Les jugadores reals transferides i els noms personalitzats es conserven.

## Validació

`node --test tests/female-plata.test.mjs`: selector en català/castellà, avisos, demarcacions, separació de mercats, desplaçaments, calendari, migració abans/durant/després de temporada, ascensos, descensos, desament i canvi de temporada amb el motor real.

La versió hm27-v49 afegeix les 19 jugadores contrastades a les partides de la temporada inicial, sense alterar resultats, alineacions, fitxatges ni estadístiques. Les temporades futures no recuperen jugadores històriques.
