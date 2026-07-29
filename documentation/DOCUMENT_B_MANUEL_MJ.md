# DOCUMENT B — DOC INFO MJ

# Utiliser Ten Candles – Game Assistant dans Foundry VTT

Ce guide présente les fonctions du système destinées au Maître du jeu.

Il ne remplace pas les règles de **Ten Candles**. Les notions de Vice, Vertu,
Instant, Espoir, Limite, conflit, narration, bougie et Bal des vérités sont
considérées comme connues.

Le guide est organisé en huit pages de journal. Leur ordre suit le déroulement
général d’une partie, tandis que chaque page regroupe les fonctions appartenant
à un même sujet.

---

# PAGE 1 — REPÈRES DU SYSTÈME

## Les quatre espaces essentiels

Le système s’utilise principalement depuis quatre espaces.

### La régie MJ

La régie rassemble l’état de la partie et les commandes réservées au Maître du
jeu. Elle permet notamment de suivre les bougies, les dés disponibles, le
conflit actif, les ressources des personnages et le canevas officiel.

### Le canevas officiel

La scène que nous appellerons canevas est une représentation visuelle des bougies et des dés. Il se met à
jour automatiquement lorsque le système applique une perte de dés, éteint une
bougie ou prépare une nouvelle scène.

### Les fiches de personnage

Chaque fiche contient les informations personnelles du personnage et ses
ressources. Elle permet également de lancer un conflit pour ce personnage.

### Les cartes de chat

Les conflits, les Instants, les Bals des vérités et les départs de personnages
sont présentés dans le chat. Les actions nécessaires apparaissent directement
sur la carte concernée.

## Ce que le système automatise

Le système calcule le nombre de dés à lancer, conserve les résultats, applique
les relances, actualise les ressources, retire les dés perdus, attribue la
narration et accompagne les transitions entre les scènes.

Les décisions narratives restent prises autour de la table. Le système ne
demande pas de saisir les vérités, les descriptions ou les conséquences
fictionnelles dans Foundry.

## Dés 3D avec Dice So Nice !

Le système est compatible avec le module **Dice So Nice !**, qui permet
d’afficher les lancers sous la forme de dés 3D. Cette intégration est
entièrement facultative : si vous ne souhaitez pas utiliser les dés 3D, il
suffit de ne pas activer le module dans la partie. Les lancers et toutes les
autres fonctionnalités du système resteront pleinement fonctionnels.

Lorsque le module est activé, sa configuration est accessible depuis
**Paramètres** (barre d’icônes à droite), puis **Paramètres de la partie** et
**Dice So Nice !**.

Chaque utilisateur possède sa propre configuration. Le Maître du jeu peut
activer le module pour la partie, mais les joueurs doivent eux-mêmes
personnaliser leurs dés s’ils le souhaitent. Ils peuvent également désactiver
l’affichage des dés 3D depuis leur propre configuration, sans affecter les
autres participants ni le fonctionnement du système.

## L’état de la partie

Les bougies, les dés disponibles, la phase actuelle et le conflit actif sont
enregistrés dans le monde Foundry. Ces informations sont partagées entre tous
les utilisateurs et conservées après un rechargement ou une fermeture du
monde.

La régie affiche cet état collectif. Le canevas et les cartes de chat en sont
des représentations : leur suppression ne réinitialise pas la partie.

## Le Maître du jeu actif

Les opérations mécaniques sont traitées par le compte MJ actif. Si plusieurs
comptes MJ sont connectés, les autres peuvent consulter la régie, mais celle-ci
peut apparaître en lecture seule.

---

# PAGE 2 — PRÉPARER UNE PARTIE

## Ouvrir la régie

La régie est accessible de deux manières :

- depuis l’outil **Régie MJ** du groupe de contrôles Ten Candles (barre latérale de gauche, sous le menu Token / Tuiles / Dessin / etc...);
- depuis le bouton **RÉGIE MJ** situé au-dessus de la liste des personnages dans la barre latérale de droite.

Les deux boutons ouvrent la même fenêtre.

## Reprendre une partie

L’état collectif est conservé automatiquement. Pour poursuivre une partie
interrompue, ouvrez simplement le monde et vérifiez la régie.

Ne créez pas une nouvelle partie si vous souhaitez reprendre les mêmes bougies,
les mêmes dés disponibles et la même progression.

