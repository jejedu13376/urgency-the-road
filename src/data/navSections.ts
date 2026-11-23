/**
 * Sections de navigation claires (hors parcours 17 modules).
 * Relient les hubs Menu / onglets aux écrans mock existants.
 */
export type NavLink = {
  id: string;
  title: string;
  short: string;
  href: string;
  moduleTag?: string;
};

export type NavSection = {
  id: 'mon-vehicule' | 'parametres' | 'fournitures';
  title: string;
  subtitle: string;
  /** Route hub dédiée, ou onglet existant. */
  href: string;
  links: NavLink[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'mon-vehicule',
    title: 'Mon véhicule',
    subtitle: 'Fiche VIN, flotte, documents & rappels entretien',
    href: '/(tabs)/mon-vehicule',
    links: [
      {
        id: 'mv-fiche',
        title: 'Fiche véhicule & VIN',
        short: 'Décodage, fluides, recalls',
        href: '/(tabs)/mon-vehicule',
        moduleTag: 'M1',
      },
      {
        id: 'mv-flotte',
        title: 'Flotte & sélecteur cascade',
        short: 'Multi-véhicules · Continent → pannes',
        href: '/modules/flotte',
        moduleTag: 'M2',
      },
      {
        id: 'mv-entretien',
        title: 'Documents & rappels entretien',
        short: 'Carnet · CT · assurance · PDF',
        href: '/modules/entretien',
        moduleTag: 'M10',
      },
      {
        id: 'mv-gps',
        title: 'GPS voiture / camion',
        short: 'Carte plein écran · itinéraire Valhalla',
        href: '/(tabs)/carte',
        moduleTag: 'M7',
      },
      {
        id: 'mv-voice',
        title: 'Carnet vocal trajets',
        short: 'Notes micro après arrivée · partage routiers',
        href: '/modules/carnet-vocal',
        moduleTag: 'M7+',
      },
    ],
  },
  {
    id: 'parametres',
    title: 'Paramètres',
    subtitle: 'Préférences, notifications, compte & bases',
    href: '/modules/parametres',
    links: [
      {
        id: 'set-prefs',
        title: 'Préférences',
        short: 'Langue · unités · affichage (local)',
        href: '/modules/parametres',
      },
      {
        id: 'set-notif',
        title: 'Notifications',
        short: 'Rappels entretien · SOS · fil (local)',
        href: '/modules/parametres',
      },
      {
        id: 'set-compte',
        title: 'Compte & abonnements',
        short: 'Auth · bio · paiements',
        href: '/modules/compte',
        moduleTag: 'M15',
      },
      {
        id: 'set-bases',
        title: 'Bases auto-évolutives',
        short: 'OTA · apprentissage pannes',
        href: '/modules/bases',
        moduleTag: 'M14',
      },
    ],
  },
  {
    id: 'fournitures',
    title: 'Je fournis / L’app fournit',
    subtitle: 'Documents, pièces & services — qui apporte quoi',
    href: '/modules/fournitures',
    links: [
      {
        id: 'f-partage',
        title: 'Documents & partage',
        short: 'Lien install · SMS / WhatsApp / mail',
        href: '/modules/partage',
        moduleTag: 'M16',
      },
      {
        id: 'f-pieces',
        title: 'Pièces & devis',
        short: 'Catalogue · anti-arnaque · panier',
        href: '/modules/pieces',
        moduleTag: 'M3',
      },
      {
        id: 'f-pro',
        title: 'Services atelier / pro',
        short: 'RDV · KPI atelier · avis',
        href: '/modules/pro',
        moduleTag: 'M17',
      },
    ],
  },
];
