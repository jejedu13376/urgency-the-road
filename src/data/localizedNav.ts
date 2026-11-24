import type { NavSection } from './navSections';

type T = (key: string) => string;

/** Build nav sections with translated titles (hrefs stay stable). */
export function localizedNavSections(t: T): NavSection[] {
  return [
    {
      id: 'mon-vehicule',
      title: t('nav.monVehicule.title'),
      subtitle: t('nav.monVehicule.subtitle'),
      href: '/(tabs)/mon-vehicule',
      links: [
        {
          id: 'mv-fiche',
          title: t('nav.monVehicule.fiche'),
          short: t('nav.monVehicule.ficheShort'),
          href: '/(tabs)/mon-vehicule',
          moduleTag: 'M1',
        },
        {
          id: 'mv-flotte',
          title: t('nav.monVehicule.flotte'),
          short: t('nav.monVehicule.flotteShort'),
          href: '/modules/flotte',
          moduleTag: 'M2',
        },
        {
          id: 'mv-entretien',
          title: t('nav.monVehicule.entretien'),
          short: t('nav.monVehicule.entretienShort'),
          href: '/modules/entretien',
          moduleTag: 'M10',
        },
        {
          id: 'mv-gps',
          title: t('nav.monVehicule.gps'),
          short: t('nav.monVehicule.gpsShort'),
          href: '/(tabs)/carte',
          moduleTag: 'M7',
        },
      ],
    },
    {
      id: 'parametres',
      title: t('nav.parametres.title'),
      subtitle: t('nav.parametres.subtitle'),
      href: '/modules/parametres',
      links: [
        {
          id: 'set-prefs',
          title: t('nav.parametres.prefs'),
          short: t('nav.parametres.prefsShort'),
          href: '/modules/parametres',
        },
        {
          id: 'set-notif',
          title: t('nav.parametres.notif'),
          short: t('nav.parametres.notifShort'),
          href: '/modules/parametres',
        },
        {
          id: 'set-compte',
          title: t('nav.parametres.compte'),
          short: t('nav.parametres.compteShort'),
          href: '/modules/compte',
          moduleTag: 'M15',
        },
        {
          id: 'set-support',
          title: t('nav.parametres.support'),
          short: t('nav.parametres.supportShort'),
          href: '/modules/support',
        },
        {
          id: 'set-bases',
          title: t('nav.parametres.bases'),
          short: t('nav.parametres.basesShort'),
          href: '/modules/bases',
          moduleTag: 'M14',
        },
      ],
    },
    {
      id: 'fournitures',
      title: t('nav.fournitures.title'),
      subtitle: t('nav.fournitures.subtitle'),
      href: '/modules/fournitures',
      links: [
        {
          id: 'f-partage',
          title: t('nav.fournitures.docs'),
          short: t('nav.fournitures.docsShort'),
          href: '/modules/partage',
          moduleTag: 'M16',
        },
        {
          id: 'f-pieces',
          title: t('nav.fournitures.pieces'),
          short: t('nav.fournitures.piecesShort'),
          href: '/modules/pieces',
          moduleTag: 'M3',
        },
        {
          id: 'f-pro',
          title: t('nav.fournitures.pro'),
          short: t('nav.fournitures.proShort'),
          href: '/modules/pro',
          moduleTag: 'M17',
        },
      ],
    },
  ];
}

export function localizedModuleTitle(t: T, id: number): { title: string; short: string } {
  return {
    title: t(`modules.m${id}.title`),
    short: t(`modules.m${id}.short`),
  };
}