## Créer une nouvelle partie

Utilisez **Créer une nouvelle partie** dans la section **Gestion de la partie**
pour commencer un nouveau cycle.

Après confirmation, le système :

- interrompt les conflits, transitions et demandes d’Instant encore actifs ;
- archive le canevas précédemment associé ;
- réinitialise l’état collectif avec dix bougies et dix dés joueurs ;
- conserve le mode de présentation sélectionné ;
- publie une information dans le chat.

Les Personnages et leurs ressources personnelles sont conservés. Si les mêmes
personnages sont réutilisés, vérifiez leurs cartes avant de commencer et
corrigez leurs états depuis la fiche ou la régie si nécessaire.

En mode canevas officiel, un nouveau canevas est créé pour la partie. En mode
setup personnel, aucun canevas n’est généré.

## Choisir la présentation

La régie propose deux modes.

### Canevas interactif officiel

Le canevas fourni avec le système constitue l’affichage principal des bougies
et des dés. Une scène intéractive est créer et se mettra à jour directement à mesure que la partie avance.
Les cartes de chat restent compactes.

### Setup personnel du MJ

Ce mode convient si vous utilisez des bougies physiques, votre propre scène ou
un autre dispositif visuel. Les cartes de chat affichent alors davantage
d’informations sur l’état collectif.

Ce choix ne modifie aucune mécanique. Un canevas déjà associé peut continuer à
se synchroniser en arrière-plan même lorsque le setup personnel est actif.

## Vérifier le canevas

La section **Canevas officiel** de la régie propose trois commandes :

- **Afficher** ouvre la scène associée ;
- **Synchroniser** aligne son affichage sur l’état collectif en cours;
- **Réparer ou recréer** restaure les éléments manquants ou crée un nouveau
  canevas si la scène n’existe plus.

Si une ancienne scène compatible est détectée, le système peut proposer de la
reprendre, de créer un nouveau canevas ou d’utiliser un setup personnel. Aucun
de ces choix ne supprime les scènes existantes.

## Préparer les personnages

Créez un Actor de type **Personnage** pour chaque participant, attribuez-le au
joueur concerné et accordez-lui les droits nécessaires.

Avant la partie, vérifiez que chaque fiche contient au minimum :

- le nom et le Concept du personnage ;
- sa Vertu et son Vice ;
- son Instant ;
- sa Limite.

Les champs sont enregistrés automatiquement.

## Contrôle avant de jouer

Avant la première scène, vérifiez rapidement :

- le mode de présentation ;
- le nombre de bougies ;
- le nombre de dés joueurs ;
- l’absence de conflit encore actif ;
- les personnages et leurs permissions ;
- l’état des ressources individuelles ;
- le canevas officiel, si vous l’utilisez.

---

# PAGE 3 — FICHES DE PERSONNAGE

## Identité du personnage

La partie supérieure de la fiche contient le portrait, le nom et le Concept.
Le portrait peut être remplacé en cliquant sur l’image. Le champ Concept accepte
plusieurs lignes et peut être développé lorsqu’il contient un texte long.

Le nom du personnage est repris dans les cartes de chat et les annonces du
système.

## Vertu et Vice

Les textes de Vertu et de Vice sont saisis directement dans leurs cartes.

Le bouton de chaque carte permet de la brûler ou de la restaurer manuellement,
après confirmation. Cette action sert principalement à enregistrer une
consommation faite autour de la table ou à corriger une erreur.

Lorsqu’un conflit est déjà actif, sa résolution conserve l’état des ressources
enregistré au moment du lancer. Une modification effectuée depuis la fiche
s’appliquera au conflit suivant.

Pour effectuer réellement une relance pendant un conflit, utilisez les boutons
de la carte de chat plutôt que les boutons de la fiche.

## Instant

La carte Instant contient sa condition et affiche son état actuel :

- à déclencher ;
- en attente ;
- Espoir gagné ;
- Espoir perdu.

Le bouton de la carte permet de déclencher l’Instant, de retirer une demande
encore en attente ou de réinitialiser un Instant déjà résolu. Le fonctionnement
complet est présenté dans la page **Gérer un Instant**.

## Limite

Le texte de la Limite reste modifiable depuis la fiche. Sa disponibilité est
calculée automatiquement à partir de l’état des autres cartes.

