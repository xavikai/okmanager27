# Web, instal·lació al mòbil i partides al núvol

La web principal és https://hoquei-manager27.netlify.app/. Netlify publica únicament els fitxers de `dist/`; el codi es manté a GitHub i la web anterior es conserva per als provadors. El joc s’instal·la des del navegador com a PWA: Android/Chrome ofereix la instal·lació quan el navegador ho permet; iPhone/iPad fa servir Safari → Compartir → Afegeix a la pantalla d’inici. No cal publicar a les botigues ni pagar per cada instal·lació.

## Configuració sense facturació automàtica

1. Crea un projecte a https://console.firebase.google.com/ amb el pla **Spark**, sense vincular un compte de facturació. No activis Blaze ni serveis que el requereixin.
2. Registra una aplicació web i copia l’objecte `firebaseConfig` a `firebase-config.js`, substituint `null`. És configuració pública de l’app; no cal ni s’ha d’incloure cap clau privada de servidor.
3. A Authentication → Sign-in method, activa Google i configura el correu de suport. A Settings → Authorized domains, afegeix `hoquei-manager27.netlify.app` i el domini de l’altra web si els provadors també hi inicien sessió.
4. Crea **Cloud Firestore Standard**, en mode producció, en una regió europea. Publica-hi el contingut de `firestore.rules`. Pujar aquest fitxer a GitHub no desplega les regles a Firebase.
5. Desplega la configuració web a Netlify. La memòria cau tracta `firebase-config.js` com a fitxer que es renova amb connexió.
6. Prova una partida amb Google, prem «Desar al núvol ara», i recupera-la des d’un altre navegador amb el mateix compte. Comprova que un altre compte no pot llegir-la ni modificar-la.
7. A Firebase comprova que el projecte continua en **Spark** i revisa Usage. Si algun dia cal ampliar la capacitat, decideix-ho explícitament abans de vincular facturació.

## Límits i capacitat

Límits consultats el 12 d’octubre de 2026:

| Servei | Quota gratuïta rellevant |
| --- | --- |
| Netlify Free | 300 crèdits al mes, compartits pels projectes de l’equip; límit estricte sense recàrrega automàtica |
| Firestore Standard | 1 GiB de dades; 50.000 lectures, 20.000 escriptures i 20.000 eliminacions al dia; 10 GiB de sortida al mes |

Fonts: https://www.netlify.com/pricing/, https://firebase.google.com/pricing i https://firebase.google.com/docs/projects/billing/firebase-pricing-plans.

Amb Spark, excedir una quota limita el servei; no activa cobrament per excés. El joc conserva el desament local i l’exportació de partides encara que el núvol no estigui disponible. Netlify Free pausa els projectes de l’equip si s’esgoten els crèdits; no factura excessos. El compte existent s’ha verificat com a credit-free amb auto_topup_enabled=false.

Les instal·lacions no tenen una tarifa individual. Els desplegaments de producció, el trànsit i les peticions consumeixen crèdits Netlify. No hi ha una xifra garantida de jugadors: depèn de la mida de les partides, de la freqüència de còpies i de l’ús del Fantasy. Exemple orientatiu: si cada còpia comprimida cap en un sol document, costa 2 escriptures (partida + índex). A 10 còpies per persona i dia, 1.000 jugadors consumirien les 20.000 escriptures diàries, sense marge per al Fantasy ni altres operacions. Són hipòtesis de càlcul, no capacitat mesurada. També s’ha de vigilar l’espai i el trànsit.

Les còpies automàtiques s’agrupen per partida: primera tanda després de 30 segons, tandes posteriors amb un interval mínim de 2 minuts. «Desar al núvol ara» permet fer la còpia abans de canviar de dispositiu. Les fotos i els escuts personalitzats continuen al dispositiu i no ocupen la base de dades.

## Estat

La instal·lació web i el desament local estan disponibles. El desament al núvol necessita completar la configuració Firebase anterior: mentre `window.FIREBASE_CONFIG` sigui `null`, no hi ha base de dades connectada.

## Canvi d’adreça i publicació

Les partides locals de la web anterior no passen automàticament a Netlify: exporta-les a un fitxer des de la web anterior i importa-les a la nova. El desament al núvol encara requereix configurar Firebase.

Executa `node scripts/build-site.cjs` i desplega `dist/` al lloc Netlify `hoquei-manager27` (id `c7e403eb-0050-4678-a5a8-12c8d03bb191`). El desplegament actual és manual: fer push a GitHub no actualitza Netlify automàticament. `netlify.toml` ja deixa preparada la compilació si més endavant es connecta el repositori.

Els avisos de contacte es consulten al panell de Netlify → Forms → contacte-joc. No hi ha notificacions de correu configurades per aquest canvi.
