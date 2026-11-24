# CAHIER DES CHARGES TECHNIQUE INTÉGRAL : APPLICATION "URGENCE MÉCANIQUE" (URGENCY ROAD)

## RÔLE ET DIRECTIVES STRICTES POUR CURSOR
Agis en tant qu'architecte logiciel senior et développeur full-stack expert. Génère une application complète, ultra-robuste, rapide et prête pour la production (Web PWA + Mobile iOS/Android via Expo/React Native) pour **"Urgence Mécanique"**.
- **Protection Juridique & Brevet :** Écris un code source 100 % unique, original et propriétaire (ne copie aucun code tiers existant) pour éviter tout litige de droits d'auteur et permettre un dépôt de brevet international ainsi que la vente ou la location de l'application.
- **Couverture Mondiale Obligatoire :** L'application doit couvrir **toute l'Europe, l'Amérique du Nord (Canada/USA), l'Australie et l'Asie**, avec gestion automatique des langues (français par défaut), devises (CAD, USD, EUR, AUD), unités (km/miles, litres/gallons, °C/°F) et réglementations routières locales.
- **Véhicules Supportés :** Toutes les voitures légères, SUV, pick-up (type Ford F-150 / F-350), hybrides, électriques, ainsi que tous les **poids lourds et camions diesel**.

## POSITIONNEMENT COMMERCIAL MONDIAL
- **Vente mondiale :** L'application est destinée à être **vendue dans le monde entier**.
- **Argument de vente n°1 :** **Sauver des vies** via la fiche médicale d'urgence scannable (détail opérationnel : Module 13).
- **Gouvernements & secours :** Démarche commerciale / partenariats pour déployer le scan auprès des forces de l'ordre et services d'urgence (voir Module 13).

---

## LES 17 MODULES DÉTAILLÉS À CODER

### MODULE 1 : ONGLET « MON VÉHICULE » & RECHERCHE MONDIALE PAR NUMÉRO DE SÉRIE (VIN)
- **Label obligatoire :** Nommer l'onglet exactement **« Mon véhicule »** (ne jamais écrire « Ma voiture »).
- **Décodage VIN Mondial :** Identification instantanée de n'importe quel véhicule (voiture ou poids lourd) en Amérique du Nord, Europe, Australie et Asie par saisie manuelle ou scan caméra du numéro de série (VIN).
- **Fiche Technique Complète :** Affichage automatique de la marque, modèle, année, motorisation exacte, capacité des fluides et liste des pannes fréquentes connues sur ce modèle précis.

### MODULE 2 : SÉLECTEUR VISUEL EN CASCADE & GESTION MULTI-FLOTTE
- **Sélecteur en Cascade :** Pour les utilisateurs sans VIN sous la main, sélection ultra-rapide étape par étape avec aperçu visuel : **Continent/Pays → Marque → Modèle → Année → Motorisation → Pannes fréquentes**.
- **Multi-Flotte :** Possibilité d'enregistrer plusieurs véhicules sur un même compte (voiture personnelle, pick-up, camion poids lourd) et de basculer de l'un à l'autre en 1 clic.

### MODULE 3 : LISTE AUTOMATIQUE D'ACHAT PAR VIN, CATALOGUE PIÈCES & DEVIS DE POSE
- **Générateur Automatique d'Achats par VIN :** À partir du numéro de série, l'application génère automatiquement la liste exacte de tout ce dont l'utilisateur a besoin d'acheter (pièces mécaniques, électriques, esthétiques/carrosserie, huiles, filtres) 100 % compatibles avec son véhicule.
- **Catalogue Mondial & Devis Pose :** Comparateur de prix des pièces (neuves, OEM, adaptables) en Europe, Amérique du Nord et Australie, avec calcul automatique du temps barémé et du prix de pose en garage.
- **Scanner de Devis Garage Anti-Arnaque :** Prise en photo d'un devis papier ou PDF d'un garage ; l'IA compare les tarifs des pièces et de la main-d'œuvre avec le marché local et alerte en cas de surfacturation.
- **Parcours « Pièce identifiée → Achat + Réparation + Devis » (vendeur) :** Dès qu'une pièce est identifiée via le **numéro de série (VIN)** et le **capteur / lecture diagnostic** (lien Module 5 OBD / capteurs temps réel), l'application enchaîne sans friction : (1) **redirige** l'utilisateur vers où acheter la pièce au **meilleur prix** ; (2) **propose les réparations à faire** (upsell tutoriel Module 11) ; (3) **affiche un devis approximatif** pour convaincre et convertir. Ce parcours doit rester visible dans le tunnel Mon véhicule → diagnostic → pièces, avec progression / XP si le parcours vendeur est actif.