La Limite affiche directement **Limite verrouillée** ou **Limite disponible**.
Elle ne possède pas de commande de correction manuelle sur la fiche.

## Réorganiser les cartes

Les poignées placées dans l’en-tête de Vertu, Vice et Instant permettent de
modifier leur ordre par glisser-déposer. Cette disposition est propre au
personnage et ne produit aucun effet mécanique.

La Limite conserve toujours sa position fixe après ces trois cartes.

## Lancer depuis la fiche

Le grand bouton situé sous le Concept lance un conflit pour le personnage
ouvert. Son intitulé indique automatiquement le nombre de dés actuellement
disponibles.

Le bouton se désactive lorsqu’un conflit est déjà en cours, pendant une
transition qui interdit un nouveau lancer, en l’absence de MJ actif ou lorsque
le groupe ne possède plus de dé disponible.

## Consulter l’état collectif

Le volet **État actuel de la partie**, replié en bas de la fiche, permet de
consulter rapidement :

- les bougies allumées ;
- les dés joueurs disponibles ;
- les dés MJ ;
- la phase actuelle.

Ces informations sont communes à tous les personnages.

---

# PAGE 4 — RÉSOUDRE UN CONFLIT

## Lancer les dés du joueur

Un conflit peut être lancé depuis :

- le grand bouton de la fiche du personnage ;
- le bouton flottant **Lancer les dés** présent dans la scène ;
- l’outil **Lancer un conflit Ten Candles** du groupe Tokens (barre latéralle gauche).

Le bouton de la fiche utilise directement le personnage affiché.

Pour les deux autres accès, le système recherche d’abord un unique token
contrôlé, puis le personnage attribué à l’utilisateur. Si plusieurs personnages
restent possibles, une fenêtre permet de choisir celui qui effectue le conflit.

Le nombre de dés à lancer et l’éventuel dé d’Espoir sont déterminés
automatiquement. Une seule résolution peut être active à la fois.

## Lire la carte de conflit

Après le lancer, une carte publique apparaît dans le chat. Elle présente :

- les dés du personnage ;
- le dé d’Espoir lorsqu’il est disponible ;
- les actions personnelles utilisables ;
- les dés que le Maître du jeu peut lancer ;
- le résultat et le narrateur provisoires ;
- l’état de la résolution.

Le résultat reste provisoire jusqu’à la validation du conflit par le MJ.

## Utiliser Vertu ou Vice

Si un joueur souhaite utiliser sa Vertu ou son Vice, il clique directement sur
le bouton correspondant dans la carte de chat.

Le système relance les dés éligibles, brûle la carte utilisée et actualise le
résultat. Une seule de ces deux ressources peut être utilisée pendant le même
conflit.

Les boutons sont accessibles à l’utilisateur ayant lancé le conflit et aux MJ.
Les autres joueurs peuvent consulter la carte sans agir sur ces ressources.

## Utiliser la Limite

Lorsque la Limite était disponible au début du conflit, son bouton apparaît
dans la carte de chat.

Un clic relance automatiquement les dés du personnage et actualise le
résultat. Le dé d’Espoir conserve son résultat. La Limite ne peut être utilisée
qu’une fois pendant cette résolution.

Si la Limite se déverrouille au cours du conflit, elle sera proposée à partir
du conflit suivant.

## Lancer les dés du Maître du jeu

Le MJ actif clique sur le bouton placé dans la zone **Maître du jeu** de la
carte. La même action est disponible dans la régie lorsqu’une résolution est
active.

Les résultats sont ajoutés à la carte et l’attribution provisoire de la
narration est actualisée.

Si le MJ ne souhaite pas lancer ses dés, il peut valider directement le conflit.
Le système enregistre alors que ce lancer a été ignoré.

## Valider le conflit

Lorsque tous les choix et toutes les relances sont terminés, le MJ clique sur
**Valider le conflit**, depuis la carte ou la régie.

Le système rend le résultat définitif, applique les pertes de dés, attribue la
narration, actualise l’état collectif et synchronise le canevas. Les boutons de
la carte sont ensuite verrouillés.

En cas d’échec, la transition de fin de scène est préparée automatiquement. Elle
est détaillée dans la page **Terminer une scène**.

## Reprendre volontairement la narration

