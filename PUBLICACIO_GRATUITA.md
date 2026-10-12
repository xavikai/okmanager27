# Publicació del joc a Cloudflare

Web principal: https://hoquei-manager27.pages.dev/. El joc continua sent una PWA instal·lable des d’Android/Chrome i iPhone/Safari. Netlify s’ha retirat. L’antiga adreça https://xavikai.github.io/okmanager27/ només redirigeix a Cloudflare, que és l’únic allotjament del joc. GitHub Pages publica només els fitxers de redirecció de `docs/`. Si tens una partida exportada anteriorment, la pots importar a la nova adreça.

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

És una estimació, no un total exacte de descàrregues: esborrar dades, canviar de navegador o canviar de domini pot comptar de nou la mateixa persona. Les instal·lacions que no tornin a obrir l’app no es poden reconstruir. Els bloquejadors poden impedir el registre. Abans de retirar Netlify es va comprovar que no hi havia registres al formulari d’instal·lacions. El recompte actiu es consulta únicament a D1.

## Contacte (privat)

Els missatges nous es consulten a la mateixa consola D1:

```sql
SELECT created_at,name,email,message FROM contact_messages ORDER BY created_at DESC;
```

No s’ha creat una pàgina pública d’administració ni notificacions de correu. Abans de retirar Netlify es va comprovar que no hi havia missatges al seu formulari de contacte. Les dades de contacte s’han d’utilitzar únicament per gestionar els avisos rebuts.

## Desar les partides del mànager al núvol

Les partides del mànager utilitzen Cloudflare D1 i Google Identity Services. Firebase no és necessari per a aquest desament. El Fantasy encara utilitza el seu codi Firebase i no queda activat per aquest canvi.

Per activar l’accés, crea un client OAuth de tipus Web a Google Cloud / Google Auth Platform i autoritza l’origen https://hoquei-manager27.pages.dev. Configura GOOGLE_CLIENT_ID a Cloudflare Pages, a les variables de producció, amb l’identificador públic acabat en .apps.googleusercontent.com, i torna a desplegar. No cal cap secret de client per al botó de Google. Documentació: https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid.

El servidor verifica la signatura, l’emissor, la caducitat i el destinatari del token de Google. Guarda l’identificador estable del compte i el nom de pila; no guarda el correu ni el token de Google. La sessió usa una galeta segura HttpOnly de 30 dies; a D1 només hi ha el hash del token de sessió. Tancar sessió revoca aquella sessió sense esborrar partides locals.

Cada jugador només pot consultar i modificar les seves partides. El servidor selecciona el propietari a partir de la sessió. Les escriptures són atòmiques i comproven la versió anterior per evitar sobreescriure canvis d’un altre dispositiu. Hi ha un màxim de 10 partides al núvol per compte i 1 MB per còpia comprimida. Les fotos i escuts personalitzats continuen sent locals. El joc agrupa còpies automàtiques i deixa desar manualment abans de canviar de dispositiu. Si falla la xarxa o la quota gratuïta, conserva la còpia local.

GOOGLE_CLIENT_ID està configurat a wrangler.jsonc amb l’identificador públic del client «Hoquei Manager 27 · Cloudflare», al projecte Google hoquei-manager-27. No és una clau secreta. L’únic origen autoritzat és https://hoquei-manager27.pages.dev. Cal provar dos comptes reals abans de donar per validada la sincronització completa. La pàgina privacitat.html explica les dades del mànager.

## Actualitzar la web

Des de l’arrel del repositori, amb Wrangler autoritzat al compte correcte:

```text
node scripts/build-site.cjs
wrangler d1 migrations apply hoquei-manager-metrics --remote
wrangler pages deploy dist --project-name hoquei-manager27 --branch main
```

El desplegament és manual: fer push a GitHub desa el codi però no actualitza automàticament Cloudflare. `wrangler.jsonc` conté identificadors públics, no credencials. Les funcions i les migracions queden fora del directori públic `dist/`; Wrangler compila les funcions des de `functions/`. No publiquis l’arrel del repositori.

## Sincronització automàtica del mànager

Amb Google iniciat, els canvis de la partida oberta s’agrupen durant 5 segons; les còpies automàtiques es limiten a una cada 30 segons mentre hi ha activitat. En tornar al menú, passar a segon pla o sortir de la pàgina s’intenta enviar immediatament la còpia pendent. Es prepara la compressió abans de sortir i s’utilitza fetch keepalive per a peticions de menys de 60 KB. Les còpies grans s’envien amb peticions normals.

El joc mostra l’estat de la sincronització, conserva els canvis locals quan falla la connexió i ho reintenta quan torna. En recarregar, només reprèn automàticament còpies locals més noves que tinguin la mateixa versió del núvol coneguda per aquell compte. No sobreescriu versions d’altres dispositius ni envia automàticament partides locals desconegudes d’un altre compte. Obrir una partida inicia el seu desament automàtic; el botó manual continua disponible.

Tancar a la força l’app, apagar el dispositiu o perdre la connexió pot interrompre l’últim enviament: no es pot garantir l’execució en tancar. Per això es desa durant el joc. Espera que l’estat indiqui que el núvol està al dia abans de continuar des d’un altre dispositiu.
