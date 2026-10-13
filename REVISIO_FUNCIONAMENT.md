# Revisió de funcionament (13 octubre 2026)

Errors reproduïts i corregits:

- Alineacions amb jugadors duplicats, dos porters o porter fora de la primera posició: ara es validen i es reparen abans de la vista prèvia i la simulació.
- Acumulació de targetes: diverses blaves al mateix partit podien duplicar una sanció o saltar el llindar de cinc sense sancionar. Ara es compten els llindars travessats. Les sancions només es compleixen si el club juga la jornada.
- Desament manual i sortida: abans es podia anunciar èxit encara que les escriptures fallessin. Ara es comprova el contingut real a localStorage o IndexedDB; si falla, la partida continua oberta. També s'aplica a la sortida amb còpia local després d'un error del núvol.
- Vista prèvia de la Lliga Catalana: es prepara la recuperació de jugadors abans de mostrar-los i s'evita repetir-la quan comença el partit.

Validació: proves de regressió dels casos anteriors, conjunt complet de proves existents i temporades completes amb el motor real per Barça, Liceo, Tordera i Palau (lliga, competicions catalanes, copes, importació del desament i canvi de temporada).

Abast: lògica del motor i emmagatzematge amb proves automatitzades. No és una certificació que l'aplicació no contingui altres errors ni una revisió exhaustiva de totes les dades esportives o de tots els navegadors i dispositius.