Lorsque cette option est disponible, une commande apparaît dans la carte de
conflit et dans la régie. Si le joueur choisit de reprendre la narration, le MJ
utilise cette commande à la place de **Valider le conflit**.

Le traitement de cette transition est présenté dans la page **Terminer une
scène**.

## Annuler la résolution

Avant sa validation, le MJ peut utiliser **Annuler la résolution** depuis la
carte ou la régie.

L’annulation libère la partie sans modifier les bougies ni les dés collectifs.
En revanche, une Vertu ou un Vice déjà utilisé reste brûlé. Il faudra donc 
réinitialiser son étât depuis la fiche de personnage ou depuis la régie MJ.


---

# PAGE 5 — GÉRER UN INSTANT

## Déclencher l’Instant

Lorsqu’un joueur estime que son Instant doit être résolu, il clique sur
**Déclencher l’Instant** dans sa fiche et confirme sa demande.

Si aucun conflit n’est actif, la carte d’Instant est publiée immédiatement dans
le chat.

## Demande pendant un conflit

Si un conflit est en cours, la demande est placée en attente et sera publiée
automatiquement après sa résolution.

Tant que cette demande n’a jamais été publiée, le joueur peut la retirer depuis
sa fiche en cliquant sur **Instant en attente…**.

Plusieurs demandes peuvent être conservées. Elles seront proposées dans leur
ordre de création sans bloquer le lancement du prochain conflit.

## Résoudre l’Instant

La carte de chat reprend le texte de l’Instant et propose deux boutons :

- **Réussite** ;
- **Échec**.

Le joueur propriétaire du personnage ou un MJ peut choisir le résultat. Le
système actualise alors la fiche, l’Espoir et la disponibilité de la Limite.

Les autres joueurs voient la carte, mais ne peuvent pas utiliser ses boutons.

Il est à noter que la résolution de cet Instant en lui-même doit être effectuer 
de la même manière qu'un conflit classique. C'est le résultat de ce conflit qui 
permettra de choisir manuellement si c'est une Réussite ou un Échec.

## Instant suspendu

Si un nouveau conflit commence alors qu’une carte d’Instant attend encore une
décision, celle-ci est temporairement suspendue.

Ses boutons sont désactivés pendant le conflit, puis la demande est republiée
automatiquement lorsque la résolution se termine.

## Réinitialiser l’Instant

Après une réussite ou un échec, le bouton de la fiche permet de réinitialiser
l’Instant.

Après confirmation, la carte revient à son état initial. Le dé d’Espoir est
retiré s’il avait été gagné et la disponibilité de la Limite est recalculée.

Pour une correction effectuée directement par le MJ, consultez la page
**Régie et maintenance**.

---

# PAGE 6 — TERMINER UNE SCÈNE

## Échec d’un conflit

Lorsqu’un conflit échoue et qu’il reste plusieurs bougies, sa validation met fin
à la scène et publie une carte **Bal des vérités**.

Cette carte indique déjà le nombre de vérités à énoncer après l’extinction de la
prochaine bougie.

## Commencer le Bal des vérités

Le MJ clique sur :

> **Éteindre une bougie et commencer le Bal des vérités**

Le système éteint la bougie, restaure les dés joueurs pour la nouvelle scène,
actualise les dés MJ et synchronise le canevas.

La carte confirme ensuite que la nouvelle scène est prête. Le Bal des vérités
se déroule oralement : aucune saisie n’est demandée dans Foundry.

## Reprise volontaire de la narration

Après le jet du MJ, le système peut proposer l’option permettant au personnage
de reprendre la narration en éteignant volontairement une bougie.

Si le joueur accepte, le MJ utilise la commande proposée dans la carte de
conflit ou dans la régie. Cette action :

- valide le conflit en conservant sa réussite ;
- attribue la narration au joueur ;
- éteint immédiatement une bougie ;
- prépare les dés de la scène suivante ;
- publie la carte du Bal des vérités.

La bougie étant déjà éteinte, aucun second clic n’est nécessaire sur la carte du
Bal. Une fois les vérités énoncées, la scène suivante peut commencer.

## En cas de double affichage ou d’hésitation

La régie indique la phase actuelle et l’action encore attendue. Si la transition
vers le Bal est active, la même commande de démarrage y reste disponible.

N’utilisez pas les compteurs manuels pour reproduire une transition déjà prise
en charge par la carte.

