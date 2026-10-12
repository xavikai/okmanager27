# Publicació del joc a Cloudflare

Web principal: https://hoquei-manager27.pages.dev/. El joc continua sent una PWA instal·lable des d’Android/Chrome i iPhone/Safari. La web anterior de Netlify es conserva durant la migració; les partides locals s’han d’exportar des d’allà i importar a la nova adreça.

## Web i serveis privats

Cloudflare Pages serveix els fitxers estàtics. `_routes.json` limita les funcions a `/api/*`: les visites, la instal·lació i el joc local no consumeixen la quota de funcions. Les estadístiques i el contacte utilitzen Cloudflare D1, a la base `hoquei-manager-metrics`, creada a Europa occidental.

No s’han activat plans de pagament. Pages ofereix peticions estàtiques gratuïtes il·limitades, amb altres límits de plataforma i condicions d’ús. Workers Free i D1 Free tenen quotes separades: esgotar-les pot impedir temporalment enviar estadístiques o contacte; el joc local continua disponible. Fonts: https://developers.cloudflare.com/pages/functions/routing/, https://developers.cloudflare.com/pages/platform/limits/ i https://developers.cloudflare.com/d1/platform/pricing/.

## Consultar les instal·lacions (privat)

Inicia sessió al teu panell Cloudflare, entra a D1 i obre `hoquei-manager-metrics` → Console. Total:

```sql
SELECT COUNT(*) AS installacions_detectades FROM installations;
```

Per dia:

```sql
SELECT substr(detected_at,1,10) AS dia,COUNT(*) AS installacions
FROM installations GROUP BY dia ORDER BY dia DESC;
```

El joc només envia un identificador aleatori i el tipus de detecció: instal·lació confirmada o primera obertura com a app. No envia nom, correu, partides, ubicació ni agent d’usuari complet. El servidor afegeix la data i el domini; el proveïdor pot tenir metadades de peticions. La clau única evita duplicats en reintents. No hi ha cap endpoint públic que permeti llegir totals o registres.

És una estimació, no un total exacte de descàrregues: esborrar dades, canviar de navegador o canviar de domini pot comptar de nou la mateixa persona. Les instal·lacions que no tornin a obrir l’app no es poden reconstruir. Els bloquejadors poden impedir el registre. Les estadístiques antigues de Netlify continuen al seu panell Forms → installacions-app.

## Contacte (privat)

Els missatges nous es consulten a la mateixa consola D1:

```sql
SELECT created_at,name,email,message FROM contact_messages ORDER BY created_at DESC;
```

No s’ha creat una pàgina pública d’administració ni notificacions de correu. Els missatges antics continuen al panell Netlify. Les dades de contacte s’han d’utilitzar únicament per gestionar els avisos rebuts.

## Desar les partides al núvol

Firebase encara no està configurat: `window.FIREBASE_CONFIG` és `null`. Aquesta migració no activa el Fantasy ni la sincronització de partides. El mànager desa les partides al dispositiu i les pot exportar.

Per activar Google i Firestore, crea Firebase amb el pla Spark sense vincular facturació, registra l’app web i afegeix la seva configuració a `firebase-config.js`. Activa Google a Authentication i afegeix `hoquei-manager27.pages.dev` als dominis autoritzats. Crea Firestore Standard en mode producció, en una regió europea, i publica-hi `firestore.rules`. Pujar aquest fitxer a GitHub no desplega les regles a Firebase. Prova l’accés amb dos comptes abans de donar el núvol per activat. Spark limita l’ús quan s’esgoten les quotes i no activa facturació per excés: https://firebase.google.com/docs/projects/billing/firebase-pricing-plans.

## Actualitzar la web

Des de l’arrel del repositori, amb Wrangler autoritzat al compte correcte:

```text
node scripts/build-site.cjs
wrangler d1 migrations apply hoquei-manager-metrics --remote
wrangler pages deploy dist --project-name hoquei-manager27 --branch main
```

El desplegament és manual: fer push a GitHub desa el codi però no actualitza automàticament Cloudflare. `wrangler.jsonc` conté identificadors públics, no credencials. Les funcions i les migracions queden fora del directori públic `dist/`; Wrangler compila les funcions des de `functions/`. No publiquis l’arrel del repositori.