### MODULE 4 : DIAGNOSTIC IA PHOTO, VIDÉO & QUESTIONS INTELLIGENTES
- **Diagnostic Photo & Caméra Vidéo en Direct :** L'utilisateur photographie ou filme une pièce cassée, rouillée ou une fuite. L'IA identifie la pièce, explique les causes détaillées de la panne, liste les outils et le budget estimé, et fournit les étapes de réparation.
- **Diagnostic photo → pièce + prix + devis :** À partir d’**une photo** d’une pièce / composant, l’app identifie le **problème**, la **pièce concernée**, **où la trouver** (lien catalogue / meilleur prix Module 3), **à quel prix**, et propose un **petit devis** approximatif (pièce + pose) ; enchaînement vendeur vers achat / réparation / Module 11 (YouTube).
- **Filtre de Politesse :** Si la photo ou vidéo envoyée n'a aucun rapport avec la mécanique ou un véhicule, l'IA refuse poliment et recentre l'utilisateur.
- **Questions Intelligentes Interactives :** Diagnostic guidé par questions dynamiques (bruits, fumées, voyants, comportement routier) jusqu'à identifier la panne exacte.
- **Analyseur Acoustique Moteur :** Écoute du bruit du moteur via le micro du téléphone pour détecter les pannes (courroie, injecteur, bielle, roulement).

### MODULE 5 : COMPATIBILITÉ UNIVERSELLE VALISES DIAGNOSTIC (OBD2 & POIDS LOURDS)
- Connexion Bluetooth / Wi-Fi / USB universelle avec **tous les boîtiers et prises diagnostic du marché**.
- Support des protocoles voitures (**OBD2 / EOBD**) ET des protocoles poids lourds (**SAE J1939, J1708**).
- Lecture des codes défauts (DTC), explication détaillée en langage clair, guide de réparation, effacement des voyants et lecture des capteurs en temps réel.
- **Achat abonné (pas Lorenzo) :** La valise / boîtier OBD **n'est pas fournie** par l'éditeur. L'abonné **commande et paie** lui-même après saisie du VIN (onboarding / abonnement).
- **Recommandation prise + valise via VIN :** Dès la saisie du VIN, l'app indique **quelle prise / connecteur OBD** (ex. OBD2 16 broches vs J1939 9 broches PL) et **quel type de boîtier** acheter pour ce véhicule, avec lien d'achat.

### MODULE 6 : SYSTÈME MULTI-IA CONNECTÉ AU WEB EN TEMPS RÉEL & COACH VOCAL
- **Routeur Multi-IA :** Intégration combinée de **Claude, Gemini, GPT-4o, Grok, Mistral et DeepSeek** pour croiser les diagnostics et garantir une précision maximale. Les votes live passent par le **proxy serveur** Firebase (`EXPO_PUBLIC_MULTI_IA_PROXY_URL` uniquement) — **jamais** de clés provider dans le bundle client (voir `docs/MULTI-IA-PROXY.md`).
- **Recherche Web en Direct :** Accès internet temps réel pour vérifier les rappels constructeurs (recalls), bulletins techniques (TSB) et disponibilités des pièces.
- **Assistant Vocal Mains-Libres Rapide :** Synthèse vocale à faible latence (rapide, sans coupure, avec bouton « Stop Voix » instantané) pour guider l'utilisateur étape par étape pendant qu'il répare son véhicule.
- **IA conversationnelle intégrée (voix + texte) :** Chat / talk-to-AI dans l'app : l'utilisateur **parle ou tape** pour diagnostiquer son véhicule, trouver des pièces et comprendre les réparations ; réponses orales et écrites, contextuelles (VIN / flotte / OBD si disponibles), avec bascule vers Modules 3–5 et 11.
- **Suggestions YouTube (pas de vidéo embarquée) :** Face à un problème, l'IA propose des vidéos YouTube pertinentes et **redirige vers YouTube** (aucun fichier vidéo stocké dans l'app).

