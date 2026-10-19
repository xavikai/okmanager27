# Sincronització entre dispositius

Les còpies locals descarregades conserven la partida original del núvol mitjançant cloudOrigin. La versió hm27-v50 vincula també les còpies de hm27-v49, mantenint-ne l’identificador local. Desar una còpia vinculada actualitza la partida original i no crea una altra partida al núvol.

Abans d’obrir una partida i en recuperar la connexió o el focus, es consulta la revisió del núvol. Al menú també es comprova cada trenta segons. Una còpia local sense canvis rep les revisions noves sobre el mateix identificador. SHA-256 distingeix els canvis reals del progrés de les marques de temps de desament.

Les escriptures continuen protegides per la revisió esperada del servidor. Si dos dispositius han avançat des d’una mateixa revisió, no es sobreescriu cap branca automàticament. El menú permet carregar el núvol conservant una còpia local anterior, verificable i exportable. Les partides sense connexió continuen desades al dispositiu. No s’actualitza una partida activa amb dades remotes.

Les proves amb dos dispositius cobreixen vinculació de les còpies antigues, reutilització d’identificadors, reinici, canvi de dispositiu, desament durant una pujada, canvis sense connexió, rebuig de revisions obsoletes, rellotges amb la mateixa marca temporal i canvi de compte.