---

# PAGE 7 — LA DERNIÈRE BOUGIE

## Lancer le dernier dé

À la dernière bougie, le bouton principal de la fiche affiche :

> **Lutter encore et toujours...**

Le système lance l’unique dé collectif disponible et traite le conflit de la
même manière que les précédents.

## Réussite

En cas de réussite, le conflit est validé normalement. 
La dernière bougie continue de brûler.

## Échec et départ

En cas d’échec, le système applique automatiquement le départ du personnage.

Il ne lance pas un nouveau Bal des vérités, n’éteint pas la dernière bougie et
conserve l’unique dé pour les autres personnages encore présents.

Une carte narrative de départ est publiée dans le chat. Aucune commande
supplémentaire n’est nécessaire.

## Gestion du personnage

La fiche et l’Actor ne sont pas supprimés. Le système n’ajoute pas non plus
d’état permanent de décès : la mise en scène et la gestion du personnage
restent entre les mains du groupe.

Les textes de départ sont choisis aléatoirement. Une même formulation ne sera
pas réutilisée avant que les dix textes disponibles aient été affichés.

---

# PAGE 8 — RÉGIE ET MAINTENANCE

## Corriger les bougies

Les boutons **−** et **+** du compteur permettent d’éteindre ou de rallumer une
bougie.

Cette correction modifie l’état collectif. Utilisez-la uniquement pour réparer
une erreur ou enregistrer une modification réalisée volontairement hors des
transitions automatiques.

## Corriger les dés joueurs

Les boutons **−** et **+** permettent de retirer ou d’ajouter un dé joueur.

Le bouton **Restaurer** ramène les dés joueurs au nombre correspondant aux
bougies actuellement allumées. Les dés MJ sont calculés automatiquement et ne
se modifient pas directement.

Les corrections collectives sont bloquées pendant un conflit actif.

## Corriger les ressources

Dans la section **Ressources des personnages** :

1. sélectionnez le personnage ;
2. choisissez l’état de sa Vertu, de son Vice et de son Instant ;
3. cliquez sur **Enregistrer les corrections**.

La disponibilité de l’Espoir et de la Limite est recalculée automatiquement.
Les textes des cartes restent modifiables uniquement depuis la fiche.

Changer de personnage avant l’enregistrement abandonne les modifications non
validées. Cette section est également bloquée pendant un conflit actif.

## Retrouver un conflit actif

La ligne **Résolution active** indique si un conflit est encore enregistré.

Selon son état, la régie permet de :

- lancer les dés du MJ ;
- valider le conflit ;
- annuler la résolution.

Ces commandes restent utilisables même si la carte de chat correspondante est
introuvable ou ne s’est pas affichée correctement.

## Réparer le canevas

Si le canevas ne correspond plus à la partie :

1. consultez l’état affiché dans la régie ;
2. utilisez **Synchroniser** ;
3. si des éléments sont absents, utilisez **Réparer ou recréer**.

La réparation restaure les éléments pilotés par le système sans réinitialiser
la partie. Si la scène associée a été supprimée, un nouveau canevas peut être
créé à partir de l’état collectif conservé.

## Reprendre après une interruption

L’état collectif, le conflit actif et les demandes d’Instant sont persistants.
Après un rechargement ou une réouverture du monde, ouvrez la régie pour vérifier
la situation avant d’effectuer une correction.

Si une action semble bloquée, recherchez d’abord :

- un conflit encore actif ;
- une transition vers le Bal des vérités ;
- l’absence de MJ actif ;
- une régie en lecture seule ;
- un canevas simplement désynchronisé.

Les commandes de la régie doivent être privilégiées aux modifications directes
des paramètres du système : elles appliquent les contrôles nécessaires et
conservent la cohérence multijoueur.

---

# PAGE 9 — AMÉLIORATION ET BUG

Un grand soin a été mis dans la réalisation de ce système de jeu Ten Candles - Game assistant afin de mettre au centre de la partie la narration, l'immersion et minimiser au maximum les interactions techniques avec la fiche de personnage ou l'environnement de jeu.

Cependant si vous aviez des axes d'amélioration, ou si vous rencontriez des bugs, n'hésitez pas à les faire remonter sur le dépôt GitHub du projet (https://github.com/ctotone/evil-tencandles-system/issues)