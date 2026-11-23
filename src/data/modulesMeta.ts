import type { ModuleMeta } from '../types/modules';

export const MODULES: ModuleMeta[] = [
  { id: 1, title: 'Mon véhicule & VIN', short: 'Fiche VIN / série', href: '/(tabs)/mon-vehicule' },
  { id: 2, title: 'Sélecteur cascade & flotte', short: 'Multi-véhicules', href: '/modules/flotte' },
  { id: 3, title: 'Pièces & devis', short: 'Achats + anti-arnaque', href: '/modules/pieces' },
  { id: 4, title: 'Diagnostic IA', short: 'Photo / questions / son', href: '/modules/diagnostic-ia' },
  { id: 5, title: 'Valise OBD / PL', short: 'DTC & capteurs', href: '/modules/obd' },
  { id: 6, title: 'Multi-IA & coach vocal', short: 'Routeur multi-IA + recalls', href: '/modules/multi-ia' },
  { id: 7, title: 'Double GPS', short: 'Camion / voiture', href: '/modules/gps' },
  { id: 8, title: 'Module routiers', short: 'Pesage & dépôts PL', href: '/modules/routiers' },
  { id: 9, title: 'Garages & pièces GPS', short: 'Autour de moi', href: '/modules/garages' },
  { id: 10, title: 'Entretien & carnet', short: 'Préditif + PDF', href: '/modules/entretien' },
  { id: 11, title: 'Tutoriels vidéo', short: 'Étape par étape', href: '/modules/tutoriels' },
  { id: 12, title: 'Fil mécanique', short: 'Réseau social vidéo', href: '/(tabs)/fil' },
  { id: 13, title: 'Urgence & sécurité', short: 'SOS + pause 4h', href: '/modules/urgence' },
  { id: 14, title: 'Bases auto-évolutives', short: 'OTA & apprentissage', href: '/modules/bases' },
  { id: 15, title: 'Compte & abonnements', short: 'Bio + Lydia stub', href: '/modules/compte' },
  { id: 16, title: 'Partage viral', short: 'SMS / WhatsApp / mail', href: '/modules/partage' },
  { id: 17, title: 'Pro & Super-admin', short: 'Atelier + admin', href: '/modules/pro' },
];