### MODULE 7 : DOUBLE GPS (MODE CAMION POIDS LOURD & MODE VOITURE NORMALE)
- **Mode GPS Poids Lourd :** Navigation dédiée aux camions prenant en compte la **hauteur** (ponts / gabarit), le **poids** (PTAC / charges), la largeur, les matières dangereuses, les interdictions poids lourds et **toutes les infos relatives à la loi du camionnage** en **Europe, Australie et Amérique du Nord**.
- **Mode GPS Voiture Normale :** Itinéraire rapide standard.
- **Transfert GPS Multi-Plateformes :** Boutons d'envoi direct de la trajectoire routière vers **Google Maps, Waze et Apple Plans**.
- **Signalements routiers temps réel (type Maps / Waze) :** Les utilisateurs signalent dangers, accidents, obstacles, travaux, radars, etc. sur l'itinéraire ; les autres conducteurs voient ces alertes sur la carte en temps réel.

### MODULE 8 : MODULE SPÉCIAL ROUTIERS (BALANCES DE PESAGE & DÉPÔTS PIÈCES)
- **Tracking des Balances de Pesage (Weigh Stations) :** Carte et alertes en temps réel des postes de pesage sur le trajet (**Europe, Australie, Amérique du Nord**) avec distance et statut ; **afficher les balances lorsqu'elles sont allumées / ouvertes et le signaler clairement** (statut ON / ouvert vs fermé / éteint).
- **Infos loi camionnage (pesage) :** Afficher hauteur, poids et les exigences réglementaires liées au passage aux balances selon la juridiction (Europe / Australie / Amérique du Nord).
- **Dépôts Poids Lourds :** Localisation GPS des dépôts de pièces mécaniques poids lourds, relais routiers et ateliers spécialisés camions.

### MODULE 9 : CARTE GPS GARAGES, DÉPANNEURS & MAGASINS DE PIÈCES
- Géolocalisation instantanée autour du véhicule en panne :
  - Grandes chaînes et concessions.
  - Garages indépendants et mécaniciens mobiles.
  - Entreprises de mécanique et dépanneuses (voitures et poids lourds).
  - Magasins de pièces auto.
- Affichage complet : adresse, numéro de téléphone avec appel en 1 clic, horaires, distance et temps de trajet estimé.
- **Contexte PL (si véhicule poids lourd) :** Accès rapide depuis la carte aux infos Module 7–8 (hauteurs / poids / loi camionnage, balances allumées signalées) sans dupliquer le cœur du Module 8.

### MODULE 10 : ENTRETIEN AUTOMATIQUE, PRÉDICTIF & CARNET NUMÉRIQUE
- **Maintenance Automatique :** Programmation des entretiens selon le kilométrage, rappels automatiques de vidange, freins, distribution, pneus et suivi du voltage batterie.
- **Rappels Administratifs Localisés :** Alertes de renouvellement des plaques, assurance et contrôle technique selon les règles de chaque pays (Australie, Europe, Amérique du Nord).
- **Carnet Numérique & Export PDF :** Historique complet des réparations et factures exportable en PDF certifié.

### MODULE 11 : TUTORIELS VIDÉO ÉTAPE PAR ÉTAPE
- **Pas de vidéos embarquées :** L'application **n'embarque aucun fichier vidéo**.
- **Suggestions YouTube + redirection :** Pour un problème / une pièce, l'app suggère des vidéos YouTube pertinentes (marque / modèle / opération) et **ouvre YouTube** directement ; schémas de montage restent côté app (texte / images) si fournis.

### MODULE 12 : FIL MÉCANIQUE (RÉSEAU SOCIAL VIDÉO)
- Plateforme communautaire dédiée à la mécanique permettant aux conducteurs et garagistes de publier des vidéos de réparations, pannes et conseils, avec barre d'actualisation rapide en haut de l'écran et commentaires d'entraide.

