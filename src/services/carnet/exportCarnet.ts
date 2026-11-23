/**
 * Module 10 — carnet export.
 * Shares a plain-text carnet via the OS share sheet.
 * Never claims "PDF certifié" — certification needs a signed backend.
 */
import { Share, Platform } from 'react-native';

export type CarnetExportLine = {
  title: string;
  km: number;
  dateIso: string;
  cost?: number;
  currency?: string;
  invoiceRef?: string;
};

export type CarnetExportInput = {
  vehicleLabel: string;
  vin?: string;
  odometerKm: number;
  entries: CarnetExportLine[];
  maintenanceDone?: string[];
};

export function buildCarnetText(input: CarnetExportInput): string {
  const lines: string[] = [
    'URGENCE MÉCANIQUE — CARNET NUMÉRIQUE',
    `Véhicule : ${input.vehicleLabel}`,
    input.vin ? `VIN : ${input.vin}` : 'VIN : —',
    `Km actuel : ${input.odometerKm.toLocaleString('fr-FR')}`,
    `Export : ${new Date().toLocaleString('fr-FR')}`,
    '',
    '— Interventions —',
  ];
  if (!input.entries.length) {
    lines.push('(aucune entrée)');
  } else {
    for (const e of input.entries) {
      const cost =
        e.cost != null ? ` · ${e.cost} ${e.currency ?? ''}`.trimEnd() : '';
      const inv = e.invoiceRef ? ` · ${e.invoiceRef}` : '';
      lines.push(
        `• ${e.dateIso} · ${e.km.toLocaleString('fr-FR')} km — ${e.title}${cost}${inv}`,
      );
    }
  }
  if (input.maintenanceDone?.length) {
    lines.push('', '— Entretiens marqués faits —');
    for (const t of input.maintenanceDone) lines.push(`• ${t}`);
  }
  lines.push(
    '',
    'Note : export texte partageable — pas un PDF certifié / signé serveur.',
  );
  return lines.join('\n');
}

export async function shareCarnetText(input: CarnetExportInput): Promise<{
  ok: boolean;
  message: string;
}> {
  const message = buildCarnetText(input);
  try {
    const res = await Share.share({
      message,
      title: 'Carnet Urgence Mécanique',
      url: Platform.OS === 'ios' ? undefined : undefined,
    });
    if (res.action === Share.sharedAction) {
      return {
        ok: true,
        message: 'Carnet texte partagé (non certifié). PDF certifié = backend signature à brancher.',
      };
    }
    return { ok: false, message: 'Partage annulé — aucun fichier certifié généré.' };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Échec partage carnet',
    };
  }
}
