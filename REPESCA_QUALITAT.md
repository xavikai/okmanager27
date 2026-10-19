# Qualitat dels exjugadors de repesca

La mitjana és una estimació editorial de la qualitat esportiva; no és una puntuació oficial. La trajectòria i el palmarès justifiquen diferències entre els candidats. No s’aplica una pujada indiscriminada als veterans amateurs.

| Jugador | Mitjana de repesca | Fonament |
|---|---:|---|
| Marc Torra | 92 | Quatre Mundials, dos Europeus, quatre Copes d’Europa i tres OK Lligues; Tordera, Lloret, Vic, Barça, Benfica, Reus i Oliveirense. |
| Sergi Panadero | 92 | Vint-i-una temporades al Barça; el comunicat de comiat comptabilitza 67 títols, incloses vuit Lligues Europees. |
| Jordi Bargalló | 91 | Quatre Mundials, quatre Europeus, tres Champions i MVP de l’OK Lliga 2013; Noia, Liceo, Igualada i Oliveirense. |
| Jordi Adroher | 90 | Tres Mundials, tres Europeus i Champions amb el Benfica; trajectòria a l’elit espanyola, italiana i portuguesa. |
| Jaume Llaverola | 88 | Porter d’Igualada, Barça, Liceo i Girona, entre altres; campió de Copa d’Europa, Lliga i Copa del Rei. |
| Jepi Selva | 88 | Copa del Rei i CERS 2013 amb el Vendrell; segon a l’MVP 2013. Actualment a l’HC Valls, després de deixar l’elit. |
| Aleix Esteller | 85 | Dinou temporades al Noia; Copa del Rei 2008, CERS i Continental 2014 i Lliga Catalana 2023. |

Les fonts s’inclouen a `data/comeback-careers.json` i es mostra la trajectòria al mercat, en català i castellà.

## Com es trasllada al joc

- Les valoracions dels perfils documentats substitueixen les estimacions antigues. La resta de candidats de l’arxiu conserven la seva mitjana de base. Els retirats durant la simulació conserven la seva última qualitat, sense restar-los automàticament dos punts per any d’absència.
- El fitxatge respecta la mitjana anunciada. Els retirats tenen menys físic, mentre es calibren els atributs tècnics per mantenir aquesta mitjana.
- Els exjugadors realment retirats gasten més energia mentre juguen: entre 12 i 24 punts addicionals per 50 minuts, segons l’edat; els porters en gasten la meitat. Se suma al desgast ja existent per edat i pressió. El mateix càlcul per minuts s’utilitza a la lliga ràpida, al partit en directe i a les copes. El cansament afecta el rendiment dels trams següents. La banqueta no rep aquest desgast addicional.
- Els jugadors encara en actiu en altres clubs no es presenten com a retirats ni reben la penalització addicional de retorn. Mantenen el desgast ordinari de l’edat.
- Una migració única corregeix els repescats ja fitxats sense tocar els resultats, gols, partits, lesions, energia, salaris o contractes. Els veterans de lligues amateurs queden exclosos.
- Es manté l’envelliment normal de les temporades, els límits de repesca i les regles existents de renovació.

## Validació

`node --test tests/comeback-quality.test.mjs` comprova valoracions, palmarès en dos idiomes, les dues vies de contractació, cansament per minuts, banqueta, migració idempotent i absència de duplicats amb àlies de jugadors en actiu.