### MODULE 13 : MODULE D'URGENCE MÉDICALE & SÉCURITÉ ROUTIÈRE
- **Bouton SOS Urgence Médicale :** Toujours visible et accessible en 1 clic. Permet d'appeler immédiatement les emergency services locaux selon le pays, d'afficher les coordonnées GPS exactes (latitude/longitude + adresse postale) à communiquer aux secours, de partager sa position par SMS à un proche et d'accéder aux fiches de premiers secours hors-ligne.
- **Alerte Pause Conduite (4 Heures) :** Minuteur intelligent déclenchant une alerte automatique suggérant au conducteur de faire une pause ou de prendre un café après **4 heures de conduite**.
- **Bandeau Météo & État des Routes (en haut à gauche) :** Affichage permanent de la date, l'heure, la température extérieure et l'état des routes (ouvertes, fermées ou glacées).
- **Fiche médicale personnelle :** L'utilisateur renseigne, dans une fiche liée à **son compte abonné** : antécédents, allergies, traitements, **adresse**, **contacts d'urgence** et toute info médicale utile.
- **QR code personnel généré dans l'app :** Chaque abonné **génère son propre QR** depuis l'app (lié à son compte + sa fiche), puis l'imprime / colle (autocollant, carte portefeuille, porte-clés QR). Identifiant **uniquement** QR imprimé — **pas** d'AirTag ni de balise NFC / électronique.
- **Unicité garantie :** Chaque QR encode un **identifiant unique** (UUID / token serveur) lié **uniquement** à ce compte et à sa fiche médicale. **Aucun** partage de code entre abonnés. Au scan secours, résolution **uniquement** vers les données de cette personne.
- **Accès en 2 niveaux (uniquement) :** (1) **Secours** — police / ambulanciers / pompiers authentifiés scannent le QR → **fiche complète** (nom, adresse, contact d'urgence, toute info médicale). (2) **L'abonné lui-même** — peut scanner **son** QR (session compte propriétaire) pour afficher / montrer sa fiche. **Aucun** autre passant / tiers : pas d'accès.
- **Vue secours :** Après auth intervenant (abonnement secours actif + badge / n° pro vérifié serveur) → nom, adresse, contact d'urgence à appeler, fiche médicale complète.
- **Vue propriétaire :** L'abonné connecté scanne son propre QR unique → accès à sa fiche (ex. malaise, montrer ses infos aux secours présents).
- **Séparation produits :** Ce QR médical (Module 13) est **distinct** de la **valise OBD** (Module 5) et de la **fiche physique diagnostique** véhicule (phase future) — ne pas confondre les trois.
- **Positionnement « sauver des vies » (Module 13) :** Argument de vente principal — en cas de perte de connaissance / accident, un intervenant autorisé scanne le QR personnel pour identifier la personne et agir.
- **Partenariats gouvernements / forces de l'ordre :** Déploiement du **QR autocollant / carte** auprès des forces de l'ordre et secours (cadré par auth + abonnement ci-dessus).

### MODULE 14 : BASES DE DONNÉES AUTO-ÉVOLUTIVES & MISE À JOUR AUTOMATIQUE
- **Auto-apprentissage des pannes :** Chaque nouveau problème mécanique résolu par le moteur Multi-IA via la recherche web en direct est automatiquement enregistré dans la base de données mondiale de l'application pour enrichir le système.
- **Mise à jour automatique (OTA) :** Actualisation automatique des bases de données véhicules, tarifs des pièces et fonctionnalités sur ordinateur, Android et iOS sans intervention complexe de l'utilisateur.

### MODULE 15 : SÉCURITÉ BIOMÉTRIQUE, INSCRIPTION, ABONNEMENTS & PAIEMENTS
- **Inscription Sécurisée :** Création de compte avec validation stricte du mot de passe (**minimum 6 caractères, dont au moins 1 lettre majuscule et 1 caractère spécial**).
- **Authentification Biométrique :** Connexion par empreinte digitale ou reconnaissance faciale (Apple/Samsung/Google) et chiffrement des données de bout en bout.
- **Abonnements & Paiements :** Abonnement **Premium = 15 $ / mois ($15/month)** — débloque **toutes les options Urgency road**. Paiement via **Stripe** (cartes bancaires), **PayPal**, **Apple Pay**, **Google Pay** et **RevenueCat** (IAP). **Pas de Lydia.**

### MODULE 16 : SYSTÈME DE PARTAGE VIRAL & INSTALLATION UNIVERSELLE
- **Partage en 1 Clic :** Bouton permettant d'envoyer le lien d'installation de l'application à un ami ou collègue (en France, au Canada, en Europe ou en Australie) par **SMS/Texto, WhatsApp, email et réseaux sociaux**.
- **Multi-Support Universel :** Compatible ordinateur (Web/Desktop), téléphone Android et iPhone (iOS) avec installation directe sur l'écran d'accueil.

### MODULE 17 : ESPACE PRO GARAGISTES & PANNEAU SUPER-ADMIN
- **Espace Pro Garagistes (socle) :** Compte atelier dédié : gestion des clients, devis, ordres de réparation, historique véhicule (lien Modules 1–3 / 10), et tableau de bord atelier (charge, créneaux, CA du jour).
- **Panneau Super-Admin :** Comptes (conducteurs / pro / secours), contenus, modération (lien Module 12), analytics, feature flags, et supervision des abonnements (lien Module 15).
- **Gestion des rendez-vous clients :** Agenda atelier (création, modification, annulation, no-show) ; rappels push / SMS au client ; vue jour / semaine / baie ; affectation mécanicien et durée estimée.
- **Réservation en ligne :** Le conducteur réserve un créneau depuis l’app (fiche garage Module 9) ; confirmation instantanée ou validation manuelle du pro ; file d’attente et créneaux bloqués (congés, capacité).
- **Commande pièces depuis l’atelier :** Connexion directe au **catalogue pièces Module 3** (VIN / véhicule du client) : le garagiste commande les pièces compatibles depuis l’espace Pro (meilleur prix, stock, délai) et rattache la commande au devis / OR.
- **Suivi des sinistres (lien module assurance) :** Quand la piste « Module assurance / dossier sinistre » est active, l’espace Pro suit les dossiers sinistre liés à l’atelier (photos, chronologie, statut assureur, pièces commandées, devis de remise en état) sans dupliquer le générateur de dossier côté conducteur.
- **Notation des garages par les clients :** Après intervention, le client note le garage (note + commentaire) ; notes visibles sur la fiche garage (Module 9) et dans le Pro ; anti-fraude basique (compte vérifié, RDV réellement passé) ; le Super-Admin peut modérer les avis abusifs.

---

## PHASE FUTURE — SITE WEB « DIAGNOSTIC + FICHE PHYSIQUE VÉHICULE » (VENTE & ACQUISITION)

> **Hors scope immédiat des 17 modules app** — roadmap commerciale à brancher après le socle mobile. Ton vendeur : transformer le VIN en **achat** (fiche diagnostique + abo app) puis en **rétention** (contenu, devis, vidéos).  
> **Ne pas confondre** avec le **QR médical** Module 13 (autocollant/carte santé) ni avec la **valise OBD** Module 5.

1. **Site web VIN → problème visible :** l’utilisateur saisit son numéro de série et voit immédiatement le diagnostic / problèmes probables de son véhicule (accroche conversion, teaser + CTA).
2. **Achat en ligne d’une fiche diagnostique :** vente digitale de la fiche véhicule (paiement unique ou pack), livrable immédiatement après checkout.
3. **Fiche physique diagnostique à domicile / Amazon :** option d’envoi postal du hardware diagnostique à la maison, **ou** vente via **Amazon** (SKU dédié) pour l’Australie, l’Europe et l’Amérique du Nord — **produit séparé** du QR médical et de la valise OBD.
4. **Activation app une fois la fiche diagnostique branchée :** jumelage hardware ↔ application → affichage des **problèmes identifiés**, **liens YouTube** de réparation (pas de vidéo embarquée), **devis** approximatifs, et enchaînement vers le parcours Module 3 « meilleur prix / réparations / devis » + Modules 4–6 / 11.

---

## PISTES FUTURES (PROPOSITIONS — HORS SCOPE DES 17 MODULES ACTUELS)

1. **Marketplace garages certifiés :** Connecter les conducteurs à des garages certifiés près de chez eux (prise de RDV, notes, offres).
2. **Module assurance / dossier sinistre :** Génération automatique d'un dossier de sinistre après un accident (photos, GPS, chronologie, export assureur).
3. **Mode hors ligne :** Fonctionnalités critiques utilisables sans réseau (zones blanches / tunnels / campagne).
4. **Rappels maintenance kilométrage (extension) :** Rappels programmés selon le kilométrage — *déjà amorcé au Module 10* ; piste = enrichissement (règles constructeur, multi-flotte, push multi-pays).
5. **Estimation valeur de revente :** Estimation de la valeur de revente du véhicule (état, km, marché local).
